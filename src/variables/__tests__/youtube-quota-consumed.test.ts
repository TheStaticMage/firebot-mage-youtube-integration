/* eslint-disable @typescript-eslint/unbound-method */
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubeQuotaConsumedVariable } from "../youtube-quota-consumed";

jest.mock("../../integration-singleton", () => ({
    integration: {
        getApplicationManager: jest.fn(),
        getQuotaManager: jest.fn()
    }
}));

import { integration } from "../../integration-singleton";

describe("youtubeQuotaConsumedVariable.evaluator (parameter-based)", () => {
    const mockGetActiveApplication = jest.fn();
    const mockGetApplication = jest.fn();
    const mockGetQuotaUsage = jest.fn();
    const mockGetApplicationManager = integration.getApplicationManager as jest.Mock;
    const mockGetQuotaManager = integration.getQuotaManager as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetApplicationManager.mockReturnValue({
            getActiveApplication: mockGetActiveApplication,
            getApplication: mockGetApplication
        });
        mockGetQuotaManager.mockReturnValue({
            getQuotaUsage: mockGetQuotaUsage
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
        it("returns quotaConsumed from eventData when present", () => {
            const trigger = makeTrigger({
                quotaConsumed: 102,
                quotaLimit: 10000
            });

            const result = youtubeQuotaConsumedVariable.evaluator(trigger, "trigger");
            expect(result).toBe(102);
        });

        it("returns null when eventData has no quotaConsumed", () => {
            const trigger = makeTrigger({
                applicationId: "some-id"
            });

            const result = youtubeQuotaConsumedVariable.evaluator(trigger, "trigger");
            expect(result).toBeNull();
        });

        it("returns null when eventData is missing", () => {
            const trigger = makeTrigger(undefined);

            const result = youtubeQuotaConsumedVariable.evaluator(trigger, "trigger");
            expect(result).toBeNull();
        });
    });

    describe("with 'current' parameter", () => {
        it("returns quota consumed for current active application", () => {
            mockGetActiveApplication.mockReturnValue({
                id: "current-app-id",
                name: "Current App"
            });
            mockGetQuotaUsage.mockReturnValue({
                quotaUnitsUsed: 500
            });

            const trigger = makeTrigger({});
            const result = youtubeQuotaConsumedVariable.evaluator(trigger, "current");
            expect(result).toBe(500);
            expect(mockGetActiveApplication).toHaveBeenCalledTimes(1);
            expect(mockGetQuotaUsage).toHaveBeenCalledWith("current-app-id");
        });

        it("returns null when no active application exists", () => {
            mockGetActiveApplication.mockReturnValue(null);

            const trigger = makeTrigger({});
            const result = youtubeQuotaConsumedVariable.evaluator(trigger, "current");
            expect(result).toBeNull();
        });

        it("returns 0 when quota manager has no usage data", () => {
            mockGetActiveApplication.mockReturnValue({
                id: "current-app-id",
                name: "Current App"
            });
            mockGetQuotaUsage.mockReturnValue(undefined);

            const trigger = makeTrigger({});
            const result = youtubeQuotaConsumedVariable.evaluator(trigger, "current");
            expect(result).toBe(0);
        });
    });

    describe("with UUID parameter", () => {
        it("looks up quota consumed for specific application ID", () => {
            mockGetQuotaUsage.mockReturnValue({
                quotaUnitsUsed: 750
            });

            const trigger = makeTrigger({});
            const result = youtubeQuotaConsumedVariable.evaluator(trigger, "specific-uuid-123");
            expect(result).toBe(750);
            expect(mockGetQuotaUsage).toHaveBeenCalledWith("specific-uuid-123");
        });

        it("returns 0 when quota manager has no usage data for that ID", () => {
            mockGetQuotaUsage.mockReturnValue(undefined);

            const trigger = makeTrigger({});
            const result = youtubeQuotaConsumedVariable.evaluator(trigger, "unknown-uuid");
            expect(result).toBe(0);
        });
    });

    describe("with no parameter (default behavior)", () => {
        it("returns trigger value when eventData has quotaConsumed", () => {
            const trigger = makeTrigger({
                quotaConsumed: 102
            });
            mockGetActiveApplication.mockReturnValue({
                id: "current-id",
                name: "Current App"
            });
            mockGetQuotaUsage.mockReturnValue({ quotaUnitsUsed: 200 });

            const result = youtubeQuotaConsumedVariable.evaluator(trigger);
            expect(result).toBe(102);
            expect(mockGetQuotaUsage).not.toHaveBeenCalled();
        });

        it("falls back to current when eventData has no quotaConsumed", () => {
            const trigger = makeTrigger({
                otherField: "some-value"
            });
            mockGetActiveApplication.mockReturnValue({
                id: "current-id",
                name: "Current App"
            });
            mockGetQuotaUsage.mockReturnValue({ quotaUnitsUsed: 300 });

            const result = youtubeQuotaConsumedVariable.evaluator(trigger);
            expect(result).toBe(300);
            expect(mockGetQuotaUsage).toHaveBeenCalledWith("current-id");
        });

        it("returns null when neither trigger nor current available", () => {
            const trigger = makeTrigger(undefined);
            mockGetActiveApplication.mockReturnValue(null);

            const result = youtubeQuotaConsumedVariable.evaluator(trigger);
            expect(result).toBeNull();
        });

        it("returns 0 for current app when no quota data exists", () => {
            const trigger = makeTrigger({
                otherField: "some-value"
            });
            mockGetActiveApplication.mockReturnValue({
                id: "current-id",
                name: "Current App"
            });
            mockGetQuotaUsage.mockReturnValue(undefined);

            const result = youtubeQuotaConsumedVariable.evaluator(trigger);
            expect(result).toBe(0);
        });
    });
});
