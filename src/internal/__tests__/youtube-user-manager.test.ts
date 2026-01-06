import {
    getOrCreateUser,
    getUserById,
    getUserByUsername,
    incrementChatMessages,
    setUserRoles,
    updateLastSeen
} from "@thestaticmage/mage-platform-lib-client";
import { YouTubeUserManager } from "../youtube-user-manager";

jest.mock("@thestaticmage/mage-platform-lib-client");
jest.mock("../../main", () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn()
    }
}));

describe("YouTubeUserManager", () => {
    let manager: YouTubeUserManager;

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new YouTubeUserManager();
    });

    describe("getViewerById", () => {
        it("should return a YouTubeUser when successful", async () => {
            const mockUser = {
                _id: "yUC123456",
                username: "testuser",
                displayName: "Test User",
                profilePicUrl: "https://example.com/pic.jpg",
                lastSeen: 1234567890,
                currency: {},
                metadata: {},
                chatMessages: 5,
                minutesInChannel: 10,
                twitchRoles: []
            };

            (getUserById as jest.Mock).mockResolvedValue({
                success: true,
                user: mockUser
            });

            const result = await manager.getViewerById("UC123456");

            expect(result).toEqual({
                userId: "yUC123456",
                username: "testuser",
                displayName: "Test User",
                isVerified: false,
                profilePicture: "https://example.com/pic.jpg"
            });
            expect(getUserById).toHaveBeenCalledWith({
                platform: "youtube",
                userId: "yUC123456"
            });
        });

        it("should return undefined when user not found", async () => {
            (getUserById as jest.Mock).mockResolvedValue({
                success: false,
                error: "User not found"
            });

            const result = await manager.getViewerById("UC123456");

            expect(result).toBeUndefined();
        });

        it("should return undefined when response has no user", async () => {
            (getUserById as jest.Mock).mockResolvedValue({
                success: true
            });

            const result = await manager.getViewerById("UC123456");

            expect(result).toBeUndefined();
        });

        it("should return undefined on error", async () => {
            (getUserById as jest.Mock).mockRejectedValue(new Error("Network error"));

            const result = await manager.getViewerById("UC123456");

            expect(result).toBeUndefined();
        });
    });

    describe("getViewerByUsername", () => {
        it("should return a YouTubeUser when successful", async () => {
            const mockUser = {
                _id: "yUC123456",
                username: "testuser@youtube",
                displayName: "Test User",
                profilePicUrl: "https://example.com/pic.jpg",
                lastSeen: 1234567890,
                currency: {},
                metadata: {},
                chatMessages: 5,
                minutesInChannel: 10,
                twitchRoles: []
            };

            (getUserByUsername as jest.Mock).mockResolvedValue({
                success: true,
                user: mockUser
            });

            const result = await manager.getViewerByUsername("testuser");

            expect(result).toEqual({
                userId: "yUC123456",
                username: "testuser@youtube",
                displayName: "Test User",
                isVerified: false,
                profilePicture: "https://example.com/pic.jpg"
            });
            expect(getUserByUsername).toHaveBeenCalledWith({
                username: "testuser@youtube",
                platform: "youtube"
            });
        });

        it("should return undefined when user not found", async () => {
            (getUserByUsername as jest.Mock).mockResolvedValue({
                success: false,
                error: "User not found"
            });

            const result = await manager.getViewerByUsername("testuser");

            expect(result).toBeUndefined();
        });

        it("should return undefined on error", async () => {
            (getUserByUsername as jest.Mock).mockRejectedValue(new Error("Network error"));

            const result = await manager.getViewerByUsername("testuser");

            expect(result).toBeUndefined();
        });
    });

    describe("getOrCreateViewer", () => {
        it("should return a YouTubeUser when successful", async () => {
            const mockUser = {
                _id: "yUC123456",
                username: "testuser@youtube",
                displayName: "Test User",
                profilePicUrl: "https://example.com/pic.jpg",
                lastSeen: 1234567890,
                currency: {},
                metadata: {},
                chatMessages: 0,
                minutesInChannel: 0,
                twitchRoles: []
            };

            (getOrCreateUser as jest.Mock).mockResolvedValue({
                success: true,
                user: mockUser,
                created: true
            });

            const result = await manager.getOrCreateViewer(
                "UC123456",
                "testuser",
                "Test User",
                "https://example.com/pic.jpg"
            );

            expect(result).toEqual({
                userId: "yUC123456",
                username: "testuser@youtube",
                displayName: "Test User",
                isVerified: false,
                profilePicture: "https://example.com/pic.jpg"
            });
            expect(getOrCreateUser).toHaveBeenCalledWith({
                platform: "youtube",
                userId: "yUC123456",
                username: "testuser@youtube",
                displayName: "Test User",
                profilePicUrl: "https://example.com/pic.jpg"
            });
        });

        it("should use username as displayName when displayName not provided", async () => {
            const mockUser = {
                _id: "yUC123456",
                username: "testuser@youtube",
                displayName: "testuser",
                profilePicUrl: "",
                lastSeen: 1234567890,
                currency: {},
                metadata: {},
                chatMessages: 0,
                minutesInChannel: 0,
                twitchRoles: []
            };

            (getOrCreateUser as jest.Mock).mockResolvedValue({
                success: true,
                user: mockUser
            });

            await manager.getOrCreateViewer("UC123456", "testuser");

            expect(getOrCreateUser).toHaveBeenCalledWith({
                platform: "youtube",
                userId: "yUC123456",
                username: "testuser@youtube",
                displayName: "testuser",
                profilePicUrl: undefined
            });
        });

        it("should return undefined when creation fails", async () => {
            (getOrCreateUser as jest.Mock).mockResolvedValue({
                success: false,
                error: "Creation failed"
            });

            const result = await manager.getOrCreateViewer("UC123456", "testuser");

            expect(result).toBeUndefined();
        });

        it("should return undefined on error", async () => {
            (getOrCreateUser as jest.Mock).mockRejectedValue(new Error("Network error"));

            const result = await manager.getOrCreateViewer("UC123456", "testuser");

            expect(result).toBeUndefined();
        });
    });

    describe("incrementChatMessageCount", () => {
        it("should return true on success", async () => {
            (incrementChatMessages as jest.Mock).mockResolvedValue({
                success: true,
                newValue: 6
            });

            const result = await manager.incrementChatMessageCount("UC123456");

            expect(result).toBe(true);
            expect(incrementChatMessages).toHaveBeenCalledWith({
                platform: "youtube",
                userId: "yUC123456",
                amount: 1
            });
        });

        it("should return false when increment fails", async () => {
            (incrementChatMessages as jest.Mock).mockResolvedValue({
                success: false,
                error: "User not found"
            });

            const result = await manager.incrementChatMessageCount("UC123456");

            expect(result).toBe(false);
        });

        it("should return false on error", async () => {
            (incrementChatMessages as jest.Mock).mockRejectedValue(new Error("Network error"));

            const result = await manager.incrementChatMessageCount("UC123456");

            expect(result).toBe(false);
        });
    });

    describe("updateLastSeenTime", () => {
        it("should return true on success", async () => {
            (updateLastSeen as jest.Mock).mockResolvedValue({
                success: true
            });

            const result = await manager.updateLastSeenTime("UC123456");

            expect(result).toBe(true);
            expect(updateLastSeen).toHaveBeenCalledWith({
                platform: "youtube",
                userId: "yUC123456"
            });
        });

        it("should return false when update fails", async () => {
            (updateLastSeen as jest.Mock).mockResolvedValue({
                success: false,
                error: "User not found"
            });

            const result = await manager.updateLastSeenTime("UC123456");

            expect(result).toBe(false);
        });

        it("should return false on error", async () => {
            (updateLastSeen as jest.Mock).mockRejectedValue(new Error("Network error"));

            const result = await manager.updateLastSeenTime("UC123456");

            expect(result).toBe(false);
        });
    });

    describe("setViewerRoles", () => {
        it("should return true on success", async () => {
            (setUserRoles as jest.Mock).mockResolvedValue({
                success: true
            });

            const result = await manager.setViewerRoles("UC123456", ["moderator", "member"]);

            expect(result).toBe(true);
            expect(setUserRoles).toHaveBeenCalledWith({
                platform: "youtube",
                userId: "yUC123456",
                roles: ["moderator", "member"]
            });
        });

        it("should return true with empty roles array", async () => {
            (setUserRoles as jest.Mock).mockResolvedValue({
                success: true
            });

            const result = await manager.setViewerRoles("UC123456", []);

            expect(result).toBe(true);
            expect(setUserRoles).toHaveBeenCalledWith({
                platform: "youtube",
                userId: "yUC123456",
                roles: []
            });
        });

        it("should return false when setting roles fails", async () => {
            (setUserRoles as jest.Mock).mockResolvedValue({
                success: false,
                error: "User not found"
            });

            const result = await manager.setViewerRoles("UC123456", ["moderator"]);

            expect(result).toBe(false);
        });

        it("should return false on error", async () => {
            (setUserRoles as jest.Mock).mockRejectedValue(new Error("Network error"));

            const result = await manager.setViewerRoles("UC123456", ["moderator"]);

            expect(result).toBe(false);
        });
    });

    describe("platformUserToYouTubeUser conversion", () => {
        it("should handle user with all fields", async () => {
            const mockUser = {
                _id: "yUC123456",
                username: "testuser",
                displayName: "Test User",
                profilePicUrl: "https://example.com/pic.jpg",
                lastSeen: 1234567890,
                currency: {},
                metadata: {},
                chatMessages: 5,
                minutesInChannel: 10,
                twitchRoles: []
            };

            (getUserById as jest.Mock).mockResolvedValue({
                success: true,
                user: mockUser
            });

            const result = await manager.getViewerById("UC123456");

            expect(result).toEqual({
                userId: "yUC123456",
                username: "testuser",
                displayName: "Test User",
                isVerified: false,
                profilePicture: "https://example.com/pic.jpg"
            });
        });

        it("should provide defaults for missing fields", async () => {
            const mockUser = {
                _id: "yUC123456",
                username: "",
                displayName: "",
                profilePicUrl: "",
                lastSeen: 1234567890,
                currency: {},
                metadata: {},
                chatMessages: 0,
                minutesInChannel: 0,
                twitchRoles: []
            };

            (getUserById as jest.Mock).mockResolvedValue({
                success: true,
                user: mockUser
            });

            const result = await manager.getViewerById("UC123456");

            expect(result).toEqual({
                userId: "yUC123456",
                username: "",
                displayName: "",
                isVerified: false,
                profilePicture: ""
            });
        });
    });
});
