import { apiCallFilter, ComparisonType } from "../api-call";
import { ApiCallType } from "../../internal/error-constants";

describe("apiCallFilter", () => {
    const createEventData = (apiCall: ApiCallType) => ({
        eventMeta: {
            apiCall
        }
    });

    describe("predicate with IS comparison", () => {
        it("should match when API call equals filter value", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.IS,
                value: ApiCallType.SEND_CHAT_MESSAGE
            };
            const eventData = createEventData(ApiCallType.SEND_CHAT_MESSAGE);

            const result = await apiCallFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(true);
        });

        it("should not match when API call differs", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.IS,
                value: ApiCallType.SEND_CHAT_MESSAGE
            };
            const eventData = createEventData(ApiCallType.GET_LIVE_BROADCASTS);

            const result = await apiCallFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(false);
        });
    });

    describe("predicate with IS_NOT comparison", () => {
        it("should match when API call does not equal filter value", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.IS_NOT,
                value: ApiCallType.SEND_CHAT_MESSAGE
            };
            const eventData = createEventData(ApiCallType.REFRESH_TOKEN);

            const result = await apiCallFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(true);
        });

        it("should not match when API call equals filter value", async () => {
            const filterSettings = {
                comparisonType: ComparisonType.IS_NOT,
                value: ApiCallType.GET_LIVE_BROADCASTS
            };
            const eventData = createEventData(ApiCallType.GET_LIVE_BROADCASTS);

            const result = await apiCallFilter.predicate(filterSettings as any, eventData as any);
            expect(result).toBe(false);
        });
    });
});
