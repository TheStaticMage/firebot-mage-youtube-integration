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
    getRestApiClient: jest.fn().mockReturnValue({
        sendChatMessage: jest.fn().mockResolvedValue(true)
    }),
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

    it("blocks when sendMode is when-connected and integration is disconnected", async () => {
        const sendChatMessage = jest.fn().mockResolvedValue(true);
        const youtubeIntegration = createIntegration({
            connected: false,
            getRestApiClient: jest.fn().mockReturnValue({ sendChatMessage })
        }) as unknown as YouTubeIntegration;
        registerRoutes(youtubeIntegration);

        const handler = getSendChatHandler();
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await handler(
            { body: { message: "Hello", chatter: "Streamer", sendMode: "when-connected", sendToChatFeed: false } },
            res
        );

        expect(res.json).toHaveBeenCalledWith({ success: false, error: "Not connected" });
        expect(firebot.modules.frontendCommunicator.send).not.toHaveBeenCalled();
        expect(sendChatMessage).not.toHaveBeenCalled();
    });

    it("blocks when sendMode is when-live and integration is offline", async () => {
        const sendChatMessage = jest.fn().mockResolvedValue(true);
        const youtubeIntegration = createIntegration({
            isLive: jest.fn().mockReturnValue(false),
            getRestApiClient: jest.fn().mockReturnValue({ sendChatMessage })
        }) as unknown as YouTubeIntegration;
        registerRoutes(youtubeIntegration);

        const handler = getSendChatHandler();
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await handler(
            { body: { message: "Hello", chatter: "Streamer", sendMode: "when-live", sendToChatFeed: false } },
            res
        );

        expect(res.json).toHaveBeenCalledWith({ success: false, error: "Stream offline" });
        expect(firebot.modules.frontendCommunicator.send).not.toHaveBeenCalled();
        expect(sendChatMessage).not.toHaveBeenCalled();
    });

    it("posts a chat feed alert when blocked and sendToChatFeed is true", async () => {
        const youtubeIntegration = createIntegration({ connected: false }) as unknown as YouTubeIntegration;
        registerRoutes(youtubeIntegration);

        const handler = getSendChatHandler();
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await handler(
            { body: { message: "Hello", chatter: "Streamer", sendMode: "when-connected", sendToChatFeed: true } },
            res
        );

        expect(firebot.modules.frontendCommunicator.send).toHaveBeenCalledWith("chatUpdate", {
            fbEvent: "ChatAlert",
            message: "[Not sent (YouTube): Not connected] Hello",
            icon: "fad fa-exclamation-triangle"
        });
    });
});
