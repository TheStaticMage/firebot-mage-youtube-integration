import { youtubeErrorConsecutiveFailuresVariable } from "../youtube-error-consecutive-failures";

describe("youtubeErrorConsecutiveFailuresVariable", () => {
    describe("evaluator", () => {
        it("should return consecutive failures from event metadata", () => {
            const trigger = {
                metadata: {
                    eventData: {
                        consecutiveFailures: 5
                    }
                }
            };

            const result = youtubeErrorConsecutiveFailuresVariable.evaluator(trigger as any);
            expect(result).toBe(5);
        });

        it("should return 0 when consecutiveFailures is 0", () => {
            const trigger = {
                metadata: {
                    eventData: {
                        consecutiveFailures: 0
                    }
                }
            };

            const result = youtubeErrorConsecutiveFailuresVariable.evaluator(trigger as any);
            expect(result).toBe(0);
        });

        it("should return 0 when event data is missing", () => {
            const trigger = {
                metadata: {
                    eventData: undefined
                }
            };

            const result = youtubeErrorConsecutiveFailuresVariable.evaluator(trigger as any);
            expect(result).toBe(0);
        });

        it("should return 0 when consecutiveFailures is undefined", () => {
            const trigger = {
                metadata: {
                    eventData: {
                        someOtherField: "value"
                    }
                }
            };

            const result = youtubeErrorConsecutiveFailuresVariable.evaluator(trigger as any);
            expect(result).toBe(0);
        });
    });
});
