/**
 * YouTube LiveChatMessages ChatStream Client
 *
 * This client implements the gRPC-based chatStreamList method for real-time
 * YouTube live chat message streaming.
 */

import * as grpc from '@grpc/grpc-js';
import { LiveChatMessage, LiveChatMessageListRequest, LiveChatMessageListResponse, LiveChatMessageSnippet_TypeWrapper_Type as MessageType, V3DataLiveChatMessageServiceClient } from '../generated/proto/stream_list';
import { logger } from '../main';

export class ChatStreamClient {
    private client: V3DataLiveChatMessageServiceClient;

    constructor() {
        // Create SSL credentials for secure connection
        const credentials = grpc.credentials.createSsl();
        this.client = new V3DataLiveChatMessageServiceClient(
            'youtube.googleapis.com:443',
            credentials
        );
        logger.info('ChatStreamClient initialized successfully');
    }

    /**
     * Chat stream live chat messages from YouTube
     *
     * @param liveChatId - The live chat ID to stream from
     * @param accessToken - OAuth 2.0 access token
     * @param options - Optional parameters (maxResults, pageToken, etc.)
     */
    async *chatStreamMessages(
        liveChatId: string,
        accessToken: string,
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

        logger.debug('Starting StreamList request...');
        logger.debug(`Live Chat ID: ${liveChatId}`);
        logger.debug(`Request: ${JSON.stringify(request, null, 2)}`);

        // Make the streaming RPC call using generated client
        const stream = this.client.streamList(request, metadata);

        // Handle stream events
        stream.on('error', (error: Error) => {
            logger.error(`Stream error: ${error.message}`);
        });

        stream.on('end', () => {
            logger.info('Stream ended');
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
        return MessageType[type] !== undefined ? MessageType[type] : 'UNKNOWN';
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
        return message.snippet?.type === MessageType.TEXT_MESSAGE_EVENT;
    }
}
