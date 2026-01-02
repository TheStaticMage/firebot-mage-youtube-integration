import { EventData, FilterSettings } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { ComparisonType, channelLiveFilter } from "../channel-live";

jest.mock("../../main", () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock("../../integration-singleton", () => ({
    integration: {
        isLive: jest.fn()
    }
}));

import { integration } from "../../integration-singleton";

describe("channelLiveFilter", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("channel is live with value=true", () => {
        it("should pass with IS comparison when channel is live", async () => {
            (integration.isLive as jest.Mock).mockReturnValue(true);

            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {}
            };

            const result = await channelLiveFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });

    describe("channel is live with value=false", () => {
        it("should fail with IS comparison when channel is live and value is false", async () => {
            (integration.isLive as jest.Mock).mockReturnValue(true);

            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "false"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {}
            };

            const result = await channelLiveFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
        });
    });

    describe("channel is offline with value=true", () => {
        it("should fail with IS comparison when channel is offline", async () => {
            (integration.isLive as jest.Mock).mockReturnValue(false);

            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {}
            };

            const result = await channelLiveFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
        });
    });

    describe("channel is offline with value=false", () => {
        it("should pass with IS comparison when channel is offline", async () => {
            (integration.isLive as jest.Mock).mockReturnValue(false);

            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "false"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {}
            };

            const result = await channelLiveFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });

    describe("chat-message event", () => {
        it("should work with chat-message event", async () => {
            (integration.isLive as jest.Mock).mockReturnValue(true);

            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {}
            };

            const result = await channelLiveFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });

    describe("viewer-arrived event", () => {
        it("should work with viewer-arrived event", async () => {
            (integration.isLive as jest.Mock).mockReturnValue(true);

            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "viewer-arrived",
                eventMeta: {}
            };

            const result = await channelLiveFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });

    describe("application-activated event", () => {
        it("should work with application-activated event", async () => {
            (integration.isLive as jest.Mock).mockReturnValue(false);

            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "false"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "application-activated",
                eventMeta: {}
            };

            const result = await channelLiveFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });

    describe("api-error event", () => {
        it("should work with api-error event", async () => {
            (integration.isLive as jest.Mock).mockReturnValue(true);

            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "api-error",
                eventMeta: {}
            };

            const result = await channelLiveFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });
});
