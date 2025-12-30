/**
 * Chat Manager - YouTube chat streaming and message handling
 *
 * Responsibilities:
 * - Stream YouTube chat messages using gRPC API
 * - Respect quota-based polling delays
 * - Emit Firebot events for each message
 * - Handle quota exceeded errors
 * - Detect when stream ends
 *
 * Supports multiple client implementations:
 * - ChatStreamClient: Real-time streaming via ChatStream gRPC API
 */

import { IntegrationConstants } from '../constants';
import { YouTubeMessageTypeStrings } from '../constants';
import { FirebotChatHelpers, mapYouTubeChatMessageToChat } from '../events/chat-message-sent';
import { triggerViewerArrived } from '../events/viewer-arrived';
import { LiveChatMessage } from '../generated/proto/stream_list';
import { firebot } from '../main';
import { YouTubeUser } from '../types';
import { QuotaManager } from './quota-manager';
import { commandHandler } from './command';
import type { YouTubeIntegration } from '../integration-singleton';

export class ChatManager {
    private client: any = null;
    private isStreaming = false;
    private liveChatId: string | null = null;
    private accessToken: string | null = null;
    private logger: any;
    private quotaManager: QuotaManager;
    private pollingDelaySeconds = 0;
    private nextPollTimer: NodeJS.Timeout | null = null;
    private pageToken: string | undefined;
    private clientFactory: () => any;
    private integration: YouTubeIntegration;
    private activeApplicationId = '';
    private dailyQuota = 10000;
    private connectionTimestamp: Date | null = null;
    private viewerArrivedCache = new Set<string>();

    constructor(logger: any, quotaManager: QuotaManager, clientFactory: () => any, integration: YouTubeIntegration) {
        this.logger = logger;
        this.quotaManager = quotaManager;
        this.clientFactory = clientFactory;
        this.integration = integration;
    }

    /**
     * Start chat streaming for YouTube chat messages
     */
    async startChatStreaming(liveChatId: string, accessToken: string): Promise<void> {
        if (this.isStreaming) {
            this.logger.warn("Already streaming, stopping previous stream first");
            await this.stopChatStreaming();
        }

        // Get active application's quota settings
        const applicationsStorage = this.integration.getApplicationsStorage();
        if (!applicationsStorage.activeApplicationId) {
            throw new Error("No active application set");
        }

        const activeApplication = applicationsStorage.applications[applicationsStorage.activeApplicationId];
        if (!activeApplication) {
            throw new Error("Active application not found");
        }

        // Calculate polling delay
        const delay = this.quotaManager.calculateDelay(activeApplication.quotaSettings);
        if (delay === null) {
            throw new Error("Invalid quota settings. Cannot calculate polling delay.");
        }

        this.pollingDelaySeconds = delay;
        this.liveChatId = liveChatId;
        this.accessToken = accessToken;
        this.activeApplicationId = applicationsStorage.activeApplicationId;
        this.dailyQuota = activeApplication.quotaSettings.dailyQuota;
        this.client = this.clientFactory();
        this.isStreaming = true;
        this.pageToken = undefined;
        this.connectionTimestamp = new Date();

        this.logger.info(`Starting YouTube chat stream for: ${liveChatId}`);
        this.logger.info(`Polling delay: ${this.quotaManager.formatDelay(delay)}`);

        // Start first poll immediately
        this.scheduleNextPoll(0);
    }

