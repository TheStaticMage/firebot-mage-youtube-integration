export const YouTubeMessageTypes = {
    TEXT_MESSAGE_EVENT: 1,
    SUPER_CHAT_EVENT: 15,
    SUPER_STICKER_EVENT: 16,
    NEW_SPONSOR_EVENT: 7,
    MEMBER_MILESTONE_EVENT: 17
} as const;

export const YouTubeMessageTypeStrings = {
    [YouTubeMessageTypes.TEXT_MESSAGE_EVENT]: "text",
    [YouTubeMessageTypes.SUPER_CHAT_EVENT]: "superChat",
    [YouTubeMessageTypes.SUPER_STICKER_EVENT]: "superSticker",
    [YouTubeMessageTypes.NEW_SPONSOR_EVENT]: "newSponsor",
    [YouTubeMessageTypes.MEMBER_MILESTONE_EVENT]: "memberMilestone"
} as const;

export type YouTubeMessageType = typeof YouTubeMessageTypes[keyof typeof YouTubeMessageTypes];
export type YouTubeMessageTypeString = typeof YouTubeMessageTypeStrings[keyof typeof YouTubeMessageTypeStrings];
export const IntegrationConstants = {
    INTEGRATION_ID: "mage-youtube-integration",
    INTEGRATION_NAME: "MageYouTubeIntegration",
    INTEGRATION_DESCRIPTION: "A preliminary, experimental, and generally not-recommended YouTube integration for Firebot.",
    INTEGRATION_URI: "mage-youtube-integration",
    YOUTUBE_SCOPES: [
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.force-ssl"
    ],
    YOUTUBE_CHAT_MESSAGE_CHARACTER_LIMIT: 200 // Hard limit, determined by testing
} as const;
