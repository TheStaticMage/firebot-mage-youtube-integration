/* eslint-disable @typescript-eslint/unbound-method */
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubeApplicationNameVariable } from "../youtube-application-name";

jest.mock("../../integration-singleton", () => ({
    integration: {
        getApplicationManager: jest.fn()
    }
}));

import { integration } from "../../integration-singleton";

describe("youtubeApplicationNameVariable.evaluator", () => {
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

    const makeTrigger = (eventData?: any): Trigger => ({
        type: "event",
        metadata: {
            username: "testuser",
            eventData
        }
    } as Trigger);

    it("returns applicationName from eventData when present", () => {
        const trigger = makeTrigger({
            applicationName: "Test Application"
        });

        const result = youtubeApplicationNameVariable.evaluator(trigger);
        expect(result).toBe("Test Application");
        expect(mockGetActiveApplication).not.toHaveBeenCalled();
    });

    it("falls back to active application name when eventData is missing", () => {
        const trigger = makeTrigger(undefined);
        mockGetActiveApplication.mockReturnValue({
            id: "app-id-123",
            name: "Fallback Application"
        });

        const result = youtubeApplicationNameVariable.evaluator(trigger);
        expect(result).toBe("Fallback Application");
        expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
    });

    it("falls back to active application name when eventData.applicationName is missing", () => {
        const trigger = makeTrigger({
            applicationId: "app-id-456"
        });
        mockGetActiveApplication.mockReturnValue({
            id: "app-id-456",
            name: "Another Application"
        });

        const result = youtubeApplicationNameVariable.evaluator(trigger);
        expect(result).toBe("Another Application");
        expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
    });

    it("returns empty string when no active application exists", () => {
        const trigger = makeTrigger(undefined);
        mockGetActiveApplication.mockReturnValue(null);

        const result = youtubeApplicationNameVariable.evaluator(trigger);
        expect(result).toBe("");
        expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
    });

    it("returns empty string when active application exists but has no name", () => {
        const trigger = makeTrigger(undefined);
        mockGetActiveApplication.mockReturnValue({
            id: "app-without-name"
        });

        const result = youtubeApplicationNameVariable.evaluator(trigger);
        expect(result).toBe("");
        expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
    });

    it("prefers eventData over active application", () => {
        const trigger = makeTrigger({
            applicationName: "Event Application"
        });
        mockGetActiveApplication.mockReturnValue({
            id: "active-app-id",
            name: "Active Application"
        });

        const result = youtubeApplicationNameVariable.evaluator(trigger);
        expect(result).toBe("Event Application");
        expect(mockGetActiveApplication).not.toHaveBeenCalled();
    });

    describe("with applicationId argument", () => {
        it("returns application name for given UUID", () => {
            const trigger = makeTrigger(undefined);
            mockGetApplication.mockReturnValue({
                id: "specific-app-id",
                name: "Specific Application"
            });

            const result = youtubeApplicationNameVariable.evaluator(trigger, "specific-app-id");
            expect(result).toBe("Specific Application");
            expect(mockGetApplication).toHaveBeenCalledWith("specific-app-id");
            expect(mockGetActiveApplication).not.toHaveBeenCalled();
        });

        it("returns empty string when application with given UUID does not exist", () => {
            const trigger = makeTrigger(undefined);
            mockGetApplication.mockReturnValue(null);

            const result = youtubeApplicationNameVariable.evaluator(trigger, "nonexistent-id");
            expect(result).toBe("");
            expect(mockGetApplication).toHaveBeenCalledWith("nonexistent-id");
            expect(mockGetActiveApplication).not.toHaveBeenCalled();
        });

        it("returns empty string when application exists but has no name", () => {
            const trigger = makeTrigger(undefined);
            mockGetApplication.mockReturnValue({
                id: "app-without-name"
            });

            const result = youtubeApplicationNameVariable.evaluator(trigger, "app-without-name");
            expect(result).toBe("");
            expect(mockGetApplication).toHaveBeenCalledWith("app-without-name");
        });

        it("prioritizes applicationId argument over eventData", () => {
            const trigger = makeTrigger({
                applicationName: "Event Application"
            });
            mockGetApplication.mockReturnValue({
                id: "arg-app-id",
                name: "Argument Application"
            });

            const result = youtubeApplicationNameVariable.evaluator(trigger, "arg-app-id");
            expect(result).toBe("Argument Application");
            expect(mockGetApplication).toHaveBeenCalledWith("arg-app-id");
            expect(mockGetActiveApplication).not.toHaveBeenCalled();
        });

        it("prioritizes applicationId argument over active application", () => {
            const trigger = makeTrigger(undefined);
            mockGetApplication.mockReturnValue({
                id: "arg-app-id",
                name: "Argument Application"
            });
            mockGetActiveApplication.mockReturnValue({
                id: "active-app-id",
                name: "Active Application"
            });

            const result = youtubeApplicationNameVariable.evaluator(trigger, "arg-app-id");
            expect(result).toBe("Argument Application");
            expect(mockGetApplication).toHaveBeenCalledWith("arg-app-id");
            expect(mockGetActiveApplication).not.toHaveBeenCalled();
        });
    });
});
