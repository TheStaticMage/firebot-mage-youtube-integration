import { IntegrationData, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { EventEmitter } from "events";
import { IntegrationConstants } from "./constants";
import { firebot, logger } from "./main";

type IntegrationParameters = {
    googleApp: {
        clientId: string;
        clientSecret: string;
        channelId: string;
    };
    accounts: {
        authorizeStreamerAccount: unknown;
    };
    chat: {
        chatFeed: boolean;
    };
    triggerTwitchEvents: {
        chatMessage: boolean;
    };
    logging: {
        logChatPushes: boolean;
        logApiResponses: boolean;
    };
    advanced: {
        suppressChatFeedNotifications: boolean;
    };
};

export class YouTubeIntegration extends EventEmitter {
    // connected needs to be set to true when the integration is successfully
    // connected. The Firebot integration manager checks this variable directly
    // rather than using a method.
    connected = false;

    private settings: IntegrationParameters = {
        googleApp: {
            clientId: "",
            clientSecret: "",
            channelId: ""
        },
        accounts: {
            authorizeStreamerAccount: null
        },
        chat: {
            chatFeed: true
        },
        triggerTwitchEvents: {
            chatMessage: false
        },
        logging: {
            logChatPushes: false,
            logApiResponses: false
        },
        advanced: {
            suppressChatFeedNotifications: false
        }
    };

    // Whether to insert YT chat messages into the Firebot chat dashboard.
    private chatFeed = true;

    init(_linked: boolean, _integrationData: IntegrationData<IntegrationParameters>) {
        logger.info("YouTube integration initializing...");
    }

    async connect() {
        // Stubbed connect for YouTubeIntegration
        this.connected = true;
        this.emit("connected", IntegrationConstants.INTEGRATION_ID);
    }

    async disconnect() {
        logger.debug("YouTube integration disconnecting...");
        this.emit("disconnecting", IntegrationConstants.INTEGRATION_ID);
        this.connected = false;
        this.emit("disconnected", IntegrationConstants.INTEGRATION_ID);
        logger.info("YouTube integration disconnected.");
    }

    async onUserSettingsUpdate(integrationData: IntegrationData<IntegrationParameters>) {
        if (integrationData.userSettings) {
            logger.debug("YouTube integration user settings updated.");
            this.settings = JSON.parse(JSON.stringify(integrationData.userSettings));
        }
    }

    isChatFeedEnabled(): boolean {
        return this.settings.chat.chatFeed;
    }

    getModules(): ScriptModules {
        return firebot.modules;
    }

    getSettings(): IntegrationParameters {
        return this.settings;
    }

    sendCriticalErrorNotification(message: string) {
        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("error", `YouTube Integration: ${message}`);
        logger.info(`Pop-up critical notification sent: ${JSON.stringify(message)}`);
    }

    sendChatFeedErrorNotification(message: string) {
        if (this.settings.advanced.suppressChatFeedNotifications) {
            logger.warn(`Chat feed notifications suppressed. Not sending this message: ${JSON.stringify(message)}`);
            return;
        }

        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("chatUpdate", {
            fbEvent: "ChatAlert",
            message: `YouTube Integration: ${message}`,
            icon: "fas fa-exclamation-triangle"
        });
        logger.info(`Chat feed notification sent: ${JSON.stringify(message)}`);
    }


    // No integration data file logic for YouTubeIntegration
}

export const integration = new YouTubeIntegration();
