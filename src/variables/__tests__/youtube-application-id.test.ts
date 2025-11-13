/* eslint-disable @typescript-eslint/unbound-method */
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubeApplicationIdVariable } from "../youtube-application-id";

jest.mock("../../integration-singleton", () => ({
    integration: {
        getApplicationManager: jest.fn()
    }
}));

import { integration } from "../../integration-singleton";

describe("youtubeApplicationIdVariable.evaluator", () => {
    const mockGetActiveApplication = jest.fn();
    const mockGetApplicationManager = integration.getApplicationManager as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetApplicationManager.mockReturnValue({
            getActiveApplication: mockGetActiveApplication
        });
    });

    const makeTrigger = (eventData?: any): Trigger => ({
        type: "event",
        metadata: {
            username: "testuser",
            eventData
        }
    } as Trigger);

    it("returns applicationId from eventData when present", () => {
        const trigger = makeTrigger({
            applicationId: "test-app-id-123"
        });

        const result = youtubeApplicationIdVariable.evaluator(trigger);
        expect(result).toBe("test-app-id-123");
        expect(mockGetActiveApplication).not.toHaveBeenCalled();
    });

    it("falls back to active application ID when eventData is missing", () => {
        const trigger = makeTrigger(undefined);
        mockGetActiveApplication.mockReturnValue({
            id: "fallback-app-id-456",
            name: "Fallback App"
        });

        const result = youtubeApplicationIdVariable.evaluator(trigger);
        expect(result).toBe("fallback-app-id-456");
        expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
    });

    it("falls back to active application ID when eventData.applicationId is missing", () => {
        const trigger = makeTrigger({
            applicationName: "Some App"
        });
        mockGetActiveApplication.mockReturnValue({
            id: "fallback-app-id-789",
            name: "Another App"
        });

        const result = youtubeApplicationIdVariable.evaluator(trigger);
        expect(result).toBe("fallback-app-id-789");
        expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
    });

    it("returns empty string when no active application exists", () => {
        const trigger = makeTrigger(undefined);
        mockGetActiveApplication.mockReturnValue(null);

        const result = youtubeApplicationIdVariable.evaluator(trigger);
        expect(result).toBe("");
        expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
    });

    it("returns empty string when active application exists but has no id", () => {
        const trigger = makeTrigger(undefined);
        mockGetActiveApplication.mockReturnValue({
            name: "App Without ID"
        });

        const result = youtubeApplicationIdVariable.evaluator(trigger);
        expect(result).toBe("");
        expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
    });

    it("prefers eventData over active application", () => {
        const trigger = makeTrigger({
            applicationId: "event-app-id"
        });
        mockGetActiveApplication.mockReturnValue({
            id: "active-app-id",
            name: "Active App"
        });

        const result = youtubeApplicationIdVariable.evaluator(trigger);
        expect(result).toBe("event-app-id");
        expect(mockGetActiveApplication).not.toHaveBeenCalled();
    });
});
