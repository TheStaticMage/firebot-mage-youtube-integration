/**
 * QuotaManager tracks and manages YouTube API quota consumption with persistent storage
 *
 * Responsibilities:
 * - Calculate delay between streamList calls based on quota settings
 * - Record actual API call consumption per application
 * - Track quota usage across Firebot restarts
 * - Reset quota at midnight Pacific Time daily
 * - Validate quota availability before API calls
 * - Consider daily quota budget and maximum stream duration
 * - Target 80% quota usage to leave buffer for other API calls
 * - Support manual override of calculated delays
 */

import { DateTime } from "luxon";
import { firebot, logger } from "../main";
import type { YouTubeIntegration } from "../integration-singleton";
import { QuotaSettings } from "../types";
import { QuotaTrackingStorage, QuotaUsage, QUOTA_COSTS, QUOTA_PROPERTIES } from "../types/quota-tracking";
import { getDataFilePath } from "../util/datafile";
import { triggerQuotaThresholdCrossed } from "../events/quota-threshold";
import { FAILOVER_THRESHOLD_DEFAULT } from "./quota-failover-manager";

export class QuotaManager {
    /**
     * Target percentage of daily quota to use for chat polling
     * Leaves 20% buffer for other operations
     */
    private static readonly QUOTA_TARGET_PERCENT = 0.8;

    /**
     * Debounce delay for saving quota data (ms)
     * Reduces file I/O overhead from frequent API calls
     */
    private static readonly SAVE_DEBOUNCE_MS = 5000;

    /**
     * In-memory tracking of quota usage per application
     */
    private quotaData: Map<string, QuotaUsage>;

    /**
     * Timer for debounced save operations
     */
    private saveTimer?: NodeJS.Timeout;

    /**
     * Reference to the YouTube integration for looking up application data
     */
    private integration?: YouTubeIntegration;

    constructor(integration?: YouTubeIntegration) {
        this.quotaData = new Map();
        this.integration = integration;
    }

    /**
     * Initialize the quota manager by loading quota data from disk
     * Must be called after firebot global is initialized
     */
    async initialize(): Promise<void> {
        this.loadQuotaData();
    }

    /**
     * Calculate the delay in milliseconds between streamList calls
     *
     * @param quotaSettings The quota settings for active application
     * @returns delay in milliseconds, or null if settings are invalid
     */
    calculateDelay(quotaSettings: QuotaSettings): number | null {
        // Check if user has overridden the delay
        if (quotaSettings.overridePollingDelay && quotaSettings.customPollingDelaySeconds >= 0) {
            logger.info(`Using custom polling delay: ${quotaSettings.customPollingDelaySeconds}s`);
            return Math.round(1000 * quotaSettings.customPollingDelaySeconds);
        }

        const dailyQuota = quotaSettings.dailyQuota;
        const maxStreamHours = quotaSettings.maxStreamHours;

        // Validate settings
        if (!dailyQuota || dailyQuota <= 0) {
            logger.error("Invalid dailyQuota setting. Must be > 0");
            return null;
        }

        if (!maxStreamHours || maxStreamHours <= 0) {
            logger.error("Invalid maxStreamHours setting. Must be > 0");
            return null;
        }

        // Calculate delay based on quota budget
        const maxStreamSeconds = maxStreamHours * 3600;
        const delayMilliseconds =
            1000.0 * (maxStreamSeconds - (dailyQuota * QuotaManager.QUOTA_TARGET_PERCENT * QUOTA_PROPERTIES.STREAM_LIST_DURATION_SECONDS / QUOTA_COSTS.STREAM_LIST)) /
            ((dailyQuota * QuotaManager.QUOTA_TARGET_PERCENT / QUOTA_COSTS.STREAM_LIST) - 1);

        logger.debug(
            `Quota calculation: dailyQuota=${dailyQuota}, maxStreamHours=${maxStreamHours}, ` +
            `delayMilliseconds=${delayMilliseconds.toFixed(3)}ms`
        );

        return delayMilliseconds < 0 ? 0 : Math.round(delayMilliseconds);
    }

    /**
     * Check if an API error indicates quota exceeded
     *
     * YouTube API returns 403 Forbidden with specific error reasons:
     * - quotaExceeded: Daily quota limit reached
     * - rateLimitExceeded: Too many requests in short time
     */
    isQuotaExceededError(error: any): boolean {
        if (!error) {
            return false;
        }

        // Check for googleapis error structure
        if (error.code === 403) {
            const reason = error.errors?.[0]?.reason;
            if (reason === 'quotaExceeded') {
                logger.error("YouTube API quota exceeded");
                return true;
            }
            if (reason === 'rateLimitExceeded') {
                logger.error("YouTube API rate limit exceeded");
                return true;
            }
        }

        // Check for gRPC error with quota messages
        const message = error.message?.toLowerCase() || '';
        if (message.includes('quota') && message.includes('exceed')) {
            logger.error("Detected quota exceeded from error message");
            return true;
        }

        return false;
    }

