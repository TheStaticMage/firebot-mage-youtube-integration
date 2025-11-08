export const IntegrationConstants = {
    INTEGRATION_ID: "mage-youtube-integration",
    INTEGRATION_NAME: "MageYouTubeIntegration",
    INTEGRATION_DESCRIPTION: "A preliminary, experimental, and generally not-recommended YouTube integration for Firebot.",
    INTEGRATION_URI: "mage-youtube-integration",
    YOUTUBE_SCOPES: [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.force-ssl"
    ]
} as const;
