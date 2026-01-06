import {
    getOrCreateUser,
    getUserById,
    getUserByUsername,
    incrementChatMessages,
    setUserRoles,
    updateLastSeen,
    type PlatformUser
} from "@thestaticmage/mage-platform-lib-client";
import { logger } from "../main";
import { YouTubeUser } from "../types";
import { youTubeifyUserId, youTubeifyUsername } from "../util/user";

const PLATFORM = "youtube";

export class YouTubeUserManager {
    /**
     * Get a viewer by their YouTube channel ID
     */
    async getViewerById(channelId: string): Promise<YouTubeUser | undefined> {
        try {
            const userId = youTubeifyUserId(channelId);
            const response = await getUserById({
                platform: PLATFORM,
                userId
            });

            if (!response.success || !response.user) {
                logger.debug(`Failed to get user by ID ${userId}: ${response.error || "Unknown error"}`);
                return undefined;
            }

            return this.platformUserToYouTubeUser(response.user);
        } catch (error) {
            logger.error(`Error getting user by ID ${channelId}: ${error}`);
            return undefined;
        }
    }

    /**
     * Get a viewer by their YouTube username
     */
    async getViewerByUsername(username: string): Promise<YouTubeUser | undefined> {
        try {
            const platformUsername = youTubeifyUsername(username);
            const response = await getUserByUsername({
                username: platformUsername,
                platform: PLATFORM
            });

            if (!response.success || !response.user) {
                logger.debug(`Failed to get user by username ${platformUsername}: ${response.error || "Unknown error"}`);
                return undefined;
            }

            return this.platformUserToYouTubeUser(response.user);
        } catch (error) {
            logger.error(`Error getting user by username ${username}: ${error}`);
            return undefined;
        }
    }

    /**
     * Get or create a viewer
     */
    async getOrCreateViewer(
        channelId: string,
        username: string,
        displayName?: string,
        profilePicUrl?: string
    ): Promise<YouTubeUser | undefined> {
        try {
            const userId = youTubeifyUserId(channelId);
            const platformUsername = youTubeifyUsername(username);

            const response = await getOrCreateUser({
                platform: PLATFORM,
                userId,
                username: platformUsername,
                displayName: displayName || username,
                profilePicUrl: profilePicUrl || undefined
            });

            if (!response.success || !response.user) {
                logger.debug(`Failed to get or create user ${userId}: ${response.error || "Unknown error"}`);
                return undefined;
            }

            return this.platformUserToYouTubeUser(response.user);
        } catch (error) {
            logger.error(`Error getting or creating user ${channelId}: ${error}`);
            return undefined;
        }
    }

    /**
     * Increment chat message count for a viewer
     */
    async incrementChatMessageCount(channelId: string): Promise<boolean> {
        try {
            const userId = youTubeifyUserId(channelId);
            const response = await incrementChatMessages({
                platform: PLATFORM,
                userId,
                amount: 1
            });

            if (!response.success) {
                logger.debug(`Failed to increment chat messages for user ${userId}: ${response.error || "Unknown error"}`);
                return false;
            }

            return true;
        } catch (error) {
            logger.error(`Error incrementing chat messages for user ${channelId}: ${error}`);
            return false;
        }
    }

    /**
     * Update last seen timestamp for a viewer
     */
    async updateLastSeenTime(channelId: string): Promise<boolean> {
        try {
            const userId = youTubeifyUserId(channelId);
            const response = await updateLastSeen({
                platform: PLATFORM,
                userId
            });

            if (!response.success) {
                logger.debug(`Failed to update last seen for user ${userId}: ${response.error || "Unknown error"}`);
                return false;
            }

            return true;
        } catch (error) {
            logger.error(`Error updating last seen for user ${channelId}: ${error}`);
            return false;
        }
    }

    /**
     * Set viewer roles
     */
    async setViewerRoles(channelId: string, roles: string[]): Promise<boolean> {
        try {
            const userId = youTubeifyUserId(channelId);
            const response = await setUserRoles({
                platform: PLATFORM,
                userId,
                roles
            });

            if (!response.success) {
                logger.debug(`Failed to set roles for user ${userId}: ${response.error || "Unknown error"}`);
                return false;
            }

            return true;
        } catch (error) {
            logger.error(`Error setting roles for user ${channelId}: ${error}`);
            return false;
        }
    }

    /**
     * Convert platform-lib user to YouTubeUser
     */
    private platformUserToYouTubeUser(platformUser: PlatformUser): YouTubeUser {
        return {
            userId: platformUser._id || "",
            username: platformUser.username || "",
            displayName: platformUser.displayName || "",
            isVerified: false,
            profilePicture: platformUser.profilePicUrl || ""
        };
    }
}
