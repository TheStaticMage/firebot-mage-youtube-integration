/**
 * YouTube LiveChatMessages ChatStream Client
 *
 * This client implements the gRPC-based chatStreamList method for real-time
 * YouTube live chat message streaming.
 */

import * as grpc from '@grpc/grpc-js';
import { IntegrationConstants, YouTubeMessageTypes, YouTubeMessageTypeStrings } from '../constants';
import { LiveChatMessage, LiveChatMessageListRequest, LiveChatMessageListResponse, V3DataLiveChatMessageServiceClient } from '../generated/proto/stream_list';
import type { YouTubeIntegration } from '../integration-singleton';
import { firebot, logger } from '../main';
import { QUOTA_COSTS } from '../types/quota-tracking';
import { ApiCallType } from './error-constants';
import { ErrorTracker } from './error-tracker';

export class ChatStreamClient {
    private client: V3DataLiveChatMessageServiceClient;
    private integration: YouTubeIntegration;
    private errorTracker: ErrorTracker;

    constructor(integration: YouTubeIntegration, errorTracker: ErrorTracker) {
        // Create SSL credentials for secure connection
        const credentials = grpc.credentials.createSsl();
        this.client = new V3DataLiveChatMessageServiceClient(
            'youtube.googleapis.com:443',
            credentials
        );
        this.integration = integration;
        this.errorTracker = errorTracker;
        logger.info('ChatStreamClient initialized successfully');
    }

    /**
     * Chat stream live chat messages from YouTube
     *
     * @param applicationId - YouTube application ID for quota tracking
     * @param liveChatId - The live chat ID to stream from
     * @param accessToken - OAuth 2.0 access token
     * @param dailyQuota - Daily quota limit for the application
     * @param options - Optional parameters (maxResults, pageToken, etc.)
     */
    async *chatStreamMessages(
        applicationId: string,
        liveChatId: string,
        accessToken: string,
        dailyQuota: number,
        options: {
            maxResults?: number;
            pageToken?: string;
            profileImageSize?: number;
            hl?: string;
        } = {}
    ): AsyncGenerator<LiveChatMessageListResponse, void, unknown> {
        // Build the request using generated types
        const request: LiveChatMessageListRequest = {
            liveChatId,
            part: ['id', 'snippet', 'authorDetails'],
            maxResults: options.maxResults || 20,
            pageToken: options.pageToken,
            profileImageSize: options.profileImageSize,
            hl: options.hl
        };

        // Create metadata with authorization
        const metadata = new grpc.Metadata();
        metadata.add('authorization', `Bearer ${accessToken}`);

        logger.debug(`[chatStreamMessages] Starting StreamList request... Live Chat ID: ${liveChatId}`);

        // Make the streaming RPC call using generated client
        const stream = this.client.streamList(request, metadata);

        // Record quota consumption for tracking purposes
        const quotaManager = this.integration.getQuotaManager();
        quotaManager.recordApiCall(applicationId, 'streamList', QUOTA_COSTS.STREAM_LIST);

        // Track whether an error occurred to prevent recording success after error
        let errorOccurred = false;

        // Handle stream events
        stream.on('error', async (error: Error) => {
            errorOccurred = true;
            logger.error(`[chatStreamMessages] error: ${error.message}`);
            const errorMetadata = this.errorTracker.recordError(ApiCallType.STREAM_CHAT_MESSAGES, error);
            const { eventManager } = firebot.modules;
            eventManager.triggerEvent(
                IntegrationConstants.INTEGRATION_ID,
                "api-error",
                errorMetadata as unknown as Record<string, unknown>
            );
        });

        stream.on('end', () => {
            logger.debug('[chatStreamMessages] chat stream ended');
            if (!errorOccurred) {
                this.errorTracker.recordSuccess(ApiCallType.STREAM_CHAT_MESSAGES);
            }
        });

        // Yield responses as they arrive
        for await (const response of stream as AsyncIterable<LiveChatMessageListResponse>) {
            this.errorTracker.recordSuccess(ApiCallType.STREAM_CHAT_MESSAGES);
            yield response;
        }
    }

    /**
     * Get message type as string
     */
    static getMessageTypeString(type?: number): string {
        if (type === undefined) {
            return 'UNKNOWN';
        }
        return YouTubeMessageTypeStrings[type as keyof typeof YouTubeMessageTypeStrings] || 'UNKNOWN';
    }

    /**
     * Format message for display
     */
    static formatMessage(message: LiveChatMessage): string {
        const author = message.authorDetails?.displayName || 'Unknown';
        const type = this.getMessageTypeString(message.snippet?.type);
        const text = message.snippet?.displayMessage ||
                    message.snippet?.textMessageDetails?.messageText ||
                    '[No text]';

        return `[${type}] ${author}: ${text}`;
    }
    /**
     * Check if message is a regular text message
     */
    static isTextMessage(message: LiveChatMessage): boolean {
        return Number(message.snippet?.type) === YouTubeMessageTypes.TEXT_MESSAGE_EVENT;
    }
}
