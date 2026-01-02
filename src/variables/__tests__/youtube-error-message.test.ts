import { youtubeErrorMessageVariable } from "../youtube-error-message";

describe("youtubeErrorMessageVariable", () => {
    describe("evaluator", () => {
        it("should return error message from event metadata", () => {
            const errorMsg = "Request had invalid authentication credentials";
            const trigger = {
                metadata: {
                    eventData: {
                        errorMessage: errorMsg
                    }
                }
            };

            const result = youtubeErrorMessageVariable.evaluator(trigger as any);
            expect(result).toBe(errorMsg);
        });

        it("should return full error message with code", () => {
            const errorMsg = "16 UNAUTHENTICATED: Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential.";
            const trigger = {
                metadata: {
                    eventData: {
                        errorMessage: errorMsg
                    }
                }
            };

            const result = youtubeErrorMessageVariable.evaluator(trigger as any);
            expect(result).toBe(errorMsg);
        });

        it("should return empty string when event data is missing", () => {
            const trigger = {
                metadata: {
                    eventData: undefined
                }
            };

            const result = youtubeErrorMessageVariable.evaluator(trigger as any);
            expect(result).toBe("");
        });

        it("should return empty string when errorMessage is undefined", () => {
            const trigger = {
                metadata: {
                    eventData: {
                        someOtherField: "value"
                    }
                }
            };

            const result = youtubeErrorMessageVariable.evaluator(trigger as any);
            expect(result).toBe("");
        });

        it("should handle empty error messages", () => {
            const trigger = {
                metadata: {
                    eventData: {
                        errorMessage: ""
                    }
                }
            };

            const result = youtubeErrorMessageVariable.evaluator(trigger as any);
            expect(result).toBe("");
        });

        it("should preserve special characters in error message", () => {
            const errorMsg = "Error: \"Invalid\" token (code: 401) [auth_failed]";
            const trigger = {
                metadata: {
                    eventData: {
                        errorMessage: errorMsg
                    }
                }
            };

            const result = youtubeErrorMessageVariable.evaluator(trigger as any);
            expect(result).toBe(errorMsg);
        });
    });
});
