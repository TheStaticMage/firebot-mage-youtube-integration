/* eslint-disable @typescript-eslint/unbound-method */
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubeApplicationNameVariable } from "../youtube-application-name";

jest.mock("../../integration-singleton", () => ({
    integration: {
        getApplicationManager: jest.fn()
    }
}));

import { integration } from "../../integration-singleton";

describe("youtubeApplicationNameVariable.evaluator (parameter-based)", () => {
    const mockGetActiveApplication = jest.fn();
    const mockGetApplication = jest.fn();
    const mockGetApplicationManager = integration.getApplicationManager as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetApplicationManager.mockReturnValue({
            getActiveApplication: mockGetActiveApplication,
            getApplication: mockGetApplication
        });
    });

    const makeTrigger = (eventData?: any): Trigger =>
        ({
            type: "event",
            metadata: {
                username: "testuser",
                eventData
            }
        }) as Trigger;

    describe("with 'trigger' parameter", () => {
        it("returns applicationName from eventData when present", () => {
            const trigger = makeTrigger({
                applicationName: "Trigger App Name"
            });

            const result = youtubeApplicationNameVariable.evaluator(trigger, "trigger");
            expect(result).toBe("Trigger App Name");
        });

        it("returns null when eventData has no applicationName", () => {
            const trigger = makeTrigger({
                applicationId: "some-id"
            });

            const result = youtubeApplicationNameVariable.evaluator(trigger, "trigger");
            expect(result).toBeNull();
        });

        it("returns null when eventData is missing", () => {
            const trigger = makeTrigger(undefined);

            const result = youtubeApplicationNameVariable.evaluator(trigger, "trigger");
            expect(result).toBeNull();
        });
    });

    describe("with 'current' parameter", () => {
        it("returns current active application name", () => {
            mockGetActiveApplication.mockReturnValue({
                id: "current-app-id",
                name: "Current App Name"
            });

            const trigger = makeTrigger({});
            const result = youtubeApplicationNameVariable.evaluator(trigger, "current");
            expect(result).toBe("Current App Name");
        });

        it("returns null when no active application exists", () => {
            mockGetActiveApplication.mockReturnValue(null);

            const trigger = makeTrigger({});
            const result = youtubeApplicationNameVariable.evaluator(trigger, "current");
            expect(result).toBeNull();
        });

        it("returns null when active application has no name", () => {
            mockGetActiveApplication.mockReturnValue({
                id: "app-id"
            });

            const trigger = makeTrigger({});
            const result = youtubeApplicationNameVariable.evaluator(trigger, "current");
            expect(result).toBeNull();
        });
    });

    describe("with UUID parameter", () => {
        it("looks up application by ID and returns its name", () => {
            mockGetApplication.mockReturnValue({
                id: "specific-uuid-123",
                name: "Specific App Name"
            });

            const trigger = makeTrigger({});
            const result = youtubeApplicationNameVariable.evaluator(trigger, "specific-uuid-123");
            expect(result).toBe("Specific App Name");
            expect(mockGetApplication).toHaveBeenCalledWith("specific-uuid-123");
        });

        it("returns null when application ID is invalid", () => {
            mockGetApplication.mockReturnValue(null);

            const trigger = makeTrigger({});
            const result = youtubeApplicationNameVariable.evaluator(trigger, "invalid-uuid");
            expect(result).toBeNull();
        });

        it("returns null when application has no name", () => {
            mockGetApplication.mockReturnValue({
                id: "valid-uuid",
                clientId: "some-client"
            });

            const trigger = makeTrigger({});
            const result = youtubeApplicationNameVariable.evaluator(trigger, "valid-uuid");
            expect(result).toBeNull();
        });
    });

    describe("with no parameter (default behavior)", () => {
        it("returns trigger value when eventData has applicationName", () => {
            const trigger = makeTrigger({
                applicationName: "Trigger App"
            });
            mockGetActiveApplication.mockReturnValue({
                id: "current-id",
                name: "Current App"
            });

            const result = youtubeApplicationNameVariable.evaluator(trigger);
            expect(result).toBe("Trigger App");
            expect(mockGetActiveApplication).not.toHaveBeenCalled();
        });

        it("falls back to current when eventData has no applicationName", () => {
            const trigger = makeTrigger({
                otherField: "some-value"
            });
            mockGetActiveApplication.mockReturnValue({
                id: "fallback-id",
                name: "Fallback App"
            });

            const result = youtubeApplicationNameVariable.evaluator(trigger);
            expect(result).toBe("Fallback App");
            expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
        });

        it("returns null when neither trigger nor current available", () => {
            const trigger = makeTrigger(undefined);
            mockGetActiveApplication.mockReturnValue(null);

            const result = youtubeApplicationNameVariable.evaluator(trigger);
            expect(result).toBeNull();
        });
    });
});
