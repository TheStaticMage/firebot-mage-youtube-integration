import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubePreviousApplicationIdVariable } from "../youtube-previous-application-id";

describe("youtubePreviousApplicationIdVariable.evaluator", () => {
    const makeTrigger = (eventData?: any): Trigger => ({
        type: "event",
        metadata: {
            username: "testuser",
            eventData
        }
    } as Trigger);

    it("returns previous application ID from eventData when present", () => {
        const trigger = makeTrigger({
            previousApplicationId: "app-123-abc"
        });

        const result = youtubePreviousApplicationIdVariable.evaluator(trigger);
        expect(result).toBe("app-123-abc");
    });

    it("returns empty string when eventData is missing", () => {
        const trigger = makeTrigger(undefined);

        const result = youtubePreviousApplicationIdVariable.evaluator(trigger);
        expect(result).toBe("");
    });

    it("returns empty string when eventData.previousApplicationId is missing", () => {
        const trigger = makeTrigger({
            newApplicationId: "app-456-def"
        });

        const result = youtubePreviousApplicationIdVariable.evaluator(trigger);
        expect(result).toBe("");
    });

    it("returns empty string when previousApplicationId is explicitly empty", () => {
        const trigger = makeTrigger({
            previousApplicationId: ""
        });

        const result = youtubePreviousApplicationIdVariable.evaluator(trigger);
        expect(result).toBe("");
    });
});