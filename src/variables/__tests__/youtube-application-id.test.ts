/* eslint-disable @typescript-eslint/unbound-method */
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubeApplicationIdVariable } from "../youtube-application-id";

jest.mock("../../integration-singleton", () => ({
    integration: {
        getApplicationManager: jest.fn()
    }
}));

import { integration } from "../../integration-singleton";

describe("youtubeApplicationIdVariable.evaluator (parameter-based)", () => {
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

    describe("with 'trigger' parameter", () => {
        it("returns applicationId from eventData when present", () => {
            const trigger = makeTrigger({
                applicationId: "trigger-app-id-123"
            });

            const result = youtubeApplicationIdVariable.evaluator(trigger, "trigger");
            expect(result).toBe("trigger-app-id-123");
        });

        it("returns null when eventData has no applicationId", () => {
            const trigger = makeTrigger({
                otherField: "some-value"
            });

            const result = youtubeApplicationIdVariable.evaluator(trigger, "trigger");
            expect(result).toBeNull();
        });

        it("returns null when eventData is missing", () => {
            const trigger = makeTrigger(undefined);

            const result = youtubeApplicationIdVariable.evaluator(trigger, "trigger");
            expect(result).toBeNull();
        });
    });

    describe("with 'current' parameter", () => {
        it("returns current active application ID", () => {
            mockGetActiveApplication.mockReturnValue({
                id: "current-app-id-456",
                name: "Current App"
            });

            const trigger = makeTrigger({});
            const result = youtubeApplicationIdVariable.evaluator(trigger, "current");
            expect(result).toBe("current-app-id-456");
            expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
        });

        it("returns null when no active application exists", () => {
            mockGetActiveApplication.mockReturnValue(null);

            const trigger = makeTrigger({});
            const result = youtubeApplicationIdVariable.evaluator(trigger, "current");
            expect(result).toBeNull();
        });

        it("returns null when active application has no id", () => {
            mockGetActiveApplication.mockReturnValue({
                name: "App Without ID"
            });

            const trigger = makeTrigger({});
            const result = youtubeApplicationIdVariable.evaluator(trigger, "current");
            expect(result).toBeNull();
        });
    });

    describe("with unknown parameter", () => {
        it("returns null for any parameter other than trigger or current", () => {
            const trigger = makeTrigger({});
            const result = youtubeApplicationIdVariable.evaluator(trigger, "some-uuid-123");
            expect(result).toBeNull();
        });
    });

    describe("with no parameter (default behavior)", () => {
        it("returns trigger value when eventData has applicationId", () => {
            const trigger = makeTrigger({
                applicationId: "trigger-app-id"
            });
            mockGetActiveApplication.mockReturnValue({
                id: "current-app-id",
                name: "Current App"
            });

            const result = youtubeApplicationIdVariable.evaluator(trigger);
            expect(result).toBe("trigger-app-id");
            expect(mockGetActiveApplication).not.toHaveBeenCalled();
        });

        it("falls back to current when eventData has no applicationId", () => {
            const trigger = makeTrigger({
                otherField: "some-value"
            });
            mockGetActiveApplication.mockReturnValue({
                id: "fallback-app-id",
                name: "Fallback App"
            });

            const result = youtubeApplicationIdVariable.evaluator(trigger);
            expect(result).toBe("fallback-app-id");
            expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
        });

        it("returns null when neither trigger nor current available", () => {
            const trigger = makeTrigger(undefined);
            mockGetActiveApplication.mockReturnValue(null);

            const result = youtubeApplicationIdVariable.evaluator(trigger);
            expect(result).toBeNull();
        });
    });
});
