import { ApplicationActivationCause } from "../events";
import { triggerQuotaFailover } from "../events/failover";
import type { YouTubeIntegration } from "../integration-singleton";
import { logger } from "../main";
import type { YouTubeOAuthApplication } from "../types";
import { QuotaManager } from "./quota-manager";

export const FAILOVER_THRESHOLD_DEFAULT = 95;

/**
 * QuotaFailoverManager handles automatic failover to other YouTube applications when quota thresholds are reached
 *
 * Responsibilities:
 * - Monitor quota threshold crossings and trigger failover when enabled
 * - Select the best eligible application using deterministic tie-breaker logic
 * - Test applications via YouTube API polling before activation
 * - Prevent concurrent failover attempts
 * - Trigger events and notifications when failover occurs
 */
export class QuotaFailoverManager {
    private integration: YouTubeIntegration;
    private quotaManager: QuotaManager;
    private failoverInProgress = false;

    constructor(integration: YouTubeIntegration, quotaManager: QuotaManager) {
        this.integration = integration;
        this.quotaManager = quotaManager;
    }

    /**
     * Attempt automatic quota failover to another application
     * @param currentApplicationId The application whose quota threshold was crossed
     */
    async attemptQuotaFailover(currentApplicationId: string): Promise<void> {
        // Prevent concurrent execution - if failover is already in progress, disregard
        if (this.failoverInProgress) {
            logger.debug(`Failover already in progress, disregarding this request`);
            return;
        }

        // Check if failover is enabled
        const settings = this.integration.getSettings();
        if (!settings.advanced?.enableAutomaticFailover) {
            logger.debug("Automatic failover is disabled, skipping");
            return;
        }

        // Mark failover as in progress
        this.failoverInProgress = true;

        try {
            logger.info(`Attempting automatic quota failover from application ${currentApplicationId}`);

            // Step 1: Get all applications
            const applicationsMap = this.integration.getApplicationManager().getApplications();
            const applications = Object.values(applicationsMap);

            // Halt if there is no other application configured
            const otherApplications = applications.filter(app => app.id !== currentApplicationId);
            if (otherApplications.length === 0) {
                logger.info("No other applications configured, cannot failover");
                return;
            }

            // Step 2: Filter out applications at or above threshold
            const rawThreshold = settings.advanced?.automaticFailoverThreshold ?? FAILOVER_THRESHOLD_DEFAULT;
            const failoverThreshold = Math.max(1, Math.min(100, rawThreshold));
            const eligibleApplications: {app: YouTubeOAuthApplication, usagePercent: number, usage: any}[] = [];

            for (const app of otherApplications) {
                // Skip applications with 0 daily quota (prevent divide-by-zero)
                if (!app.quotaSettings.dailyQuota || app.quotaSettings.dailyQuota <= 0) {
                    logger.debug(`Skipping application ${app.name} (${app.id}): dailyQuota is 0 or less`);
                    continue;
                }

                const usage = this.quotaManager.getQuotaUsage(app.id);
                const usagePercent = usage ? Math.floor((usage.quotaUnitsUsed * 100) / app.quotaSettings.dailyQuota) : 0;

                // Filter out applications at or above the threshold
                if (usagePercent < failoverThreshold) {
                    eligibleApplications.push({ app, usagePercent, usage: usage || { quotaUnitsUsed: 0 } });
                }
            }

            if (eligibleApplications.length === 0) {
                logger.info("No eligible applications (all at or above threshold), cannot failover");
                return;
            }

            // Step 3: Sort by deterministic tie-breaker criteria
            eligibleApplications.sort((a, b) => {
                // 1. Lowest percentage of quota used
                const percentDiff = a.usagePercent - b.usagePercent;
                if (percentDiff !== 0) {
                    return percentDiff;
                }

                // 2. Largest daily quota total
                const quotaDiff = b.app.quotaSettings.dailyQuota - a.app.quotaSettings.dailyQuota;
                if (quotaDiff !== 0) {
                    return quotaDiff;
                }

                // 3. Case-insensitive application name
                const nameDiff = a.app.name.toLowerCase().localeCompare(b.app.name.toLowerCase());
                if (nameDiff !== 0) {
                    return nameDiff;
                }

                // 4. Application UUID (final tie-breaker)
                return a.app.id.localeCompare(b.app.id);
            });

            // Step 4: Try each application in order
            for (const { app, usagePercent: appUsagePercent, usage } of eligibleApplications) {
                logger.info(`Testing application ${app.name} (${app.id}) with ${appUsagePercent}% usage`);

                try {
                    // Get access token
                    const accessToken = await this.integration.getMultiAuthManager().getAccessToken(app.id);
                    if (!accessToken) {
                        logger.warn(`Failed to get access token for application ${app.name}`);
                        continue;
                    }

                    // Test by polling broadcast status
                    await this.integration.getBroadcastManager().findLiveBroadcast(
                        accessToken,
                        this.integration.getCurrentChannelId() ?? undefined,
                        app.id
                    );

                    // If poll succeeds, activate this application
                    logger.info(`Broadcast status poll succeeded for application ${app.name}, activating`);

                    // Activate the application
                    await this.integration.getApplicationManager().setActiveApplication(
                        app.id,
                        ApplicationActivationCause.AUTOMATIC_QUOTA_FAILOVER,
                        this.integration.isConnected()
                    );

                    // If the integration is connected, switch the active polling application
                    if (this.integration.isConnected() && this.integration.getCurrentActiveApplicationId()) {
                        await this.integration.switchActiveApplication(app.id);
                    }

                    logger.info(`Automatic quota failover successful: switched from ${currentApplicationId} to ${app.id}`);

                    // Trigger failover event with complete metadata
                    triggerQuotaFailover({
                        previousApplicationId: currentApplicationId,
                        applicationId: app.id,
                        applicationName: app.name,
                        quotaConsumed: usage.quotaUnitsUsed,
                        quotaLimit: app.quotaSettings.dailyQuota,
                        threshold: failoverThreshold
                    });

                    return;
                } catch (error: any) {
                    logger.warn(`Failed to test application ${app.name}: ${error.message}`);
                    continue;
                }
            }

            // Step 5: If no application succeeded, do nothing (never deactivate current)
            logger.warn("Automatic quota failover failed: no eligible application could complete the API call");
        } finally {
            // Always reset failover in progress flag
            this.failoverInProgress = false;
        }
    }
}
