import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { ApplicationActivationCause } from "../../events";
import { youtubeApplicationActivationCauseVariable } from "../youtube-application-activation-cause";

describe("youtubeApplicationActivationCauseVariable.evaluator", () => {
    const makeTrigger = (eventData?: any): Trigger => ({
        type: "event",
        metadata: {
            username: "testuser",
            eventData
        }
    } as Trigger);

    it("returns cause from eventData when present", () => {
        const trigger = makeTrigger({
            cause: ApplicationActivationCause.USER_CLICKED
        });

        const result = youtubeApplicationActivationCauseVariable.evaluator(trigger);
        expect(result).toBe(ApplicationActivationCause.USER_CLICKED);
    });

    it("returns different cause values correctly", () => {
        const trigger1 = makeTrigger({
            cause: ApplicationActivationCause.AUTHORIZED_FIRST_APPLICATION
        });
        const trigger2 = makeTrigger({
            cause: ApplicationActivationCause.CHANGED_BY_EFFECT
        });
        const trigger3 = makeTrigger({
            cause: ApplicationActivationCause.AUTOMATIC_QUOTA_FAILOVER
        });

        expect(youtubeApplicationActivationCauseVariable.evaluator(trigger1)).toBe(ApplicationActivationCause.AUTHORIZED_FIRST_APPLICATION);
        expect(youtubeApplicationActivationCauseVariable.evaluator(trigger2)).toBe(ApplicationActivationCause.CHANGED_BY_EFFECT);
        expect(youtubeApplicationActivationCauseVariable.evaluator(trigger3)).toBe(ApplicationActivationCause.AUTOMATIC_QUOTA_FAILOVER);
    });

    it("returns empty string when eventData is missing", () => {
        const trigger = makeTrigger(undefined);

        const result = youtubeApplicationActivationCauseVariable.evaluator(trigger);
        expect(result).toBe("");
    });

    it("returns empty string when eventData.cause is missing", () => {
        const trigger = makeTrigger({
            applicationId: "app-id-123"
        });

        const result = youtubeApplicationActivationCauseVariable.evaluator(trigger);
        expect(result).toBe("");
    });

    it("returns empty string when cause is explicitly empty", () => {
        const trigger = makeTrigger({
            cause: ""
        });

        const result = youtubeApplicationActivationCauseVariable.evaluator(trigger);
        expect(result).toBe("");
    });
});
