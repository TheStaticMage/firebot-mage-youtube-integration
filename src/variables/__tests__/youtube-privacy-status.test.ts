/* eslint-disable @typescript-eslint/unbound-method */
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubePrivacyStatusVariable } from "../youtube-privacy-status";

jest.mock("../../integration-singleton", () => ({
    integration: {
        getCurrentBroadcastPrivacyStatus: jest.fn()
    }
}));

import { integration } from "../../integration-singleton";

describe("youtubePrivacyStatusVariable.evaluator", () => {
    const mockGetCurrentBroadcastPrivacyStatus = integration.getCurrentBroadcastPrivacyStatus as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const makeTrigger = (): Trigger => ({
        type: "event",
        metadata: {
            username: "testuser"
        }
    } as Trigger);

    it("returns privacy status 'public' when available", () => {
        const trigger = makeTrigger();
        mockGetCurrentBroadcastPrivacyStatus.mockReturnValue("public");

        const result = youtubePrivacyStatusVariable.evaluator(trigger);
        expect(result).toBe("public");
        expect(mockGetCurrentBroadcastPrivacyStatus).toHaveBeenCalledTimes(1);
    });

    it("returns privacy status 'private' when available", () => {
        const trigger = makeTrigger();
        mockGetCurrentBroadcastPrivacyStatus.mockReturnValue("private");

        const result = youtubePrivacyStatusVariable.evaluator(trigger);
        expect(result).toBe("private");
        expect(mockGetCurrentBroadcastPrivacyStatus).toHaveBeenCalledTimes(1);
    });

    it("returns privacy status 'unlisted' when available", () => {
        const trigger = makeTrigger();
        mockGetCurrentBroadcastPrivacyStatus.mockReturnValue("unlisted");

        const result = youtubePrivacyStatusVariable.evaluator(trigger);
        expect(result).toBe("unlisted");
        expect(mockGetCurrentBroadcastPrivacyStatus).toHaveBeenCalledTimes(1);
    });

    it("returns empty string when privacy status is null (stream not live)", () => {
        const trigger = makeTrigger();
        mockGetCurrentBroadcastPrivacyStatus.mockReturnValue(null);

        const result = youtubePrivacyStatusVariable.evaluator(trigger);
        expect(result).toBe("");
        expect(mockGetCurrentBroadcastPrivacyStatus).toHaveBeenCalledTimes(1);
    });

    it("returns empty string when privacy status is undefined", () => {
        const trigger = makeTrigger();
        mockGetCurrentBroadcastPrivacyStatus.mockReturnValue(undefined);

        const result = youtubePrivacyStatusVariable.evaluator(trigger);
        expect(result).toBe("");
        expect(mockGetCurrentBroadcastPrivacyStatus).toHaveBeenCalledTimes(1);
    });
});