    /**
     * Format delay for display to user
     */
    formatDelay(delayMilliseconds: number): string {
        const seconds = Math.round(delayMilliseconds / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        }

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (remainingSeconds === 0) {
            return `${minutes}m`;
        }

        return `${minutes}m ${remainingSeconds}s`;
    }

    /**
     * Get polling interval display text for UI
     * Returns "Polling interval: Xs" for override or "Polling interval: Auto (Xs)" for calculated
     */
    getPollingIntervalDisplayText(quotaSettings: QuotaSettings): string {
        const delay = this.calculateDelay(quotaSettings);
        if (delay === null) {
            return "Polling interval: Error";
        }

        const delayFormatted = this.formatDelay(delay);

        if (quotaSettings.overridePollingDelay && quotaSettings.customPollingDelaySeconds >= 0) {
            return `Polling interval: ${delayFormatted}`;
        }

        return `Polling interval: Auto (${delayFormatted})`;
    }

    /**
     * Record an API call and update quota usage
     * Automatically schedules a debounced save
     *
     * @param applicationId Application ID making the API call
     * @param endpoint API endpoint name for logging
     * @param cost Quota cost of the API call
     */
    recordApiCall(applicationId: string, endpoint: string, cost: number): void {
        this.checkAndResetIfNeeded(applicationId);

        let usage = this.quotaData.get(applicationId);
        if (!usage) {
            usage = {
                quotaUnitsUsed: 0,
                quotaResetTime: this.calculateNextMidnightPT(),
                lastUpdated: Date.now()
            };
            this.quotaData.set(applicationId, usage);
        }

        const oldUsage = usage.quotaUnitsUsed;
        usage.quotaUnitsUsed += cost;
        usage.lastUpdated = Date.now();

        logger.debug(`Quota recorded for application ${applicationId}: ${endpoint} (${cost} units), total: ${usage.quotaUnitsUsed}`);

        // Check for threshold crossings by looking up daily quota from application
        if (this.integration) {
            const application = this.integration.getApplicationManager().getApplication(applicationId);
            const dailyQuota = application?.quotaSettings?.dailyQuota;
            if (dailyQuota && dailyQuota > 0) {
                this.checkThresholdCrossings(applicationId, oldUsage, usage.quotaUnitsUsed, dailyQuota);
            }
        }

        this.scheduleSave();
    }

    /**
     * Check for threshold crossings and emit events
     */
    private checkThresholdCrossings(applicationId: string, oldUsage: number, newUsage: number, dailyQuota: number): void {
        const oldLevel = Math.floor((oldUsage * 100) / dailyQuota);
        const newLevel = Math.floor((newUsage * 100) / dailyQuota);

        if (newLevel > oldLevel) {
            // Look up application name from integration
            const application = this.integration?.getApplicationManager().getApplication(applicationId);
            const applicationName = application?.name ?? applicationId;

            // Clamp thresholds to maximum of 100
            const startThreshold = Math.max(1, oldLevel + 1);
            const endThreshold = Math.min(100, newLevel);

            // Check if automatic failover should be triggered
            const failoverEnabled = this.getSettings()?.advanced?.enableAutomaticFailover;
            const rawFailoverThreshold = this.getSettings()?.advanced?.automaticFailoverThreshold ?? FAILOVER_THRESHOLD_DEFAULT;
            const failoverThreshold = rawFailoverThreshold >= 0.5 && rawFailoverThreshold <= 100
                ? Math.round(rawFailoverThreshold)
                : rawFailoverThreshold;

            for (let threshold = startThreshold; threshold <= endThreshold; threshold++) {
                triggerQuotaThresholdCrossed({
                    applicationId,
                    applicationName,
                    quotaConsumed: newUsage,
                    quotaLimit: dailyQuota,
                    threshold
                });

                if (failoverEnabled && threshold === failoverThreshold) {
                    logger.info(`Failover threshold ${failoverThreshold}% reached for application ${applicationId}, attempting automatic failover`);
                    // Trigger failover (fire-and-forget - don't await, critical path continues)
                    this.integration?.attemptQuotaFailover(applicationId).catch((error: any) => {
                        logger.warn(`Automatic quota failover failed: ${error.message}`);
                    });
                }
            }
        }
    }

