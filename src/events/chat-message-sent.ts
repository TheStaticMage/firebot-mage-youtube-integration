import { FirebotChatMessage, FirebotParsedMessagePart } from "@crowbartools/firebot-custom-scripts-types/types/chat";
import { ChatMessage, YouTubeIdentity, YouTubeUser, YouTubeUserWithIdentity } from "../types";
import { youTubeifyUserId, youTubeifyUsername } from "../util/user";

interface chatBadge {
    title: string;
    url: string;
}

const YOUTUBE_MODERATOR_ICON_URL = "https://lh3.googleusercontent.com/7BHqMAHXFDKzz9HmdoZJXOWPoudrJ0K7E2EEuD8PBhuQV_VPckxa-33Tz1kE0YPuSg=h50";
const YOUTUBE_MEMBER_ICON_URL = "https://lh3.googleusercontent.com/dANFWab1-Ay5J0LhdNLstF8P8XdlSQm6gPF8epuk1KAthnBs6KbSmtOF1OdMZArsukk=h50";

/**
 * Maps a YouTube Data API liveChatMessage to our internal ChatMessage type
 */
export function mapYouTubeChatMessageToChat(
    youtubeMessage: any,
    broadcaster: YouTubeUser
): ChatMessage {
    const authorDetails = youtubeMessage.authorDetails;
    const snippet = youtubeMessage.snippet;

    // Build the sender object
    const sender: YouTubeUserWithIdentity = {
        userId: authorDetails.channelId,
        username: authorDetails.displayName,
        displayName: authorDetails.displayName,
        isVerified: authorDetails.isVerified || false,
        profilePicture: authorDetails.profileImageUrl || "",
        identity: {
            usernameColor: "",
            badges: buildBadgesFromAuthorDetails(authorDetails)
        }
    };

    return {
        messageId: youtubeMessage.id,
        repliesTo: undefined, // YouTube API doesn't provide reply context in basic response
        broadcaster,
        sender,
        content: snippet.displayMessage || snippet.textMessageDetails?.messageText || "",
        createdAt: snippet.publishedAt ? new Date(snippet.publishedAt) : undefined
    };
}

/**
 * Builds badge array from YouTube author details
 */
function buildBadgesFromAuthorDetails(authorDetails: any) {
    const badges = [];

    if (authorDetails.isChatOwner) {
        badges.push({ text: "Owner", type: "broadcaster" });
    }
    if (authorDetails.isChatModerator) {
        badges.push({ text: "Moderator", type: "moderator" });
    }
    if (authorDetails.isChatSponsor) {
        badges.push({ text: "Sponsor", type: "subscriber" });
    }

    return badges;
}

export class FirebotChatHelpers {
    getBadges(identity: YouTubeIdentity): chatBadge[] {
        const badges: chatBadge[] = [];

        for (const badge of identity.badges) {
            if (badge.type === "moderator") {
                badges.push({
                    title: "Moderator",
                    url: YOUTUBE_MODERATOR_ICON_URL
                });
            } else if (badge.type === "subscriber") {
                badges.push({
                    title: "Member",
                    url: YOUTUBE_MEMBER_ICON_URL
                });
            }
        }

        return badges;
    }

    getTwitchRoles(identity: YouTubeIdentity): string[] {
        const roles = new Set<string>();

        identity.badges.forEach((badge) => {
            if (badge.type === "broadcaster") {
                roles.add("broadcaster");
            } else if (badge.type === "moderator") {
                roles.add("mod");
            } else if (badge.type === "subscriber") {
                roles.add("sub");
                roles.add("tier1");
            }
        });

        return Array.from(roles);
    }

    async buildFirebotChatMessage(msg: ChatMessage, msgText: string) {
        const firebotChatMessage: FirebotChatMessage = {
            id: msg.messageId,
            username: youTubeifyUsername(msg.sender.username),
            userId: youTubeifyUserId(msg.sender.userId),
            userDisplayName: msg.sender.displayName,
            profilePicUrl: msg.sender.profilePicture || "",
            customRewardId: undefined,
            isHighlighted: false,
            isAnnouncement: false,
            isHiddenFromChatFeed: false,
            isFirstChat: false,
            isReturningChatter: false,
            isReply: undefined,
            replyParentMessageId: undefined, // Replies not fully supported yet
            replyParentMessageText: undefined,
            replyParentMessageSenderUserId: undefined,
            replyParentMessageSenderDisplayName: undefined,
            threadParentMessageId: undefined,
            threadParentMessageSenderUserId: undefined,
            threadParentMessageSenderDisplayName: undefined,

            isRaider: false,
            raidingFrom: "",
            isSuspiciousUser: false,

            rawText: msgText,
            whisper: false,
            whisperTarget: undefined,
            action: false,
            tagged: false,
            isCheer: false,
            badges: this.getBadges(msg.sender.identity),
            parts: [],
            roles: [],
            isSharedChatMessage: false,
            sharedChatRoomId: undefined
        };

        const messageParts: FirebotParsedMessagePart[] = [];

        // For YouTube, emotes are handled differently and would need to be processed via YouTube's emote API
        // For now, just parse the message text as-is
        if (msgText && msgText.trim().length > 0) {
            messageParts.push({
                type: "text",
                text: msgText
            });
        }
        firebotChatMessage.parts = messageParts;

        firebotChatMessage.isFounder = msg.sender.identity.badges.some(b => b.type === "founder");
        firebotChatMessage.isBroadcaster = msg.sender.identity.badges.some(b => b.type === "broadcaster");
        firebotChatMessage.isMod = msg.sender.identity.badges.some(b => b.type === "moderator");
        firebotChatMessage.isSubscriber = msg.sender.identity.badges.some(b => b.type === "subscriber");
        firebotChatMessage.isVip = msg.sender.identity.badges.some(b => b.type === "vip");

        firebotChatMessage.roles = this.getTwitchRoles(msg.sender.identity);

        firebotChatMessage.isCheer = false; // No equivalent on YouTube at the moment

        firebotChatMessage.color = msg.sender.identity?.usernameColor || "";

        return firebotChatMessage;
    }
}
