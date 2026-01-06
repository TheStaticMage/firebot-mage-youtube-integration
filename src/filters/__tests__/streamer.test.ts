import { EventData, FilterSettings } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { ComparisonType, streamerFilter } from "../streamer";

jest.mock("../../main", () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe("streamerFilter", () => {
    describe("broadcaster triggering events with value=true", () => {
        it("should pass with IS comparison when user is broadcaster", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {
                    twitchUserRoles: ["broadcaster", "mod"]
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });

        it("should fail with IS_NOT comparison when user is broadcaster", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS_NOT as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {
                    twitchUserRoles: ["broadcaster"]
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
        });
    });

    describe("non-broadcaster with value=true", () => {
        it("should fail with IS comparison when user is not broadcaster", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {
                    twitchUserRoles: ["mod", "sub"]
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
        });

        it("should pass with IS_NOT comparison when user is not broadcaster", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS_NOT as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {
                    twitchUserRoles: ["mod", "sub"]
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });

    describe("broadcaster with value=false", () => {
        it("should fail with IS comparison when user is broadcaster and value is false", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "false"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {
                    twitchUserRoles: ["broadcaster"]
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
        });

        it("should pass with IS_NOT comparison when user is broadcaster and value is false", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS_NOT as any,
                value: "false"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {
                    twitchUserRoles: ["broadcaster"]
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });

    describe("non-broadcaster with value=false", () => {
        it("should pass with IS comparison when user is not broadcaster and value is false", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "false"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {
                    twitchUserRoles: ["tier1"]
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });

        it("should fail with IS_NOT comparison when user is not broadcaster and value is false", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS_NOT as any,
                value: "false"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {
                    twitchUserRoles: ["tier1"]
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
        });
    });

    describe("missing or empty roles array", () => {
        it("should return false when roles are missing", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {}
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
        });

        it("should return false when roles array is empty with value=true", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {
                    twitchUserRoles: []
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
        });

        it("should return true when roles array is empty with value=false", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "false"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {
                    twitchUserRoles: []
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });

    describe("viewer-arrived event", () => {
        it("should work with viewer-arrived event", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "viewer-arrived",
                eventMeta: {
                    twitchUserRoles: ["broadcaster"]
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });

    describe("multiple roles including broadcaster", () => {
        it("should identify broadcaster correctly with multiple roles", async () => {
            const filterSettings: FilterSettings = {
                comparisonType: ComparisonType.IS as any,
                value: "true"
            };

            const eventData: EventData = {
                eventSourceId: "mage-youtube-integration",
                eventId: "chat-message",
                eventMeta: {
                    twitchUserRoles: ["broadcaster", "mod", "sub", "tier1"]
                }
            };

            const result = await streamerFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });
});
