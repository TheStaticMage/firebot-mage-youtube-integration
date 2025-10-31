/**
 * Event definitions for YouTube integration
 *
 * Defines the event source that Firebot will use to trigger effects
 * when YouTube chat messages are received.
 */

import { EventSource } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-manager";
import { IntegrationConstants } from "./constants";

/**
 * YouTube chat message event metadata
 *
 * Simplified event data containing just the essential information.
 * Does NOT conform to FirebotChatMessage yet - that will come later.
 */
export interface YouTubeChatMessageEvent {
    /**
     * Display name of the message author
     */
    username: string;

    /**
     * The message text content
     */
    message: string;

    /**
     * The type of message (text, superChat, superSticker, etc.)
     */
    messageType: string;

    /**
     * The raw YouTube message object for advanced filtering
     */
    rawMessage: any;
}

/**
 * Event source definition for YouTube integration
 *
 * This registers with Firebot's event system and allows users to
 * create triggers based on YouTube chat messages.
 */
export const YouTubeEventSource: EventSource = {
    id: IntegrationConstants.INTEGRATION_ID,
    name: "YouTube",
    events: [
        {
            id: "chat-message",
            name: "Chat Message",
            description: "When a message is sent in YouTube live chat",
            cached: false,
            manualMetadata: {
                username: "ExampleUser",
                message: "Hello from YouTube!",
                messageType: "text"
            }
        }
    ]
};