    /**
     * Get current quota usage for an application
     * Automatically checks and resets if midnight PT has passed
     *
     * @param applicationId Application ID
     * @returns Current quota usage or undefined if no data
     */
    getQuotaUsage(applicationId: string): QuotaUsage | undefined {
        this.checkAndResetIfNeeded(applicationId);
        return this.quotaData.get(applicationId);
    }

    /**
     * Calculate remaining quota for an application
     *
     * @param applicationId Application ID
     * @param dailyQuota Daily quota limit
     * @returns Remaining quota units
     */
    getQuotaRemaining(applicationId: string, dailyQuota: number): number {
        const usage = this.getQuotaUsage(applicationId);
        if (!usage) {
            return dailyQuota;
        }
        return Math.max(0, dailyQuota - usage.quotaUnitsUsed);
    }

    /**
     * Check if enough quota is available for an API call
     *
     * @param applicationId Application ID
     * @param cost Quota cost of the planned API call
     * @param dailyQuota Daily quota limit
     * @returns true if quota is available, false otherwise
     */
    isQuotaAvailable(applicationId: string, cost: number, dailyQuota: number): boolean {
        const remaining = this.getQuotaRemaining(applicationId, dailyQuota);
        const available = remaining >= cost;

        if (!available) {
            logger.warn(`Quota exhausted for application ${applicationId}. Requested: ${cost}, Available: ${remaining}`);
        }

        return available;
    }

    /**
     * Check if quota should be reset (midnight PT passed) and reset if needed
     *
     * @param applicationId Application ID
     */
    private checkAndResetIfNeeded(applicationId: string): void {
        const usage = this.quotaData.get(applicationId);
        if (!usage) {
            return;
        }

        const now = Date.now();

        if (now >= usage.quotaResetTime) {
            logger.info(`Resetting quota for application ${applicationId} (midnight PT passed)`);

            usage.quotaUnitsUsed = 0;
            usage.quotaResetTime = this.calculateNextMidnightPT();
            usage.lastUpdated = now;

            this.scheduleSave();
        }
    }

    /**
     * Calculate the next midnight Pacific Time timestamp
     *
     * @returns Unix timestamp (ms) of next midnight PT
     */
    private calculateNextMidnightPT(): number {
        const now = DateTime.now().setZone("America/Los_Angeles");
        const nextMidnight = now.plus({ days: 1 }).startOf("day");
        return nextMidnight.toMillis();
    }

    /**
     * Load quota data from persistent storage
     * If file doesn't exist or is corrupt, starts with empty state
     */
    private loadQuotaData(): void {
        try {
            const fs = require("fs");
            const quotaDataPath = getDataFilePath("quota-tracking.json");
            if (!fs.existsSync(quotaDataPath)) {
                logger.debug("Quota tracking file does not exist, starting with empty state");
                return;
            }

            const fileContents = fs.readFileSync(quotaDataPath, "utf-8");
            const storage: QuotaTrackingStorage = JSON.parse(fileContents);

            this.quotaData = new Map(Object.entries(storage));
            logger.info(`Loaded quota data for ${this.quotaData.size} application(s)`);
        } catch (error) {
            logger.error(`Failed to load quota tracking data: ${error instanceof Error ? error.message : String(error)}`);
            logger.info("Starting with empty quota state");
            this.quotaData = new Map();
        }
    }

    /**
     * Schedule a debounced save of quota data
     * Cancels any pending save and schedules a new one 5 seconds from now
     */
    private scheduleSave(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        this.saveTimer = setTimeout(() => {
            this.saveQuotaData();
            this.saveTimer = undefined;
        }, QuotaManager.SAVE_DEBOUNCE_MS);
    }

    /**
     * Immediately flush quota data to disk
     * Called on integration disconnect to ensure data is saved
     */
    flushQuotaData(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = undefined;
        }

        this.saveQuotaData();
    }

    /**
     * Perform the actual save of quota data to disk
     */
    private saveQuotaData(): void {
        try {
            const { fs, path } = firebot.modules;
            const quotaDataPath = getDataFilePath("quota-tracking.json");
            const storage: QuotaTrackingStorage = Object.fromEntries(this.quotaData);
            const data = JSON.stringify(storage, null, 2);

            const dir = path.dirname(quotaDataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(quotaDataPath, data, "utf-8");
            logger.debug("Quota tracking data saved");
        } catch (error) {
            logger.error(`Failed to save quota tracking data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get the integration settings
     * @returns Integration settings or undefined
     */
    getSettings(): any {
        return this.integration?.getSettings();
    }
}
