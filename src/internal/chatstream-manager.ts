/**
 * ChatStream Manager - Production Implementation
 *
 * Responsibilities:
 * - Stream YouTube chat messages using chatStream gRPC API
 * - Respect quota-based polling delays
 * - Emit Firebot events for each message
 * - Handle quota exceeded errors
 * - Detect when stream ends
 */

import { ChatStreamClient } from './chatstream-client';
import { LiveChatMessage } from '../generated/proto/stream_list';
import { QuotaManager } from './quota-manager';
import { firebot } from '../main';
import { IntegrationConstants } from '../constants';
import { YouTubeChatMessageEvent } from '../events';

export class ChatStreamManager {
    private client: ChatStreamClient | null = null;
    private chatStreaming = false;
    private liveChatId: string | null = null;
    private accessToken: string | null = null;
    private logger: any;
    private quotaManager: QuotaManager;
    private pollingDelaySeconds = 0;
    private nextPollTimer: NodeJS.Timeout | null = null;
    private pageToken: string | undefined;

    constructor(logger: any, quotaManager: QuotaManager) {
        this.logger = logger;
        this.quotaManager = quotaManager;
    }

    /**
     * Start chat streaming for YouTube chat messages
     */
    async startChatStreaming(liveChatId: string, accessToken: string): Promise<void> {
        if (this.chatStreaming) {
            this.logger.warn("Already streaming, stopping previous stream first");
            await this.stopChatStreaming();
        }

        // Calculate polling delay
        const delay = this.quotaManager.calculateDelay();
        if (delay === null) {
            throw new Error("Invalid quota settings. Cannot calculate polling delay.");
        }

        this.pollingDelaySeconds = delay;
        this.liveChatId = liveChatId;
        this.accessToken = accessToken;
        this.client = new ChatStreamClient();
        this.chatStreaming = true;
        this.pageToken = undefined;

        this.logger.info(`Starting YouTube chat stream for: ${liveChatId}`);
        this.logger.info(`Polling delay: ${this.quotaManager.formatDelay(delay)}`);

        // Start first poll immediately
        this.scheduleNextPoll(0);
    }

    /**
     * Schedule the next poll after a delay
     */
    private scheduleNextPoll(delayMs: number): void {
        if (!this.chatStreaming) {
            return;
        }

        // Clear any existing timer
        if (this.nextPollTimer) {
            clearTimeout(this.nextPollTimer);
        }

        this.nextPollTimer = setTimeout(() => {
            this.pollOnce().catch((err) => {
                this.logger.error(`Poll error: ${err.message}`);

                // Check if it's a quota error
                if (this.quotaManager.isQuotaExceededError(err)) {
                    this.logger.error("Quota exceeded error detected");
                    this.chatStreaming = false;
                    // The integration-singleton will handle disconnection
                } else if (this.chatStreaming) {
                    // On other errors, retry after delay
                    this.logger.warn(`Retrying after error in ${this.pollingDelaySeconds}s...`);
                    this.scheduleNextPoll(this.pollingDelaySeconds * 1000);
                }
            });
        }, delayMs);
    }

    /**
     * Perform a single poll of the streamList API
     */
    private async pollOnce(): Promise<void> {
        if (!this.client || !this.liveChatId || !this.accessToken || !this.chatStreaming) {
            return;
        }

        // Each call is a new chatStreamList request
        for await (const response of this.client.chatStreamMessages(
            this.liveChatId,
            this.accessToken,
            { pageToken: this.pageToken }
        )) {
            if (!this.chatStreaming) {
                return;
            }

            this.logger.debug(`[ChatStreamList Poll] Messages: ${response.items?.length || 0}`);

            // Process messages
            if (response.items && response.items.length > 0) {
                for (const message of response.items) {
                    this.handleMessage(message);
                }
            }

            // Update page token for continuation
            if (response.nextPageToken) {
                this.pageToken = response.nextPageToken;
            }

            // Check if stream ended
            if (response.offlineAt) {
                this.logger.info("YouTube stream ended (offline)");
                this.chatStreaming = false;
                return;
            }
        }

        // Schedule next poll after delay
        if (this.chatStreaming) {
            this.logger.debug(`Scheduling next poll in ${this.pollingDelaySeconds}s`);
            this.scheduleNextPoll(this.pollingDelaySeconds * 1000);
        }
    }

    /**
     * Handle a single chat message
     * Emits Firebot event for each message
     */
    private handleMessage(message: LiveChatMessage): void {
        try {
            const username = message.authorDetails?.displayName || "Unknown";
            const text = message.snippet?.displayMessage ||
                        message.snippet?.textMessageDetails?.messageText ||
                        "[No text]";
            const messageType = this.getMessageType(message.snippet?.type);

            // Log to console
            this.logger.info(`[YouTube Chat] ${username}: ${text} (${messageType})`);

            // Create event metadata
            const eventData: YouTubeChatMessageEvent = {
                username,
                message: text,
                messageType,
                rawMessage: message
            };

            // Emit Firebot event
            const { eventManager } = firebot.modules;
            eventManager.triggerEvent(
                IntegrationConstants.INTEGRATION_ID,
                "chat-message",
                eventData as unknown as Record<string, unknown>
            );

        } catch (error: any) {
            this.logger.error(`Error handling message: ${error.message}`);
        }
    }

    /**
     * Get human-readable message type
     */
    private getMessageType(type?: number): string {
        const typeMap: Record<number, string> = {
            1: "text",
            15: "superChat",
            16: "superSticker",
            7: "newSponsor",
            17: "memberMilestone"
        };
        return type ? (typeMap[type] || "other") : "unknown";
    }

    /**
     * Stop chat streaming
     */
    async stopChatStreaming(): Promise<void> {
        this.logger.info("Stopping YouTube chat stream");
        this.chatStreaming = false;

        // Cancel any pending poll
        if (this.nextPollTimer) {
            clearTimeout(this.nextPollTimer);
            this.nextPollTimer = null;
        }

        this.client = null;
        this.liveChatId = null;
        this.accessToken = null;
        this.pageToken = undefined;
    }

    /**
     * Check if currently chat streaming
     */
    isChatStreaming(): boolean {
        return this.chatStreaming;
    }
}
