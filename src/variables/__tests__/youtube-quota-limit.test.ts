/* eslint-disable @typescript-eslint/unbound-method */
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubeQuotaLimitVariable } from "../youtube-quota-limit";

jest.mock("../../integration-singleton", () => ({
    integration: {
        getApplicationManager: jest.fn()
    }
}));

import { integration } from "../../integration-singleton";

describe("youtubeQuotaLimitVariable.evaluator (parameter-based)", () => {
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

    describe("with 'trigger' parameter", () => {
        it("returns quotaLimit from eventData when present", () => {
            const trigger = makeTrigger({
                quotaLimit: 10000
            });

            const result = youtubeQuotaLimitVariable.evaluator(trigger, "trigger");
            expect(result).toBe(10000);
        });

        it("returns null when eventData has no quotaLimit", () => {
            const trigger = makeTrigger({
                applicationId: "some-id"
            });

            const result = youtubeQuotaLimitVariable.evaluator(trigger, "trigger");
            expect(result).toBeNull();
        });

        it("returns null when eventData is missing", () => {
            const trigger = makeTrigger(undefined);

            const result = youtubeQuotaLimitVariable.evaluator(trigger, "trigger");
            expect(result).toBeNull();
        });
    });

    describe("with 'current' parameter", () => {
        it("returns dailyQuota for current active application", () => {
            mockGetActiveApplication.mockReturnValue({
                id: "current-app-id",
                name: "Current App",
                quotaSettings: {
                    dailyQuota: 10000
                }
            });

            const trigger = makeTrigger({});
            const result = youtubeQuotaLimitVariable.evaluator(trigger, "current");
            expect(result).toBe(10000);
            expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
        });

        it("returns null when no active application exists", () => {
            mockGetActiveApplication.mockReturnValue(null);

            const trigger = makeTrigger({});
            const result = youtubeQuotaLimitVariable.evaluator(trigger, "current");
            expect(result).toBeNull();
        });

        it("returns null when active application has no quotaSettings", () => {
            mockGetActiveApplication.mockReturnValue({
                id: "app-id",
                name: "App Name"
            });

            const trigger = makeTrigger({});
            const result = youtubeQuotaLimitVariable.evaluator(trigger, "current");
            expect(result).toBeNull();
        });

        it("returns null when quotaSettings has no dailyQuota", () => {
            mockGetActiveApplication.mockReturnValue({
                id: "app-id",
                name: "App Name",
                quotaSettings: {}
            });

            const trigger = makeTrigger({});
            const result = youtubeQuotaLimitVariable.evaluator(trigger, "current");
            expect(result).toBeNull();
        });
    });

    describe("with UUID parameter", () => {
        it("looks up dailyQuota for specific application ID", () => {
            mockGetApplication.mockReturnValue({
                id: "specific-uuid-123",
                name: "Specific App",
                quotaSettings: {
                    dailyQuota: 5000
                }
            });

            const trigger = makeTrigger({});
            const result = youtubeQuotaLimitVariable.evaluator(trigger, "specific-uuid-123");
            expect(result).toBe(5000);
            expect(mockGetApplication).toHaveBeenCalledWith("specific-uuid-123");
        });

        it("returns null when application ID is invalid", () => {
            mockGetApplication.mockReturnValue(null);

            const trigger = makeTrigger({});
            const result = youtubeQuotaLimitVariable.evaluator(trigger, "invalid-uuid");
            expect(result).toBeNull();
        });

        it("returns null when application has no quotaSettings", () => {
            mockGetApplication.mockReturnValue({
                id: "valid-uuid",
                name: "App Name"
            });

            const trigger = makeTrigger({});
            const result = youtubeQuotaLimitVariable.evaluator(trigger, "valid-uuid");
            expect(result).toBeNull();
        });
    });

    describe("with no parameter (default behavior)", () => {
        it("returns trigger value when eventData has quotaLimit", () => {
            const trigger = makeTrigger({
                quotaLimit: 10000
            });
            mockGetActiveApplication.mockReturnValue({
                id: "current-id",
                name: "Current App",
                quotaSettings: { dailyQuota: 5000 }
            });

            const result = youtubeQuotaLimitVariable.evaluator(trigger);
            expect(result).toBe(10000);
            expect(mockGetActiveApplication).not.toHaveBeenCalled();
        });

        it("falls back to current when eventData has no quotaLimit", () => {
            const trigger = makeTrigger({
                otherField: "some-value"
            });
            mockGetActiveApplication.mockReturnValue({
                id: "current-id",
                name: "Current App",
                quotaSettings: { dailyQuota: 7500 }
            });

            const result = youtubeQuotaLimitVariable.evaluator(trigger);
            expect(result).toBe(7500);
            expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
        });

        it("returns null when neither trigger nor current available", () => {
            const trigger = makeTrigger(undefined);
            mockGetActiveApplication.mockReturnValue(null);

            const result = youtubeQuotaLimitVariable.evaluator(trigger);
            expect(result).toBeNull();
        });

        it("returns null for current app when no quotaSettings exist", () => {
            const trigger = makeTrigger({
                otherField: "some-value"
            });
            mockGetActiveApplication.mockReturnValue({
                id: "current-id",
                name: "Current App"
            });

            const result = youtubeQuotaLimitVariable.evaluator(trigger);
            expect(result).toBeNull();
        });
    });
});
