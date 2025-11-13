/**
 * Event definitions for YouTube integration
 *
 * Defines the event source that Firebot will use to trigger effects
 * when YouTube chat messages are received.
 */

import { EventSource } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-manager";
import { IntegrationConstants } from "./constants";

/**
 * Causes for YouTube application activation
 */
export enum ApplicationActivationCause {
    USER_CLICKED = "User clicked",
    AUTHORIZED_FIRST_APPLICATION = "Authorized first application",
    CHANGED_BY_EFFECT = "Changed by effect"
}

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
 * YouTube application activated event metadata
 */
export interface YouTubeApplicationActivatedEvent {
    /**
     * The cause of the application activation
     */
    cause: ApplicationActivationCause | "";

    /**
     * The UUID of the application that became active
     */
    applicationId: string;

    /**
     * The name of the application that became active
     */
    applicationName: string;

    /**
     * Whether the YouTube integration is currently connected
     */
    connected: boolean;
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
        },
        {
            id: "application-activated",
            name: "Application Activated",
            description: "When a YouTube application becomes active",
            cached: false,
            manualMetadata: {
                cause: ApplicationActivationCause.USER_CLICKED,
                applicationId: "12345678-1234-1234-1234-123456789012",
                applicationName: "Example Application",
                connected: true
            }
        }
    ]
};
