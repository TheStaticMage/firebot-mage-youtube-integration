import { youtube_v3 as youtubeV3 } from "@googleapis/youtube";
import { OAuth2Client } from "google-auth-library";
import { logger } from "../main";
import { integration } from "../integration-singleton";

export class RestApiClient {
    private async getAuthClient(): Promise<OAuth2Client> {
        // Get active application
        const applicationsStorage = integration.getApplicationsStorage();
        const activeApplicationId = applicationsStorage.activeApplicationId;

        if (!activeApplicationId) {
            throw new Error("No active YouTube application configured");
        }

        const activeApp = applicationsStorage.applications[activeApplicationId];
        if (!activeApp) {
            throw new Error(`Active application "${activeApplicationId}" not found`);
        }

        // Get access token from MultiAuthManager
        const multiAuthManager = integration.getMultiAuthManager();
        const accessToken = await multiAuthManager.getAccessToken(activeApplicationId);

        if (!accessToken) {
            throw new Error(`No access token available for active application "${activeApp.name}"`);
        }

        const oauth2Client = new OAuth2Client(
            activeApp.clientId,
            activeApp.clientSecret
        );

        oauth2Client.setCredentials({
            // eslint-disable-next-line camelcase
            access_token: accessToken
        });

        return oauth2Client;
    }

    private async client(): Promise<youtubeV3.Youtube> {
        const authClient = await this.getAuthClient();
        const client = new youtubeV3.Youtube({
            auth: authClient
        });
        return client;
    }

    /**
     * Send a chat message to YouTube live chat
     * Handles all validation of active application, live chat state, and authentication
     * @param messageText The message text to send
     * @returns Promise<boolean> True if successful, false otherwise
     */
    async sendChatMessage(messageText: string): Promise<boolean> {
        try {
            // Validate active application exists and is ready
            const applicationsStorage = integration.getApplicationsStorage();
            const activeApplicationId = applicationsStorage.activeApplicationId;

            if (!activeApplicationId) {
                logger.error("Cannot send YouTube chat message: No active application selected");
                return false;
            }

            const activeApp = applicationsStorage.applications[activeApplicationId];
            if (!activeApp || !activeApp.ready) {
                logger.error(
                    `Cannot send YouTube chat message: Active application "${activeApp?.name || activeApplicationId}" is not ready`
                );
                return false;
            }

            // Get current live chat ID
            const liveChatId = integration.getCurrentLiveChatId();
            if (!liveChatId) {
                logger.error("Cannot send YouTube chat message: No active live chat");
                return false;
            }

            logger.debug(`Sending YouTube chat message to chat ${liveChatId}: ${messageText}`);
            const client = await this.client();
            const response = await client.liveChatMessages.insert({
                part: ["snippet"],
                requestBody: {
                    snippet: {
                        liveChatId: liveChatId,
                        type: "textMessageEvent",
                        textMessageDetails: {
                            messageText: messageText
                        }
                    }
                }
            });

            if (response.status === 200) {
                logger.debug(`Successfully sent YouTube chat message. Message ID: ${response.data.id}`);
                return true;
            }
            logger.error(`Failed to send YouTube chat message. Status: ${response.status}`);
            return false;

        } catch (error: any) {
            logger.error(`Error sending YouTube chat message: ${error}`);
            if (error.response?.data) {
                logger.error(`YouTube API error details: ${JSON.stringify(error.response.data)}`);
            }
            return false;
        }
    }
}
