/**
 * Error handling constants for YouTube API integration
 *
 * Defines enum types for error categorization and API call tracking
 */

/**
 * Error categories for YouTube API failures
 *
 * These categorize different types of errors that can occur when calling
 * the YouTube API, enabling flexible filtering and handling.
 */
export enum ErrorCategory {
    UNAUTHENTICATED = "Unauthenticated",
    QUOTA_EXCEEDED = "QuotaExceeded",
    PERMISSION_DENIED = "PermissionDenied",
    NOT_FOUND = "NotFound",
    INVALID_REQUEST = "InvalidRequest",
    NETWORK_ERROR = "NetworkError",
    UNKNOWN = "Unknown"
}

/**
 * API call types that may fail and be tracked
 *
 * Each API call that can fail is categorized so that consecutive
 * failures can be tracked and filtered per endpoint.
 */
export enum ApiCallType {
    SEND_CHAT_MESSAGE = "SendChatMessage",
    GET_LIVE_BROADCASTS = "GetLiveBroadcasts",
    STREAM_CHAT_MESSAGES = "StreamChatMessages",
    REFRESH_TOKEN = "RefreshToken"
}
