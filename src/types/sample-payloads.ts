/**
 * Sample payloads for YouTube Live Chat API responses
 * Based on: https://developers.google.com/youtube/v3/live/docs/liveChatMessages
 */

/**
 * Sample text message from YouTube Live Chat API
 * This represents a typical chat message received from a viewer
 */
export const SAMPLE_YOUTUBE_TEXT_MESSAGE = {
    kind: "youtube#liveChatMessage",
    etag: "abc123defgh456",
    id: "MTU0ODEyMzQ1NjczODk2NzUzNDQ.CtHSEg",
    snippet: {
        type: "textMessageEvent",
        liveChatId: "KhNqYWhJUzRDdlBTeWQ2ZzlkdUlCQg",
        authorChannelId: "UCrDkAvwXgOFDjlW9wqyYeIQ",
        publishedAt: "2024-11-08T14:30:45.000Z",
        hasDisplayContent: true,
        displayMessage: "Great stream!",
        textMessageDetails: {
            messageText: "Great stream!"
        }
    },
    authorDetails: {
        channelId: "UCrDkAvwXgOFDjlW9wqyYeIQ",
        channelUrl: "http://www.youtube.com/channel/UCrDkAvwXgOFDjlW9wqyYeIQ",
        displayName: "John Viewer",
        profileImageUrl: "https://yt3.ggpht.com/-v0sQRFezryc/AAAAAAAAAAI/AAAAAAAAAAA/OixOH_nQN3s/s28-c-k-no-mo-rj-c0xffffff/photo.jpg",
        isVerified: false,
        isChatOwner: false,
        isChatSponsor: false,
        isChatModerator: false
    }
};

/**
 * Sample message from a channel sponsor
 */
export const SAMPLE_YOUTUBE_SPONSOR_MESSAGE = {
    kind: "youtube#liveChatMessage",
    etag: "xyz789uvw012",
    id: "MTU0ODEyMzQ1NjczODk2NzUzNDU.CtHSEg",
    snippet: {
        type: "textMessageEvent",
        liveChatId: "KhNqYWhJUzRDdlBTeWQ2ZzlkdUlCQg",
        authorChannelId: "UCanotherChannelId123",
        publishedAt: "2024-11-08T14:31:20.000Z",
        hasDisplayContent: true,
        displayMessage: "Love your content!",
        textMessageDetails: {
            messageText: "Love your content!"
        }
    },
    authorDetails: {
        channelId: "UCanotherChannelId123",
        channelUrl: "http://www.youtube.com/channel/UCanotherChannelId123",
        displayName: "Premium Supporter",
        profileImageUrl: "https://yt3.ggpht.com/-example/AAAAAAAAAAI/AAAAAAAAAAA/otherimage/s28-c-k-no-mo-rj-c0xffffff/photo.jpg",
        isVerified: true,
        isChatOwner: false,
        isChatSponsor: true,
        isChatModerator: false
    }
};

/**
 * Sample message from a channel moderator
 */
export const SAMPLE_YOUTUBE_MODERATOR_MESSAGE = {
    kind: "youtube#liveChatMessage",
    etag: "mod456def789",
    id: "MTU0ODEyMzQ1NjczODk2NzUzNDY.CtHSEg",
    snippet: {
        type: "textMessageEvent",
        liveChatId: "KhNqYWhJUzRDdlBTeWQ2ZzlkdUlCQg",
        authorChannelId: "UCmoderatorChannelId",
        publishedAt: "2024-11-08T14:32:00.000Z",
        hasDisplayContent: true,
        displayMessage: "Remember to follow the community guidelines!",
        textMessageDetails: {
            messageText: "Remember to follow the community guidelines!"
        }
    },
    authorDetails: {
        channelId: "UCmoderatorChannelId",
        channelUrl: "http://www.youtube.com/channel/UCmoderatorChannelId",
        displayName: "StreamModerator",
        profileImageUrl: "https://yt3.ggpht.com/-modimage/AAAAAAAAAAI/AAAAAAAAAAA/modphoto/s28-c-k-no-mo-rj-c0xffffff/photo.jpg",
        isVerified: false,
        isChatOwner: false,
        isChatSponsor: false,
        isChatModerator: true
    }
};

/**
 * Sample message from the channel owner (broadcaster)
 */
export const SAMPLE_YOUTUBE_OWNER_MESSAGE = {
    kind: "youtube#liveChatMessage",
    etag: "owner123abc456",
    id: "MTU0ODEyMzQ1NjczODk2NzUzNDc.CtHSEg",
    snippet: {
        type: "textMessageEvent",
        liveChatId: "KhNqYWhJUzRDdlBTeWQ2ZzlkdUlCQg",
        authorChannelId: "UCownerChannelId",
        publishedAt: "2024-11-08T14:32:45.000Z",
        hasDisplayContent: true,
        displayMessage: "Thanks everyone for joining!",
        textMessageDetails: {
            messageText: "Thanks everyone for joining!"
        }
    },
    authorDetails: {
        channelId: "UCownerChannelId",
        channelUrl: "http://www.youtube.com/channel/UCownerChannelId",
        displayName: "StreamBroadcaster",
        profileImageUrl: "https://yt3.ggpht.com/-broadcaster/AAAAAAAAAAI/AAAAAAAAAAA/broadcasterphoto/s28-c-k-no-mo-rj-c0xffffff/photo.jpg",
        isVerified: true,
        isChatOwner: true,
        isChatSponsor: true,
        isChatModerator: false
    }
};
