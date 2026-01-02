import { youtubeErrorCategoryVariable } from "../youtube-error-category";
import { ErrorCategory } from "../../internal/error-constants";

describe("youtubeErrorCategoryVariable", () => {
    describe("evaluator", () => {
        it("should return error category from event metadata", () => {
            const trigger = {
                metadata: {
                    eventData: {
                        errorCategory: ErrorCategory.UNAUTHENTICATED
                    }
                }
            };

            const result = youtubeErrorCategoryVariable.evaluator(trigger as any);
            expect(result).toBe(ErrorCategory.UNAUTHENTICATED);
        });

        it("should return empty string when event data is missing", () => {
            const trigger = {
                metadata: {
                    eventData: undefined
                }
            };

            const result = youtubeErrorCategoryVariable.evaluator(trigger as any);
            expect(result).toBe("");
        });

        it("should return empty string when errorCategory is undefined", () => {
            const trigger = {
                metadata: {
                    eventData: {
                        someOtherField: "value"
                    }
                }
            };

            const result = youtubeErrorCategoryVariable.evaluator(trigger as any);
            expect(result).toBe("");
        });

        it("should handle all error categories", () => {
            const categories = [
                ErrorCategory.UNAUTHENTICATED,
                ErrorCategory.QUOTA_EXCEEDED,
                ErrorCategory.PERMISSION_DENIED,
                ErrorCategory.NOT_FOUND,
                ErrorCategory.INVALID_REQUEST,
                ErrorCategory.NETWORK_ERROR,
                ErrorCategory.UNKNOWN
            ];

            categories.forEach((category) => {
                const trigger = {
                    metadata: {
                        eventData: {
                            errorCategory: category
                        }
                    }
                };

                const result = youtubeErrorCategoryVariable.evaluator(trigger as any);
                expect(result).toBe(category);
            });
        });
    });
});