    /**
     * Schedule the next poll after a delay
     */
    private scheduleNextPoll(delayMs: number): void {
        if (!this.isStreaming) {
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
                    this.isStreaming = false;
                    // The integration-singleton will handle disconnection
                } else if (this.isStreaming) {
                    // On other errors, retry after delay
                    this.logger.warn(`Retrying after error in ${this.pollingDelaySeconds}s...`);
                    this.scheduleNextPoll(this.pollingDelaySeconds * 1000);
                }
            });
        }, delayMs);
    }

    /**
     * Perform a single poll of the chat API
     */
    private async pollOnce(): Promise<void> {
        if (!this.client || !this.liveChatId || !this.accessToken || !this.isStreaming) {
            return;
        }

        // Each call is a new chat API request
        for await (const response of this.client.chatStreamMessages(
            this.activeApplicationId,
            this.liveChatId,
            this.accessToken,
            this.dailyQuota,
            { pageToken: this.pageToken }
        )) {
            if (!this.isStreaming) {
                return;
            }

            this.logger.debug(`[Chat Poll] Messages: ${response.items?.length || 0}`);

            // Process messages
            if (response.items && response.items.length > 0) {
                for (const message of response.items) {
                    await this.handleMessage(message);
                }
            }

            // Update page token for continuation
            if (response.nextPageToken) {
                this.pageToken = response.nextPageToken;
            }

            // Check if stream ended
            if (response.offlineAt) {
                this.logger.info("YouTube stream ended (offline)");
                this.isStreaming = false;
                return;
            }
        }

        // Schedule next poll after delay
        if (this.isStreaming) {
            this.logger.debug(`Scheduling next poll in ${this.pollingDelaySeconds}s`);
            this.scheduleNextPoll(this.pollingDelaySeconds * 1000);
        }
    }

    /**
     * Handle a single chat message
     * Processes message and emits Firebot event
     */
    async handleMessage(message: LiveChatMessage): Promise<void> {
        try {
            const messageText = message.snippet?.displayMessage ||
                        message.snippet?.textMessageDetails?.messageText ||
                        "";
            const messageType = this.getMessageType(message.snippet?.type);

            // Only process text messages for now
            if (messageType !== "text" || !messageText) {
                return;
            }

            // Filter out messages posted before the connection timestamp
            if (message.snippet?.publishedAt && this.connectionTimestamp) {
                const publishedTime = new Date(message.snippet.publishedAt);
                if (publishedTime < this.connectionTimestamp) {
                    this.logger.debug(`Filtered message posted before connection: ${publishedTime.toISOString()}`);
                    return;
                }
            }

            // Create a broadcaster object (we would need to get this from the stream context)
            // For now, use a placeholder that would be set from the integration context
            const broadcaster: YouTubeUser = {
                userId: "unknown",
                username: "Broadcaster",
                displayName: "Broadcaster",
                isVerified: false,
                profilePicture: ""
            };

            // Map YouTube API response to our ChatMessage type
            const chatMessage = mapYouTubeChatMessageToChat(message, broadcaster);

            // Build Firebot chat message
            const helpers = new FirebotChatHelpers();
            const firebotChatMessage = await helpers.buildFirebotChatMessage(chatMessage, messageText);

            // Get roles for this user
            const twitchBadgeRoles = helpers.getTwitchRoles(chatMessage.sender.identity);

            // Log to console
            this.logger.info(`[YouTube Chat] ${firebotChatMessage.username}: ${messageText} (${messageType})`);
            this.logger.debug(`User roles: ${twitchBadgeRoles.join(", ")}`);

            // Check if message is a command and handle it
            const wasCommand = await commandHandler.handleChatMessage(firebotChatMessage);
            if (wasCommand) {
                this.logger.debug("Message was handled as a command");
            }

            // Check if this is the first time we've seen this user (viewer arrived)
            if (this.checkViewerArrived(firebotChatMessage.userId)) {
                triggerViewerArrived(
                    firebotChatMessage.username,
                    firebotChatMessage.userId,
                    firebotChatMessage.userDisplayName || firebotChatMessage.username,
                    firebotChatMessage.rawText,
                    firebotChatMessage
                );
            }

            // Emit Firebot event with full chat message
            const { eventManager } = firebot.modules;
            const metadata = {
                eventSource: {
                    id: IntegrationConstants.INTEGRATION_ID
                },
                platform: "youtube",
                username: firebotChatMessage.username,
                userId: firebotChatMessage.userId,
                userDisplayName: firebotChatMessage.userDisplayName,
                twitchUserRoles: twitchBadgeRoles,
                messageText: firebotChatMessage.rawText,
                messageId: firebotChatMessage.id,
                chatMessage: firebotChatMessage,
                profilePicUrl: chatMessage.sender.profilePicture
            };

            eventManager.triggerEvent(
                IntegrationConstants.INTEGRATION_ID,
                "chat-message",
                metadata as unknown as Record<string, unknown>
            );

            // Send to the chat feed
            if (this.integration.isChatFeedEnabled()) {
                const { frontendCommunicator } = firebot.modules;
                frontendCommunicator.send("twitch:chat:message", firebotChatMessage);
            }

        } catch (error: any) {
            this.logger.error(`Error handling message: ${error.message}`);
        }
    }

    /**
     * Get human-readable message type
     */
    private getMessageType(type?: number): string {
        return type ? (YouTubeMessageTypeStrings[type as keyof typeof YouTubeMessageTypeStrings] || "other") : "unknown";
    }

    /**
     * Stop chat streaming
     */
    async stopChatStreaming(): Promise<void> {
        this.logger.info("Stopping YouTube chat stream");
        this.isStreaming = false;

        // Cancel any pending poll
        if (this.nextPollTimer) {
            clearTimeout(this.nextPollTimer);
            this.nextPollTimer = null;
        }

        this.client = null;
        this.liveChatId = null;
        this.accessToken = null;
        this.pageToken = undefined;
        this.connectionTimestamp = null;
    }

    /**
     * Check if currently chat streaming
     */
    isChatStreaming(): boolean {
        return this.isStreaming;
    }

    /**
     * Check if a viewer has arrived (first chat in stream)
     * Returns true if this is the first time seeing this user, false otherwise
     */
    checkViewerArrived(userId: string): boolean {
        if (this.viewerArrivedCache.has(userId)) {
            return false;
        }
        this.viewerArrivedCache.add(userId);
        return true;
    }
}
