import { IntegrationConstants } from "../constants";
import { firebot, logger } from "../main";

export interface YouTubeFailoverEvent {
    previousApplicationId: string;
    applicationId: string;
    applicationName: string;
    quotaConsumed: number;
    quotaLimit: number;
    threshold: number;
}

export function triggerQuotaFailover(eventData: YouTubeFailoverEvent): void {
    const { eventManager } = firebot.modules;

    logger.debug(`Triggering quota-failover event`);

    eventManager.triggerEvent(
        IntegrationConstants.INTEGRATION_ID,
        "quota-failover",
        eventData as unknown as Record<string, unknown>
    );
}