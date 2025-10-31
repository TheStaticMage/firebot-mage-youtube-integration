import { IntegrationDefinition } from "@crowbartools/firebot-custom-scripts-types";
import { IntegrationConstants } from "./constants";

export { integration } from './integration-singleton';

export const definition: IntegrationDefinition = {
    id: IntegrationConstants.INTEGRATION_ID,
    name: IntegrationConstants.INTEGRATION_NAME,
    description: IntegrationConstants.INTEGRATION_DESCRIPTION,
    connectionToggle: true,
    configurable: true,
    linkType: "none", // Firebot doesn't support PKCE yet, so we use 'none' for now.
    settingCategories: {
        googleApp: {
            title: "Google Application Settings",
            sortRank: 1,
            settings: {
                clientId: {
                    title: "Google Client ID",
                    tip: "The Client ID for your Google application.",
                    type: "string",
                    default: "",
                    sortRank: 1
                },
                clientSecret: {
                    title: "Google Client Secret",
                    tip: "The Client Secret for your Google application.",
                    type: "string",
                    default: "",
                    sortRank: 2
                },
                channelId: {
                    title: "YouTube Channel",
                    tip: "Your YouTube channel name. Only needed if your Google account maps to multiple channels. See documentation.",
                    type: "string",
                    default: "",
                    sortRank: 3
                }
            }
        },
        accounts: {
            title: "Accounts",
            sortRank: 2,
            settings: {
                authorizeStreamerAccount: {
                    title: "Authorize Streamer Account",
                    tip: `Open this URL in a browser window to authorize the streamer account: http://localhost:7472/integrations/${IntegrationConstants.INTEGRATION_URI}/link/streamer`,
                    type: "unknown",
                    sortRank: 1
                }
            }
        },
        chat: {
            title: "Chat Settings",
            sortRank: 3,
            settings: {
                chatFeed: {
                    title: "Chat Feed",
                    tip: "Add YouTube chat messages to the Firebot chat dashboard.",
                    type: "boolean",
                    default: true,
                    sortRank: 1
                }
            }
        },
        triggerTwitchEvents: {
            title: "Trigger Twitch Events",
            sortRank: 4,
            settings: {
                chatMessage: {
                    title: "Chat Message",
                    tip: "Trigger the 'Twitch:Chat Message' event when someone chats on YouTube",
                    type: "boolean",
                    default: false
                }
            }
        },
        logging: {
            title: "Logging Settings",
            sortRank: 98,
            settings: {
                logChatPushes: {
                    title: "Log Chat Pushes",
                    tip: "Log all chat pushes received from YouTube to the Firebot log. Useful for debugging.",
                    type: "boolean",
                    default: false,
                    sortRank: 1
                },
                logApiResponses: {
                    title: "Log API Calls and Responses",
                    tip: "Log all API calls and responses to/from YouTube to the Firebot log. Useful for debugging.",
                    type: "boolean",
                    default: false,
                    sortRank: 2
                }
            }
        },
        advanced: {
            title: "Advanced Settings",
            sortRank: 99,
            settings: {
                suppressChatFeedNotifications: {
                    title: "Suppress Chat Feed Notifications",
                    tip: "Check this box to suppress chat feed notifications from the YouTube integration. This means you will not be informed of any connection issues or errors unless you are actively monitoring the Firebot log files.",
                    type: "boolean",
                    default: false,
                    sortRank: 1
                }
            }
        }
    }
};
