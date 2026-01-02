/* eslint-disable @typescript-eslint/unbound-method */
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubeLiveChatIdVariable } from "../youtube-live-chat-id";

jest.mock("../../integration-singleton", () => ({
    integration: {
        getCurrentLiveChatId: jest.fn()
    }
}));

import { integration } from "../../integration-singleton";

describe("youtubeLiveChatIdVariable.evaluator", () => {
    const mockGetCurrentLiveChatId = integration.getCurrentLiveChatId as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const makeTrigger = (): Trigger => ({
        type: "event",
        metadata: {
            username: "testuser"
        }
    } as Trigger);

    it("returns live chat ID when available", () => {
        const trigger = makeTrigger();
        mockGetCurrentLiveChatId.mockReturnValue("KjQqz1AmIbw.1234567890123456");

        const result = youtubeLiveChatIdVariable.evaluator(trigger);
        expect(result).toBe("KjQqz1AmIbw.1234567890123456");
        expect(mockGetCurrentLiveChatId).toHaveBeenCalledTimes(1);
    });

    it("returns empty string when live chat ID is null (stream not live)", () => {
        const trigger = makeTrigger();
        mockGetCurrentLiveChatId.mockReturnValue(null);

        const result = youtubeLiveChatIdVariable.evaluator(trigger);
        expect(result).toBe("");
        expect(mockGetCurrentLiveChatId).toHaveBeenCalledTimes(1);
    });
});
