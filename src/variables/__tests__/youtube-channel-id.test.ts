/* eslint-disable @typescript-eslint/unbound-method */
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubeChannelIdVariable } from "../youtube-channel-id";

jest.mock("../../integration-singleton", () => ({
    integration: {
        getCurrentChannelId: jest.fn()
    }
}));

import { integration } from "../../integration-singleton";

describe("youtubeChannelIdVariable.evaluator", () => {
    const mockGetCurrentChannelId = integration.getCurrentChannelId as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const makeTrigger = (): Trigger => ({
        type: "event",
        metadata: {
            username: "testuser"
        }
    } as Trigger);

    it("returns channel ID when available", () => {
        const trigger = makeTrigger();
        mockGetCurrentChannelId.mockReturnValue("UCrDkAvwXgOFDjlW9wqyYeIQ");

        const result = youtubeChannelIdVariable.evaluator(trigger);
        expect(result).toBe("UCrDkAvwXgOFDjlW9wqyYeIQ");
        expect(mockGetCurrentChannelId).toHaveBeenCalledTimes(1);
    });

    it("returns empty string when channel ID is null (stream not live)", () => {
        const trigger = makeTrigger();
        mockGetCurrentChannelId.mockReturnValue(null);

        const result = youtubeChannelIdVariable.evaluator(trigger);
        expect(result).toBe("");
        expect(mockGetCurrentChannelId).toHaveBeenCalledTimes(1);
    });
});
