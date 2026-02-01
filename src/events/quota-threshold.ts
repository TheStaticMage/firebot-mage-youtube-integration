/**
 * Quota Threshold Crossed Event
 *
 * Triggers when quota usage crosses percentage thresholds (1-100%).
 */

import { IntegrationConstants } from "../constants";
import { firebot, logger } from "../main";

/**
 * YouTube quota threshold crossed event metadata
 */
export interface YouTubeQuotaThresholdCrossedEvent {
    /**
     * The UUID of the application whose quota crossed the threshold
     */
    applicationId: string;

    /**
     * The display name of the application
     */
    applicationName: string;

    /**
     * The current quota units consumed
     */
    quotaConsumed: number;

    /**
     * The total quota limit (daily quota)
     */
    quotaLimit: number;

    /**
     * The threshold percentage that was crossed (1-100)
     */
    threshold: number;
}

/**
 * Trigger quota threshold crossed event
 */
export function triggerQuotaThresholdCrossed(eventData: YouTubeQuotaThresholdCrossedEvent): void {
    const { eventManager } = firebot.modules;

    logger.debug(`Triggering quota-threshold-crossed event for application ${eventData.applicationId}, threshold ${eventData.threshold}`);

    eventManager.triggerEvent(
        IntegrationConstants.INTEGRATION_ID,
        "quota-threshold-crossed",
        eventData as unknown as Record<string, unknown>
    );
}
