import { youtube_v3 as youtubeV3 } from "@googleapis/youtube";
import { IntegrationConstants } from "../constants";
import type { YouTubeIntegration } from "../integration-singleton";
import { firebot, logger } from "../main";
import { QUOTA_COSTS } from "../types/quota-tracking";
import { ApiCallType } from "./error-constants";
import { ErrorTracker } from "./error-tracker";

/**
 * BroadcastManager detects active YouTube live streams
 *
 * Responsibilities:
 * - Query YouTube API for active broadcasts
 * - Filter by channel ID when multiple streams exist
 * - Return the liveChatId for the active stream
 * - Handle edge cases (0 streams, multiple streams)
 * - Track quota consumption for API calls
 */
export class BroadcastManager {
    private youtube: youtubeV3.Youtube;
    private integration: YouTubeIntegration;
    private errorTracker: ErrorTracker;

    constructor(integration: YouTubeIntegration, errorTracker: ErrorTracker) {
        this.youtube = new youtubeV3.Youtube({});
        this.integration = integration;
        this.errorTracker = errorTracker;
    }

    /**
     * Find the active live chat ID
     *
     * @param accessToken - YouTube API access token
     * @param channelId - Optional channel ID to filter by (if multiple streams)
     * @param applicationId - YouTube application ID for quota tracking (required)
     * @returns liveChatId or null if no stream is active
     * @throws Error if multiple streams and no channel ID provided
     */
    async findActiveLiveChatId(accessToken: string, channelId: string | undefined, applicationId: string): Promise<string | null> {
        logger.debug("Searching for active YouTube broadcasts...");

        try {
            // Query for active broadcasts
            const response = await this.youtube.liveBroadcasts.list({
                // eslint-disable-next-line camelcase
                access_token: accessToken,
                part: ['id', 'snippet', 'contentDetails'],
                broadcastStatus: 'active',
                maxResults: 10 // Get up to 10 to detect multiples
            });

            // Record quota consumption
            const quotaManager = this.integration.getQuotaManager();
            quotaManager.recordApiCall(applicationId, 'liveBroadcasts.list', QUOTA_COSTS.LIVE_BROADCASTS_LIST);

            this.errorTracker.recordSuccess(ApiCallType.GET_LIVE_BROADCASTS);

            const broadcasts = response.data.items || [];

            // Case 1: No active streams
            if (broadcasts.length === 0) {
                logger.debug("No active YouTube broadcasts found");
                return null;
            }

            // Case 2: Single active stream
            if (broadcasts.length === 1) {
                const broadcast = broadcasts[0];
                const liveChatId = broadcast.snippet?.liveChatId;

                if (!liveChatId) {
                    logger.warn(`Active broadcast found but no liveChatId: ${broadcast.id}`);
                    logger.warn("Make sure live chat is enabled for your stream");
                    return null;
                }

                logger.info(`Found active broadcast: "${broadcast.snippet?.title}" (${broadcast.id})`);
                logger.debug(`Live chat ID: ${liveChatId}`);
                return liveChatId;
            }

            // Case 3: Multiple streams - need channel ID to filter
            logger.debug(`Found ${broadcasts.length} active broadcasts`);

            if (!channelId) {
                const titles = broadcasts.map(b => `"${b.snippet?.title}"`).join(", ");
                throw new Error(
                    `Multiple active YouTube streams detected (${broadcasts.length}): ${titles}. ` +
                    `Please specify a Channel ID in integration settings to filter by channel.`
                );
            }

            // Filter by channel ID
            const matchingBroadcasts = broadcasts.filter(b => b.snippet?.channelId === channelId);

            if (matchingBroadcasts.length === 0) {
                logger.warn(`No broadcasts found for channel ID: ${channelId}`);
                logger.debug(`Available channels: ${broadcasts.map(b => b.snippet?.channelId).join(", ")}`);
                return null;
            }

            if (matchingBroadcasts.length > 1) {
                const titles = matchingBroadcasts.map(b => `"${b.snippet?.title}"`).join(", ");
                throw new Error(
                    `Multiple active streams for channel ${channelId}: ${titles}. ` +
                    `Cannot determine which stream to connect to.`
                );
            }

            // Found exactly one matching broadcast
            const broadcast = matchingBroadcasts[0];
            const liveChatId = broadcast.snippet?.liveChatId;

            if (!liveChatId) {
                logger.warn(`Broadcast ${broadcast.id} has no liveChatId`);
                return null;
            }

            logger.info(`Found active broadcast for channel: "${broadcast.snippet?.title}" (${broadcast.id})`);
            logger.debug(`Live chat ID: ${liveChatId}`);
            return liveChatId;

        } catch (error: any) {
            // If it's our own error (multiple streams), re-throw
            if (error.message?.includes('Multiple active')) {
                throw error;
            }

            const errorMetadata = this.errorTracker.recordError(ApiCallType.GET_LIVE_BROADCASTS, error);
            logger.error(`Error finding active broadcasts: ${error.message}`);

            const { eventManager } = firebot.modules;
            eventManager.triggerEvent(
                IntegrationConstants.INTEGRATION_ID,
                "api-error",
                errorMetadata as unknown as Record<string, unknown>
            );

            throw new Error(`Failed to query YouTube broadcasts: ${error.message}`);
        }
    }

    /**
     * Check if a specific live chat is still active
     *
     * This can be used to detect when a stream ends
     *
     * @param accessToken - YouTube API access token
     * @param liveChatId - Live chat ID to check
     * @param applicationId - YouTube application ID for quota tracking (required)
     */
    async isLiveChatActive(accessToken: string, liveChatId: string, applicationId: string): Promise<boolean> {
        try {
            const response = await this.youtube.liveBroadcasts.list({
                // eslint-disable-next-line camelcase
                access_token: accessToken,
                part: ['snippet', 'status'],
                id: [liveChatId]
            });

            // Record quota consumption
            const quotaManager = this.integration.getQuotaManager();
            quotaManager.recordApiCall(applicationId, 'liveBroadcasts.list', QUOTA_COSTS.LIVE_BROADCASTS_LIST);

            this.errorTracker.recordSuccess(ApiCallType.GET_LIVE_BROADCASTS);

            const broadcasts = response.data.items || [];
            if (broadcasts.length === 0) {
                return false;
            }

            const broadcast = broadcasts[0];
            const status = broadcast.status?.lifeCycleStatus;

            // Active statuses
            return status === 'live' || status === 'liveStarting';

        } catch (error: any) {
            const errorMetadata = this.errorTracker.recordError(ApiCallType.GET_LIVE_BROADCASTS, error);
            logger.error(`Error checking live chat status: ${error.message}`);

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
