/* eslint-disable @typescript-eslint/unbound-method */
import { integration } from "../../integration";
import { AuthManager } from "../../internal/auth-manager";
import { RestApiClient } from "../../internal/rest-api-client";
import { chatEffect } from "../chat";

// Mock the integration module
jest.mock("../../integration", () => ({
    integration: {
        getCurrentLiveChatId: jest.fn(),
        getAuthManager: jest.fn(),
        getRestApiClient: jest.fn()
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

describe("YouTube Chat Effect", () => {
    let mockRestApiClient: jest.Mocked<RestApiClient>;
    let mockAuthManager: jest.Mocked<AuthManager>;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Setup mock REST API client
        mockRestApiClient = {
            sendChatMessage: jest.fn()
        } as any;

        // Setup mock auth manager
        mockAuthManager = {
            getAccessToken: jest.fn()
        } as any;

        // Setup integration mocks
        (integration.getRestApiClient as jest.Mock).mockReturnValue(mockRestApiClient);
        (integration.getAuthManager as jest.Mock).mockReturnValue(mockAuthManager);
    });

    describe("onTriggerEvent", () => {
        const mockTrigger = {} as any;
        const mockSendDataToOverlay = jest.fn();
        const mockAbortSignal = new AbortController().signal;

        it("should return false when no live chat ID is available", async () => {
            (integration.getCurrentLiveChatId as jest.Mock).mockReturnValue(null);

            const effect = { message: "Test message", chatter: "Streamer" as const };
            const result = await chatEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(false);
            expect(mockRestApiClient.sendChatMessage).not.toHaveBeenCalled();
        });

        it("should send message successfully", async () => {
            const liveChatId = "test-chat-id";
            const message = "Test message";

            (integration.getCurrentLiveChatId as jest.Mock).mockReturnValue(liveChatId);
            mockRestApiClient.sendChatMessage.mockResolvedValue(true);

            const effect = { message, chatter: "Streamer" as const };
            const result = await chatEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(true);
            expect(mockRestApiClient.sendChatMessage).toHaveBeenCalledWith(
                liveChatId,
                message
            );
        });

        it("should return false when sendChatMessage fails", async () => {
            const liveChatId = "test-chat-id";
            const message = "Test message";

            (integration.getCurrentLiveChatId as jest.Mock).mockReturnValue(liveChatId);
            mockRestApiClient.sendChatMessage.mockResolvedValue(false);

            const effect = { message, chatter: "Streamer" as const };
            const result = await chatEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(false);
        });

        it("should handle exceptions gracefully", async () => {
            (integration.getCurrentLiveChatId as jest.Mock).mockImplementation(() => {
                throw new Error("Test error");
            });

            const effect = { message: "Test message", chatter: "Streamer" as const };
            const result = await chatEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(false);
        });
    });
});
