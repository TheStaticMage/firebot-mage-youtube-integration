/**
 * Quota usage tracking for a single YouTube application
 */
export interface QuotaUsage {
    /** Total quota units consumed since last reset */
    quotaUnitsUsed: number;

    /** Unix timestamp (ms) of next quota reset (midnight Pacific Time) */
    quotaResetTime: number;

    /** Unix timestamp (ms) of last update */
    lastUpdated: number;
}

/**
 * Persistent storage structure for quota tracking data
 */
export type QuotaTrackingStorage = Record<string, QuotaUsage>;

/**
 * Known YouTube API quota costs
 */
export const QUOTA_COSTS = {
    STREAM_LIST: 5, // streamList gRPC endpoint
    LIVE_BROADCASTS_LIST: 1, // liveBroadcasts.list REST API
    LIVE_CHAT_MESSAGES_INSERT: 20 // liveChatMessages.insert REST API
} as const;
