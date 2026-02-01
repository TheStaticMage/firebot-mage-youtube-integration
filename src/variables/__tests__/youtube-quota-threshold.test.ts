import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubeQuotaThresholdVariable } from "../youtube-quota-threshold";

describe("youtubeQuotaThresholdVariable.evaluator", () => {
    const makeTrigger = (eventData?: any): Trigger => ({
        type: "event",
        metadata: {
            username: "testuser",
            eventData
        }
    } as Trigger);

    it("returns threshold 1 from eventData", () => {
        const trigger = makeTrigger({
            applicationId: "test-app",
            quotaConsumed: 102,
            quotaLimit: 10000,
            threshold: 1
        });

        const result = youtubeQuotaThresholdVariable.evaluator(trigger);
        expect(result).toBe(1);
    });

    it("returns threshold 50 from eventData", () => {
        const trigger = makeTrigger({
            applicationId: "test-app",
            quotaConsumed: 5000,
            quotaLimit: 10000,
            threshold: 50
        });

        const result = youtubeQuotaThresholdVariable.evaluator(trigger);
        expect(result).toBe(50);
    });

    it("returns threshold 100 from eventData", () => {
        const trigger = makeTrigger({
            applicationId: "test-app",
            quotaConsumed: 10000,
            quotaLimit: 10000,
            threshold: 100
        });

        const result = youtubeQuotaThresholdVariable.evaluator(trigger);
        expect(result).toBe(100);
    });

    it("returns null when eventData is missing", () => {
        const trigger = makeTrigger(undefined);

        const result = youtubeQuotaThresholdVariable.evaluator(trigger);
        expect(result).toBeNull();
    });

    it("returns null when threshold is missing from eventData", () => {
        const trigger = makeTrigger({
            applicationId: "test-app",
            quotaConsumed: 102,
            quotaLimit: 10000
        });

        const result = youtubeQuotaThresholdVariable.evaluator(trigger);
        expect(result).toBeNull();
    });

    it("returns threshold 0 from eventData (if ever emitted)", () => {
        const trigger = makeTrigger({
            applicationId: "test-app",
            quotaConsumed: 0,
            quotaLimit: 10000,
            threshold: 0
        });

        const result = youtubeQuotaThresholdVariable.evaluator(trigger);
        expect(result).toBe(0);
    });
});
