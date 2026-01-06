import type { YouTubeIntegration } from "../../integration-singleton";
import { registerRoutes } from "../server";

jest.mock("../../main", () => ({
    firebot: {
        modules: {
            httpServer: {
                registerCustomRoute: jest.fn(),
                unregisterCustomRoute: jest.fn()
            },
            frontendCommunicator: {
                send: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    }
}));

const { firebot } = jest.requireMock("../../main");

const createIntegration = (overrides: Partial<any> = {}) => ({
    connected: true,
    isLive: jest.fn().mockReturnValue(true),
    getApplicationsStorage: jest.fn().mockReturnValue({
        activeApplicationId: "app-1",
        applications: {
            "app-1": { id: "app-1" }
        }
    }),
    queueChatMessage: jest.fn(),
    ...overrides
});

const getSendChatHandler = () => {
    const registerCustomRoute = firebot.modules.httpServer.registerCustomRoute as jest.Mock;
    const routeCall = registerCustomRoute.mock.calls.find(call => call[1] === "operations/send-chat-message");
    return routeCall?.[3];
};

describe("send-chat-message route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("blocks when integration is disconnected", async () => {
        const queueChatMessage = jest.fn();
        const youtubeIntegration = createIntegration({
            connected: false,
            queueChatMessage
        }) as unknown as YouTubeIntegration;
        registerRoutes(youtubeIntegration);

        const handler = getSendChatHandler();
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await handler(
            { body: { message: "Hello", chatter: "Streamer", offlineSendMode: "send-anyway" } },
            res
        );

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: "Integration not connected" });
        expect(firebot.modules.frontendCommunicator.send).not.toHaveBeenCalled();
        expect(queueChatMessage).not.toHaveBeenCalled();
    });

    it("blocks when offlineSendMode is do-not-send and integration is offline", async () => {
        const queueChatMessage = jest.fn();
        const youtubeIntegration = createIntegration({
            isLive: jest.fn().mockReturnValue(false),
            queueChatMessage
        }) as unknown as YouTubeIntegration;
        registerRoutes(youtubeIntegration);

        const handler = getSendChatHandler();
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await handler(
            { body: { message: "Hello", chatter: "Streamer", offlineSendMode: "do-not-send" } },
            res
        );

        expect(res.json).toHaveBeenCalledWith({ success: false, error: "Stream offline" });
        expect(firebot.modules.frontendCommunicator.send).not.toHaveBeenCalled();
        expect(queueChatMessage).not.toHaveBeenCalled();
    });

    it("posts a chat feed alert when blocked and offlineSendMode is chat-feed-only", async () => {
        const queueChatMessage = jest.fn();
        const youtubeIntegration = createIntegration({
            isLive: jest.fn().mockReturnValue(false),
            queueChatMessage
        }) as unknown as YouTubeIntegration;
        registerRoutes(youtubeIntegration);

        const handler = getSendChatHandler();
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await handler(
            { body: { message: "Hello", chatter: "Streamer", offlineSendMode: "chat-feed-only" } },
            res
        );

        expect(firebot.modules.frontendCommunicator.send).toHaveBeenCalledWith("chatUpdate", {
            fbEvent: "ChatAlert",
            message: "[Not sent (YouTube): Stream offline] Hello",
            icon: "fad fa-exclamation-triangle"
        });
        expect(queueChatMessage).not.toHaveBeenCalled();
    });

    it("queues the message and returns success immediately", async () => {
        const queueChatMessage = jest.fn();
        const youtubeIntegration = createIntegration({
            queueChatMessage
        }) as unknown as YouTubeIntegration;
        registerRoutes(youtubeIntegration);

        const handler = getSendChatHandler();
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await handler(
            { body: { message: "Hello", chatter: "Streamer", offlineSendMode: "send-anyway" } },
            res
        );

        expect(queueChatMessage).toHaveBeenCalledWith("Hello");
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });
});
