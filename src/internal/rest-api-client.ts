import { youtube_v3 as youtubeV3 } from "@googleapis/youtube";
import { OAuth2Client } from "google-auth-library";
import { IntegrationConstants } from "../constants";
import type { YouTubeIntegration } from "../integration-singleton";
import { firebot, logger } from "../main";
import { QUOTA_COSTS } from "../types/quota-tracking";
import { chunkMessage } from "../util/message-chunker";
import { ApiCallType } from "./error-constants";
import { ErrorTracker } from "./error-tracker";

export class RestApiClient {
    private integration: YouTubeIntegration;
    private errorTracker: ErrorTracker;

    constructor(integration: YouTubeIntegration, errorTracker: ErrorTracker) {
        this.integration = integration;
        this.errorTracker = errorTracker;
    }

    private async getAuthClient(): Promise<OAuth2Client> {
        // Get active application
        const applicationsStorage = this.integration.getApplicationsStorage();
        const activeApplicationId = applicationsStorage.activeApplicationId;

        if (!activeApplicationId) {
            throw new Error("No active YouTube application configured");
        }

        const activeApp = applicationsStorage.applications[activeApplicationId];
        if (!activeApp) {
            throw new Error(`Active application "${activeApplicationId}" not found`);
        }

        // Get access token from MultiAuthManager
        const multiAuthManager = this.integration.getMultiAuthManager();
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
            const applicationsStorage = this.integration.getApplicationsStorage();
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
            const liveChatId = this.integration.getCurrentLiveChatId();
            if (!liveChatId) {
                logger.error("Cannot send YouTube chat message: No active live chat");
                return false;
            }

            // Chunk the message if it exceeds the character limit
            const chunks = chunkMessage(messageText, IntegrationConstants.YOUTUBE_CHAT_MESSAGE_CHARACTER_LIMIT);

            if (chunks.length > 1) {
                logger.debug(`Chunking message into ${chunks.length} parts (original length: ${messageText.length})`);
            }

            const client = await this.client();
            const quotaManager = this.integration.getQuotaManager();

            // Send each chunk
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                logger.debug(`Sending YouTube chat message chunk ${i + 1}/${chunks.length} to chat ${liveChatId}`);

                const response = await client.liveChatMessages.insert({
                    part: ["snippet"],
                    requestBody: {
                        snippet: {
                            liveChatId: liveChatId,
                            type: "textMessageEvent",
                            textMessageDetails: {
                                messageText: chunk
                            }
                        }
                    }
                });

                // Record quota consumption for each chunk
                quotaManager.recordApiCall(activeApplicationId, 'liveChatMessages.insert', QUOTA_COSTS.LIVE_CHAT_MESSAGES_INSERT);

                if (response.status === 200) {
                    logger.debug(`Successfully sent chunk ${i + 1}/${chunks.length}. Message ID: ${response.data.id}`);
                    this.errorTracker.recordSuccess(ApiCallType.SEND_CHAT_MESSAGE);
                } else {
                    // If any chunk fails, stop sending remaining chunks
                    const error = new Error(`Failed to send chunk ${i + 1}/${chunks.length}. Status: ${response.status}`);
                    (error as any).status = response.status;
                    const errorMetadata = this.errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, error);
                    logger.error(`Failed to send chunk ${i + 1}/${chunks.length}. Status: ${response.status}`);

                    const { eventManager } = firebot.modules;
                    eventManager.triggerEvent(
                        IntegrationConstants.INTEGRATION_ID,
                        "api-error",
                        errorMetadata as unknown as Record<string, unknown>
                    );

                    return false;
                }
            }

            logger.debug(`Successfully sent all ${chunks.length} chunk(s)`);
            return true;

        } catch (error: any) {
            const errorMetadata = this.errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, error);
            logger.error(`Error sending YouTube chat message: ${error}`);
            if (error.response?.data) {
                logger.error(`YouTube API error details: ${JSON.stringify(error.response.data)}`);
            }

            const { eventManager } = firebot.modules;
            eventManager.triggerEvent(
                IntegrationConstants.INTEGRATION_ID,
                "api-error",
                errorMetadata as unknown as Record<string, unknown>
            );

            return false;
        }
    }
}
