/**
 * Viewer Arrived Event Handler
 *
 * Triggers when a viewer chats for the first time in a stream.
 */

import { FirebotChatMessage } from "@crowbartools/firebot-custom-scripts-types/types/chat";
import { IntegrationConstants } from "../constants";
import { firebot, logger } from "../main";

/**
 * Trigger viewer arrived event
 */
export function triggerViewerArrived(
    username: string,
    userId: string,
    userDisplayName: string,
    messageText: string,
    chatMessage: FirebotChatMessage
): void {
    const { eventManager } = firebot.modules;

    const metadata = {
        eventSource: {
            id: IntegrationConstants.INTEGRATION_ID
        },
        platform: "youtube",
        username: username,
        userId: userId,
        userDisplayName: userDisplayName,
        messageText: messageText,
        chatMessage: chatMessage
    };

    logger.debug(`Triggering viewer-arrived event for user: ${userDisplayName} (${userId})`);

    eventManager.triggerEvent(
        IntegrationConstants.INTEGRATION_ID,
        "viewer-arrived",
        metadata as unknown as Record<string, unknown>
    );
}
