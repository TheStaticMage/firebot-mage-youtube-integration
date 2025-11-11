/* eslint-disable @typescript-eslint/unbound-method */
import { RestApiClient } from "../rest-api-client";
import { integration } from "../../integration-singleton";
import { logger } from "../../main";

// Mock google-auth-library first
const mockOAuth2Client = {
    setCredentials: jest.fn()
};

jest.mock("google-auth-library", () => ({
    OAuth2Client: jest.fn().mockImplementation(() => mockOAuth2Client)
}));

// Mock YouTube API
const mockLiveChatMessages = {
    insert: jest.fn()
};

jest.mock("@googleapis/youtube", () => ({
    // eslint-disable-next-line camelcase
    youtube_v3: {
        Youtube: jest.fn().mockImplementation(() => ({
            liveChatMessages: mockLiveChatMessages
        }))
    }
}));

// Mock the integration module
jest.mock("../../integration-singleton", () => ({
    integration: {
        getApplicationsStorage: jest.fn(),
        getCurrentLiveChatId: jest.fn(),
        getMultiAuthManager: jest.fn()
    }
}));

// Mock the logger
jest.mock("../../main", () => ({
    logger: {
        error: jest.fn(),
        debug: jest.fn(),
        info: jest.fn()
    }
}));

describe("RestApiClient", () => {
    let restApiClient: RestApiClient;

    beforeEach(() => {
        restApiClient = new RestApiClient();
        jest.clearAllMocks();
        mockLiveChatMessages.insert.mockReset();

        // Setup default mocks
        (integration.getApplicationsStorage as jest.Mock).mockReturnValue({
            activeApplicationId: "app1",
            applications: {
                app1: {
                    id: "app1",
                    name: "Test App",
                    clientId: "client1",
                    clientSecret: "secret1",
                    refreshToken: "refresh1",
                    ready: true,
                    status: "Ready"
                }
            }
        });

        (integration.getCurrentLiveChatId as jest.Mock).mockReturnValue("test-chat-id");

        const mockMultiAuthManager = {
            getAccessToken: jest.fn().mockResolvedValue("test-access-token")
        };
        (integration.getMultiAuthManager as jest.Mock).mockReturnValue(mockMultiAuthManager);
    });

    describe("sendChatMessage", () => {
        it("should send message successfully", async () => {
            mockLiveChatMessages.insert.mockResolvedValue({
                status: 200,
                data: { id: "msg123" }
            });

            const result = await restApiClient.sendChatMessage("Test message");

            expect(result).toBe(true);
            expect(mockLiveChatMessages.insert).toHaveBeenCalledWith({
                part: ["snippet"],
                requestBody: {
                    snippet: {
                        liveChatId: "test-chat-id",
                        type: "textMessageEvent",
                        textMessageDetails: {
                            messageText: "Test message"
                        }
                    }
                }
            });
            expect(logger.debug).toHaveBeenCalledWith(
                expect.stringContaining("Sending YouTube chat message to chat test-chat-id: Test message")
            );
        });

        it("should return false when no active application is selected", async () => {
            (integration.getApplicationsStorage as jest.Mock).mockReturnValue({
                activeApplicationId: null,
                applications: {}
            });

            const result = await restApiClient.sendChatMessage("Test message");

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(
                "Cannot send YouTube chat message: No active application selected"
            );
            expect(mockLiveChatMessages.insert).not.toHaveBeenCalled();
        });

        it("should return false when active application is not found", async () => {
            (integration.getApplicationsStorage as jest.Mock).mockReturnValue({
                activeApplicationId: "app1",
                applications: {}
            });

            const result = await restApiClient.sendChatMessage("Test message");

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Cannot send YouTube chat message: Active application")
            );
            expect(mockLiveChatMessages.insert).not.toHaveBeenCalled();
        });

        it("should return false when active application is not ready", async () => {
            (integration.getApplicationsStorage as jest.Mock).mockReturnValue({
                activeApplicationId: "app1",
                applications: {
                    app1: {
                        id: "app1",
                        name: "Test App",
                        clientId: "client1",
                        clientSecret: "secret1",
                        refreshToken: "refresh1",
                        ready: false,
                        status: "Not ready"
                    }
                }
            });

            const result = await restApiClient.sendChatMessage("Test message");

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Cannot send YouTube chat message: Active application")
            );
            expect(mockLiveChatMessages.insert).not.toHaveBeenCalled();
        });

        it("should return false when no live chat ID is available", async () => {
            (integration.getCurrentLiveChatId as jest.Mock).mockReturnValue(null);

            const result = await restApiClient.sendChatMessage("Test message");

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(
                "Cannot send YouTube chat message: No active live chat"
            );
            expect(mockLiveChatMessages.insert).not.toHaveBeenCalled();
        });

        it("should handle API errors gracefully", async () => {
            const apiError = new Error("API Error");
            mockLiveChatMessages.insert.mockRejectedValue(apiError);

            const result = await restApiClient.sendChatMessage("Test message");

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Error sending YouTube chat message")
            );
        });

        it("should log detailed error information when available", async () => {
            const apiError = new Error("API Error");
            (apiError as any).response = {
                data: { error: { message: "Quota exceeded" } }
            };
            mockLiveChatMessages.insert.mockRejectedValue(apiError);

            const result = await restApiClient.sendChatMessage("Test message");

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("YouTube API error details")
            );
        });

        it("should return false on non-200 status response", async () => {
            mockLiveChatMessages.insert.mockResolvedValue({
                status: 500,
                data: { id: "msg123" }
            });

            const result = await restApiClient.sendChatMessage("Test message");

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to send YouTube chat message. Status: 500")
            );
        });

        it("should handle empty message text", async () => {
            mockLiveChatMessages.insert.mockResolvedValue({
                status: 200,
                data: { id: "msg123" }
            });

            const result = await restApiClient.sendChatMessage("");

            expect(result).toBe(true);
            expect(mockLiveChatMessages.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    requestBody: expect.objectContaining({
                        snippet: expect.objectContaining({
                            textMessageDetails: {
                                messageText: ""
                            }
                        })
                    })
                })
            );
        });

        it("should handle message with special characters", async () => {
            mockLiveChatMessages.insert.mockResolvedValue({
                status: 200,
                data: { id: "msg123" }
            });

            const specialMessage = "Test message with 🎉 emoji and special chars: !@#$%";
            const result = await restApiClient.sendChatMessage(specialMessage);

            expect(result).toBe(true);
            expect(mockLiveChatMessages.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    requestBody: expect.objectContaining({
                        snippet: expect.objectContaining({
                            textMessageDetails: {
                                messageText: specialMessage
                            }
                        })
                    })
                })
            );
        });

        it("should get access token from multi-auth manager", async () => {
            const mockMultiAuthManager = {
                getAccessToken: jest.fn().mockResolvedValue("new-access-token")
            };
            (integration.getMultiAuthManager as jest.Mock).mockReturnValue(mockMultiAuthManager);

            mockLiveChatMessages.insert.mockResolvedValue({
                status: 200,
                data: { id: "msg123" }
            });

            await restApiClient.sendChatMessage("Test message");

            expect(mockMultiAuthManager.getAccessToken).toHaveBeenCalledWith("app1");
        });
    });
});
