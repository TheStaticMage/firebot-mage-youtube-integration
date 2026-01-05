import { YouTubeIntegration } from "../integration-singleton";

jest.mock("../main", () => ({
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

describe("Chat feed send handling", () => {
    let integration: YouTubeIntegration;
    let sendChatMessage: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        integration = new YouTubeIntegration();
        sendChatMessage = jest.fn().mockResolvedValue(true);
        (integration as any).restApiClient = { sendChatMessage };
    });

    it("returns false when chat feed sending is disabled", async () => {
        (integration as any).settings.chat.chatSend = false;
        integration.connected = true;
        (integration as any).currentLiveChatId = "live-id";

        const result = await (integration as any).handleChatMessageTypedInChatFeed({
            message: "Hello",
            accountType: "Streamer"
        });

        expect(result).toBe(false);
        expect(sendChatMessage).not.toHaveBeenCalled();
    });

    it("returns false when integration is disconnected", async () => {
        (integration as any).settings.chat.chatSend = true;
        integration.connected = false;
        (integration as any).currentLiveChatId = "live-id";

        const result = await (integration as any).handleChatMessageTypedInChatFeed({
            message: "Hello",
            accountType: "Streamer"
        });

        expect(result).toBe(false);
        expect(sendChatMessage).not.toHaveBeenCalled();
    });

    it("returns false when no live chat is active", async () => {
        (integration as any).settings.chat.chatSend = true;
        integration.connected = true;
        (integration as any).currentLiveChatId = null;

        const result = await (integration as any).handleChatMessageTypedInChatFeed({
            message: "Hello",
            accountType: "Streamer"
        });

        expect(result).toBe(false);
        expect(sendChatMessage).not.toHaveBeenCalled();
    });

    it("sends chat message when enabled and live", async () => {
        (integration as any).settings.chat.chatSend = true;
        integration.connected = true;
        (integration as any).currentLiveChatId = "live-id";

        const result = await (integration as any).handleChatMessageTypedInChatFeed({
            message: "Hello",
            accountType: "Bot",
            replyToMessageId: "reply-id"
        });

        expect(result).toBe(true);
        expect(sendChatMessage).toHaveBeenCalledWith("Hello");
    });
});
