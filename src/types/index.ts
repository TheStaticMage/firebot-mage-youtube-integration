export interface YouTubeBadge {
    text: string;
    type: string;
}

export interface YouTubeRepliesTo {
    messageId: string;
    content: string;
    sender: YouTubeUser;
}

export interface ChatMessage {
    messageId: string;
    repliesTo?: YouTubeRepliesTo | undefined;
    broadcaster: YouTubeUser;
    sender: YouTubeUserWithIdentity;
    content: string;
    createdAt: Date | undefined;
}

export interface YouTubeIdentity {
    usernameColor?: string;
    badges: YouTubeBadge[];
}

export interface YouTubeUser {
    userId: string;
    username: string;
    displayName: string;
    isVerified: boolean;
    profilePicture: string;
}

export interface YouTubeUserWithIdentity extends YouTubeUser {
    identity: YouTubeIdentity;
}

export interface LivestreamStatusUpdated {
    broadcaster: YouTubeUser;
    isLive: boolean;
    title: string;
    startedAt?: Date;
    endedAt?: Date;
}

/**
 * Quota settings for a YouTube OAuth application
 */
export interface QuotaSettings {
    dailyQuota: number;
    maxStreamHours: number;
    overridePollingDelay: boolean;
    customPollingDelaySeconds: number;
}

/**
 * YouTube OAuth application configuration
 */
export interface YouTubeOAuthApplication {
    id: string;
    name: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    email?: string;
    quotaSettings: QuotaSettings;
    ready: boolean; // Indicates connection has a valid token
    tokenExpiresAt?: number; // Unix timestamp (ms) of when the access token expires
}

/**
 * Application storage interface for managing multiple OAuth applications
 */
export interface ApplicationStorage {
    applications: Record<string, YouTubeOAuthApplication>;
    activeApplicationId: string | null;
}
