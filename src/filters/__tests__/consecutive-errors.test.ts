import { consecutiveErrorsFilter, ComparisonType } from "../consecutive-errors";

describe("consecutiveErrorsFilter", () => {
    const createEventData = (consecutiveFailures: number) => ({
        eventMeta: {
            consecutiveFailures
        }
    });

    describe("predicate with EQUALS comparison", () => {
        it("should match when count equals filter value", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.EQUALS,
                value: 3
            };
            const eventData = createEventData(3);

            const result = await consecutiveErrorsFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(true);
        });

        it("should not match when count differs", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.EQUALS,
                value: 3
            };
            const eventData = createEventData(4);

            const result = await consecutiveErrorsFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(false);
        });

        it("should match zero failures", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.EQUALS,
                value: 0
            };
            const eventData = createEventData(0);

            const result = await consecutiveErrorsFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(true);
        });
    });

    describe("predicate with GREATER_THAN comparison", () => {
        it("should match when count is greater", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.GREATER_THAN,
                value: 3
            };
            const eventData = createEventData(5);

            const result = await consecutiveErrorsFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(true);
        });

        it("should not match when count equals threshold", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.GREATER_THAN,
                value: 3
            };
            const eventData = createEventData(3);

            const result = await consecutiveErrorsFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(false);
        });

        it("should not match when count is less", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.GREATER_THAN,
                value: 5
            };
            const eventData = createEventData(3);

            const result = await consecutiveErrorsFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(false);
        });
    });

    describe("predicate with LESS_THAN comparison", () => {
        it("should match when count is less", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.LESS_THAN,
                value: 5
            };
            const eventData = createEventData(3);

            const result = await consecutiveErrorsFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(true);
        });

        it("should not match when count equals threshold", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.LESS_THAN,
                value: 3
            };
            const eventData = createEventData(3);

            const result = await consecutiveErrorsFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(false);
        });

        it("should not match when count is greater", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.LESS_THAN,
                value: 3
            };
            const eventData = createEventData(5);

            const result = await consecutiveErrorsFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(false);
        });

        it("should match zero when threshold is positive", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.LESS_THAN,
                value: 5
            };
            const eventData = createEventData(0);

            const result = await consecutiveErrorsFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(true);
        });
    });
});
