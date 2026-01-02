import { errorTypeFilter, ComparisonType } from "../error-type";
import { ErrorCategory } from "../../internal/error-constants";

describe("errorTypeFilter", () => {
    const createEventData = (errorCategory: ErrorCategory) => ({
        eventMeta: {
            errorCategory
        }
    });

    describe("predicate with IS comparison", () => {
        it("should match when error category equals filter value", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.IS,
                value: ErrorCategory.UNAUTHENTICATED
            };
            const eventData = createEventData(ErrorCategory.UNAUTHENTICATED);

            const result = await errorTypeFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(true);
        });

        it("should not match when error category differs", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.IS,
                value: ErrorCategory.UNAUTHENTICATED
            };
            const eventData = createEventData(ErrorCategory.QUOTA_EXCEEDED);

            const result = await errorTypeFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(false);
        });
    });

    describe("predicate with IS_NOT comparison", () => {
        it("should match when error category does not equal filter value", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.IS_NOT,
                value: ErrorCategory.UNAUTHENTICATED
            };
            const eventData = createEventData(ErrorCategory.NETWORK_ERROR);

            const result = await errorTypeFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(true);
        });

        it("should not match when error category equals filter value", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.IS_NOT,
                value: ErrorCategory.QUOTA_EXCEEDED
            };
            const eventData = createEventData(ErrorCategory.QUOTA_EXCEEDED);

            const result = await errorTypeFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(false);
        });
    });
});
