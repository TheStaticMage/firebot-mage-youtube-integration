/* eslint-disable @typescript-eslint/unbound-method */
import { integration } from "../../integration";
import { RestApiClient } from "../../internal/rest-api-client";
import { chatEffect } from "../chat";

// Mock the integration module
jest.mock("../../integration", () => ({
    integration: {
        getCurrentLiveChatId: jest.fn(),
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

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Setup mock REST API client
        mockRestApiClient = {
            sendChatMessage: jest.fn()
        } as any;

        // Setup integration mocks
        (integration.getRestApiClient as jest.Mock).mockReturnValue(mockRestApiClient);
    });

    describe("onTriggerEvent", () => {
        const mockTrigger = {} as any;
        const mockSendDataToOverlay = jest.fn();
        const mockAbortSignal = new AbortController().signal;

        it("should send message in fire-and-forget mode", async () => {
            const message = "Test message";

            mockRestApiClient.sendChatMessage.mockResolvedValue(true);

            const effect = { message, chatter: "Streamer" as const };
            const result = await chatEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(true);
            expect(mockRestApiClient.sendChatMessage).toHaveBeenCalledWith(message);
        });

        it("should return true immediately even if sendChatMessage fails", async () => {
            const message = "Test message";

            mockRestApiClient.sendChatMessage.mockResolvedValue(false);

            const effect = { message, chatter: "Streamer" as const };
            const result = await chatEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(true);
        });

        it("should handle exceptions without crashing (fire-and-forget)", async () => {
            mockRestApiClient.sendChatMessage.mockRejectedValue(new Error("Test error"));

            const effect = { message: "Test message", chatter: "Streamer" as const };
            const result = await chatEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(true);
        });
    });
});
