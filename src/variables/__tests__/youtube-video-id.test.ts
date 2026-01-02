/* eslint-disable @typescript-eslint/unbound-method */
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubeVideoIdVariable } from "../youtube-video-id";

jest.mock("../../integration-singleton", () => ({
    integration: {
        getCurrentBroadcastId: jest.fn()
    }
}));

import { integration } from "../../integration-singleton";

describe("youtubeVideoIdVariable.evaluator", () => {
    const mockGetCurrentBroadcastId = integration.getCurrentBroadcastId as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const makeTrigger = (): Trigger => ({
        type: "event",
        metadata: {
            username: "testuser"
        }
    } as Trigger);

    it("returns video ID when available", () => {
        const trigger = makeTrigger();
        mockGetCurrentBroadcastId.mockReturnValue("KjQqz1AmIbw");

        const result = youtubeVideoIdVariable.evaluator(trigger);
        expect(result).toBe("KjQqz1AmIbw");
        expect(mockGetCurrentBroadcastId).toHaveBeenCalledTimes(1);
    });

    it("returns empty string when video ID is null (stream not live)", () => {
        const trigger = makeTrigger();
        mockGetCurrentBroadcastId.mockReturnValue(null);

        const result = youtubeVideoIdVariable.evaluator(trigger);
        expect(result).toBe("");
        expect(mockGetCurrentBroadcastId).toHaveBeenCalledTimes(1);
    });
});
