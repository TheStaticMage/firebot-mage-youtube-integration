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
