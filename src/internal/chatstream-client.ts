/**
 * YouTube LiveChatMessages ChatStream Client
 *
 * This client implements the gRPC-based chatStreamList method for real-time
 * YouTube live chat message streaming.
 */

import * as grpc from '@grpc/grpc-js';
import { LiveChatMessage, LiveChatMessageListRequest, LiveChatMessageListResponse, V3DataLiveChatMessageServiceClient } from '../generated/proto/stream_list';
import { YouTubeMessageTypes, YouTubeMessageTypeStrings } from '../constants';
import { logger } from '../main';
import type { YouTubeIntegration } from '../integration-singleton';
import { QUOTA_COSTS } from '../types/quota-tracking';

export class ChatStreamClient {
    private client: V3DataLiveChatMessageServiceClient;
    private integration: YouTubeIntegration;

    constructor(integration: YouTubeIntegration) {
        // Create SSL credentials for secure connection
        const credentials = grpc.credentials.createSsl();
        this.client = new V3DataLiveChatMessageServiceClient(
            'youtube.googleapis.com:443',
            credentials
        );
        this.integration = integration;
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

        // Handle stream events
        stream.on('error', (error: Error) => {
            logger.error(`[chatStreamMessages] error: ${error.message}`);
        });

        stream.on('end', () => {
            logger.debug('[chatStreamMessages] chat stream ended');
        });

        // Yield responses as they arrive
        for await (const response of stream as AsyncIterable<LiveChatMessageListResponse>) {
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
