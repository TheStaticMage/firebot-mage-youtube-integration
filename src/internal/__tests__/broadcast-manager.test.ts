import { BroadcastManager } from "../broadcast-manager";
import { ErrorTracker } from "../error-tracker";

jest.mock("../../main", () => ({
    firebot: {
        modules: {
            eventManager: {
                triggerEvent: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock("../error-tracker");

const mockIntegration = {
    getQuotaManager: jest.fn()
};

describe("BroadcastManager.findLiveBroadcast", () => {
    let broadcastManager: BroadcastManager;
    let mockListFn: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockIntegration.getQuotaManager.mockClear();
        broadcastManager = new BroadcastManager(mockIntegration as any, new ErrorTracker());
        mockListFn = jest.fn();
        broadcastManager["youtube"].liveBroadcasts.list = mockListFn;
    });

    it("returns BroadcastInfo with all three fields on successful single stream", async () => {
        const mockResponse = {
            data: {
                items: [
                    {
                        id: "KjQqz1AmIbw",
                        snippet: {
                            liveChatId: "KjQqz1AmIbw.1234567890123456",
                            channelId: "UCrDkAvwXgOFDjlW9wqyYeIQ",
                            title: "Test Stream"
                        }
                    }
                ]
            }
        };

        mockListFn.mockResolvedValue(mockResponse);
        mockIntegration.getQuotaManager.mockReturnValue({
            recordApiCall: jest.fn()
        });

        const result = await broadcastManager.findLiveBroadcast("test-token", undefined, "app-id");

        expect(result).toEqual({
            liveChatId: "KjQqz1AmIbw.1234567890123456",
            broadcastId: "KjQqz1AmIbw",
            channelId: "UCrDkAvwXgOFDjlW9wqyYeIQ"
        });
    });

    it("returns null when no broadcasts found", async () => {
        const mockResponse = {
            data: {
                items: []
            }
        };

        mockListFn.mockResolvedValue(mockResponse);
        mockIntegration.getQuotaManager.mockReturnValue({
            recordApiCall: jest.fn()
        });

        const result = await broadcastManager.findLiveBroadcast("test-token", undefined, "app-id");

        expect(result).toBeNull();
    });

    it("returns null when broadcast has no liveChatId", async () => {
        const mockResponse = {
            data: {
                items: [
                    {
                        id: "KjQqz1AmIbw",
                        snippet: {
                            channelId: "UCrDkAvwXgOFDjlW9wqyYeIQ",
                            title: "Test Stream"
                        }
                    }
                ]
            }
        };

        mockListFn.mockResolvedValue(mockResponse);
        mockIntegration.getQuotaManager.mockReturnValue({
            recordApiCall: jest.fn()
        });

        const result = await broadcastManager.findLiveBroadcast("test-token", undefined, "app-id");

        expect(result).toBeNull();
    });

    it("returns null when broadcast has no broadcastId", async () => {
        const mockResponse = {
            data: {
                items: [
                    {
                        snippet: {
                            liveChatId: "KjQqz1AmIbw.1234567890123456",
                            channelId: "UCrDkAvwXgOFDjlW9wqyYeIQ",
                            title: "Test Stream"
                        }
                    }
                ]
            }
        };

        mockListFn.mockResolvedValue(mockResponse);
        mockIntegration.getQuotaManager.mockReturnValue({
            recordApiCall: jest.fn()
        });

        const result = await broadcastManager.findLiveBroadcast("test-token", undefined, "app-id");

        expect(result).toBeNull();
    });

    it("returns null when broadcast has no channelId", async () => {
        const mockResponse = {
            data: {
                items: [
                    {
                        id: "KjQqz1AmIbw",
                        snippet: {
                            liveChatId: "KjQqz1AmIbw.1234567890123456",
                            title: "Test Stream"
                        }
                    }
                ]
            }
        };

        mockListFn.mockResolvedValue(mockResponse);
        mockIntegration.getQuotaManager.mockReturnValue({
            recordApiCall: jest.fn()
        });

        const result = await broadcastManager.findLiveBroadcast("test-token", undefined, "app-id");

        expect(result).toBeNull();
    });

    it("filters by channelId when multiple streams exist", async () => {
        const mockResponse = {
            data: {
                items: [
                    {
                        id: "broadcast1",
                        snippet: {
                            liveChatId: "chat1",
                            channelId: "channel-other",
                            title: "Other Stream"
                        }
                    },
                    {
                        id: "broadcast2",
                        snippet: {
                            liveChatId: "chat2",
                            channelId: "UCrDkAvwXgOFDjlW9wqyYeIQ",
                            title: "My Stream"
                        }
                    }
                ]
            }
        };

        mockListFn.mockResolvedValue(mockResponse);
        mockIntegration.getQuotaManager.mockReturnValue({
            recordApiCall: jest.fn()
        });

        const result = await broadcastManager.findLiveBroadcast("test-token", "UCrDkAvwXgOFDjlW9wqyYeIQ", "app-id");

        expect(result).toEqual({
            liveChatId: "chat2",
            broadcastId: "broadcast2",
            channelId: "UCrDkAvwXgOFDjlW9wqyYeIQ"
        });
    });

    it("returns null when no broadcasts match the channel ID filter", async () => {
        const mockResponse = {
            data: {
                items: [
                    {
                        id: "broadcast1",
                        snippet: {
                            liveChatId: "chat1",
                            channelId: "channel-other",
                            title: "Other Stream"
                        }
                    },
                    {
                        id: "broadcast2",
                        snippet: {
                            liveChatId: "chat2",
                            channelId: "channel-another",
                            title: "Another Stream"
                        }
                    }
                ]
            }
        };

        mockListFn.mockResolvedValue(mockResponse);
        mockIntegration.getQuotaManager.mockReturnValue({
            recordApiCall: jest.fn()
        });

        const result = await broadcastManager.findLiveBroadcast("test-token", "UCrDkAvwXgOFDjlW9wqyYeIQ", "app-id");

        expect(result).toBeNull();
    });

    it("throws error when multiple streams and no channelId provided", async () => {
        const mockResponse = {
            data: {
                items: [
                    {
                        id: "broadcast1",
                        snippet: { title: "Stream 1" }
                    },
                    {
                        id: "broadcast2",
                        snippet: { title: "Stream 2" }
                    }
                ]
            }
        };

        mockListFn.mockResolvedValue(mockResponse);
        mockIntegration.getQuotaManager.mockReturnValue({
            recordApiCall: jest.fn()
        });

        await expect(broadcastManager.findLiveBroadcast("test-token", undefined, "app-id"))
            .rejects
            .toThrow(/Multiple active YouTube streams detected/);
    });

    it("throws error when multiple matching broadcasts for channel ID", async () => {
        const mockResponse = {
            data: {
                items: [
                    {
                        id: "broadcast1",
                        snippet: {
                            title: "Stream 1",
                            channelId: "UCrDkAvwXgOFDjlW9wqyYeIQ"
                        }
                    },
                    {
                        id: "broadcast2",
                        snippet: {
                            title: "Stream 2",
                            channelId: "UCrDkAvwXgOFDjlW9wqyYeIQ"
                        }
                    }
                ]
            }
        };

        mockListFn.mockResolvedValue(mockResponse);
        mockIntegration.getQuotaManager.mockReturnValue({
            recordApiCall: jest.fn()
        });

        await expect(broadcastManager.findLiveBroadcast("test-token", "UCrDkAvwXgOFDjlW9wqyYeIQ", "app-id"))
            .rejects
            .toThrow(/Multiple active streams for channel/);
    });

    it("records quota consumption on successful call", async () => {
        const mockResponse = {
            data: {
                items: [
                    {
                        id: "KjQqz1AmIbw",
                        snippet: {
                            liveChatId: "chat-id",
                            channelId: "channel-id",
                            title: "Test Stream"
                        }
                    }
                ]
            }
        };

        mockListFn.mockResolvedValue(mockResponse);
        const mockQuotaManager = {
            recordApiCall: jest.fn()
        };
        mockIntegration.getQuotaManager.mockReturnValue(mockQuotaManager);

        await broadcastManager.findLiveBroadcast("test-token", undefined, "app-id");

        expect(mockQuotaManager.recordApiCall).toHaveBeenCalledWith(
            "app-id",
            "liveBroadcasts.list",
            expect.any(Number)
        );
    });
});
