/**
 * Stream Online/Offline Event Handlers
 *
 * Triggers when YouTube stream status changes (online to offline or offline to online).
 */

import { IntegrationConstants } from "../constants";
import { firebot, logger } from "../main";

/**
 * Trigger stream online event
 */
export function triggerStreamOnline(): void {
    const { eventManager } = firebot.modules;

    logger.debug("Triggering stream-online event");

    eventManager.triggerEvent(
        IntegrationConstants.INTEGRATION_ID,
        "stream-online",
        {} as unknown as Record<string, unknown>
    );
}

/**
 * Trigger stream offline event
 */
export function triggerStreamOffline(): void {
    const { eventManager } = firebot.modules;

    logger.debug("Triggering stream-offline event");

    eventManager.triggerEvent(
        IntegrationConstants.INTEGRATION_ID,
        "stream-offline",
        {} as unknown as Record<string, unknown>
    );
}
