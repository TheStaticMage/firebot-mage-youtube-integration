import { youtube_v3 as youtubeV3 } from "@googleapis/youtube";
import { OAuth2Client } from "google-auth-library";
import { logger } from "../main";
import { integration } from "../integration-singleton";

export class RestApiClient {
    private async getAuthClient(): Promise<OAuth2Client> {
        const authManager = integration.getAuthManager();
        const accessToken = await authManager.getAccessToken();
        const settings = integration.getSettings();

        if (!accessToken) {
            throw new Error("No access token available for YouTube API authentication");
        }

        const oauth2Client = new OAuth2Client(
            settings.googleApp.clientId,
            settings.googleApp.clientSecret
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
     * @param liveChatId The live chat ID to send the message to
     * @param messageText The message text to send
     * @returns Promise<boolean> True if successful, false otherwise
     */
    async sendChatMessage(
        liveChatId: string,
        messageText: string
    ): Promise<boolean> {
        try {
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
