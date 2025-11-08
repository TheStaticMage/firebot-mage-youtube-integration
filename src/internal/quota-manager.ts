/**
 * QuotaManager calculates intelligent polling delays to stay within YouTube API quota limits
 *
 * Responsibilities:
 * - Calculate delay between streamList calls based on quota settings
 * - Consider daily quota budget and maximum stream duration
 * - Target 80% quota usage to leave buffer for other API calls
 * - Support manual override of calculated delays
 */

import { logger } from "../main";
import { integration } from "../integration-singleton";

export class QuotaManager {
    /**
     * Cost in quota units for a single liveChatMessages.list call
     * According to YouTube Data API v3 quota costs:
     * https://developers.google.com/youtube/v3/determine_quota_cost
     */
    private static readonly CHAT_LIST_COST = 5;

    /**
     * Target percentage of daily quota to use for chat polling
     * Leaves 20% buffer for other operations
     */
    private static readonly QUOTA_TARGET_PERCENT = 0.8;

    /**
     * Calculate the delay in seconds between streamList calls
     *
     * @returns delay in seconds, or null if settings are invalid
     */
    calculateDelay(): number | null {
        const settings = integration.getSettings();

        // Check if user has overridden the delay
        if (settings.quota.overridePollingDelay && settings.quota.customPollingDelaySeconds > 0) {
            logger.info(`Using custom polling delay: ${settings.quota.customPollingDelaySeconds}s`);
            return settings.quota.customPollingDelaySeconds;
        }

        const dailyQuota = settings.quota.dailyQuota;
        const maxStreamHours = settings.quota.maxStreamHours;

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
        const quotaBudget = dailyQuota * QuotaManager.QUOTA_TARGET_PERCENT;
        const maxCallsPerDay = quotaBudget / QuotaManager.CHAT_LIST_COST;
        const callsPerHour = maxCallsPerDay / maxStreamHours;
        const delaySeconds = 3600 / callsPerHour;

        logger.debug(`Quota calculation:
  Daily quota: ${dailyQuota}
  Max stream hours: ${maxStreamHours}
  Quota budget (80%): ${quotaBudget}
  Max calls per day: ${maxCallsPerDay}
  Calls per hour: ${callsPerHour.toFixed(2)}
  Calculated delay: ${delaySeconds.toFixed(2)}s`);

        return Math.round(delaySeconds);
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
    formatDelay(seconds: number): string {
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
}
