/* eslint-disable @typescript-eslint/unbound-method */
import { DateTime } from "luxon";
import { firebot, logger } from "../../main";
import { QuotaManager } from "../quota-manager";

// Mock the logger and firebot modules
jest.mock("../../main", () => ({
    firebot: {
        modules: {
            fs: require("fs"),
            path: require("path"),
            eventManager: {
                triggerEvent: jest.fn()
            }
        }
    },
    logger: {
        error: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock getDataFilePath
jest.mock("../../util/datafile", () => ({
    getDataFilePath: jest.fn(() => "/tmp/quota-tracking.json")
}));

// Mock integration-singleton for application name lookups
const mockGetApplication = jest.fn();
const mockIntegration = {
    getApplicationManager: jest.fn(() => ({
        getApplication: mockGetApplication
    }))
};

jest.mock("../../integration-singleton", () => ({
    integration: mockIntegration
}));

describe("QuotaManager", () => {
    let quotaManager: QuotaManager;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset DateTime.now mock to use real implementation by default
        const realNow = DateTime.now();
        jest.spyOn(DateTime, "now").mockReturnValue(realNow);
        quotaManager = new QuotaManager();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("calculateNextMidnightPT", () => {
        it("should calculate next midnight PT when called during daytime (non-DST)", () => {
            // Set to January 15, 2024 at 2:00 PM PST (UTC-8, no DST)
            const mockNow = DateTime.fromISO("2024-01-15T14:00:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);

            const result = quotaManager["calculateNextMidnightPT"]();

            // Should return next midnight (January 16, 2024 00:00 PST)
            const expected = DateTime.fromISO("2024-01-16T00:00:00", { zone: "America/Los_Angeles" }).toMillis();
            expect(result).toBe(expected);
        });

        it("should calculate next midnight PT when called after midnight (non-DST)", () => {
            // Set to January 15, 2024 at 1:30 AM PST (UTC-8, no DST)
            const mockNow = DateTime.fromISO("2024-01-15T01:30:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);

            const result = quotaManager["calculateNextMidnightPT"]();

            // Should return next midnight (January 16, 2024 00:00 PST)
            const expected = DateTime.fromISO("2024-01-16T00:00:00", { zone: "America/Los_Angeles" }).toMillis();
            expect(result).toBe(expected);
        });

        it("should calculate next midnight PT during DST (daylight saving time)", () => {
            // Set to June 15, 2024 at 2:00 PM PDT (UTC-7, DST active)
            const mockNow = DateTime.fromISO("2024-06-15T14:00:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);

            const result = quotaManager["calculateNextMidnightPT"]();

            // Should return next midnight (June 16, 2024 00:00 PDT)
            const expected = DateTime.fromISO("2024-06-16T00:00:00", { zone: "America/Los_Angeles" }).toMillis();
            expect(result).toBe(expected);
        });

        it("should calculate next midnight PT during DST at 11:59 PM", () => {
            // Set to June 15, 2024 at 11:59 PM PDT (UTC-7, DST active)
            const mockNow = DateTime.fromISO("2024-06-15T23:59:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);

            const result = quotaManager["calculateNextMidnightPT"]();

            // Should return next midnight (June 16, 2024 00:00 PDT)
            const expected = DateTime.fromISO("2024-06-16T00:00:00", { zone: "America/Los_Angeles" }).toMillis();
            expect(result).toBe(expected);
        });

        it("should calculate correctly at DST transition (spring forward)", () => {
            // Set to March 10, 2024 at 2:30 AM PST (before DST transition at 2:00 AM -> 3:00 AM)
            const mockNow = DateTime.fromISO("2024-03-10T02:30:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);

            const result = quotaManager["calculateNextMidnightPT"]();

            // Should return next midnight (March 11, 2024 00:00 PDT, which is UTC-7 after spring forward)
            const expected = DateTime.fromISO("2024-03-11T00:00:00", { zone: "America/Los_Angeles" }).toMillis();
            expect(result).toBe(expected);
        });

        it("should calculate correctly at DST transition (fall back)", () => {
            // Set to November 3, 2024 at 1:30 AM PDT (before DST transition at 2:00 AM -> 1:00 AM)
            const mockNow = DateTime.fromISO("2024-11-03T01:30:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);

            const result = quotaManager["calculateNextMidnightPT"]();

            // Should return next midnight (November 4, 2024 00:00 PST, which is UTC-8 after fall back)
            const expected = DateTime.fromISO("2024-11-04T00:00:00", { zone: "America/Los_Angeles" }).toMillis();
            expect(result).toBe(expected);
        });

        it("should return milliseconds in the future", () => {
            const mockNow = DateTime.fromISO("2024-06-15T14:00:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);

            const result = quotaManager["calculateNextMidnightPT"]();
            const nowMs = mockNow.toMillis();

            expect(result).toBeGreaterThan(nowMs);
        });

        it("should return a timestamp approximately 24 hours in the future", () => {
            const mockNow = DateTime.fromISO("2024-06-15T14:00:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);

            const result = quotaManager["calculateNextMidnightPT"]();
            const nowMs = mockNow.toMillis();
            const differenceHours = (result - nowMs) / (1000 * 60 * 60);

            // Should be between 0 and 24 hours
            expect(differenceHours).toBeGreaterThan(0);
            expect(differenceHours).toBeLessThanOrEqual(24);
        });
    });

    describe("recordApiCall", () => {
        beforeEach(() => {
            jest.useFakeTimers();
            // Create a new quotaManager AFTER mocking DateTime and Date.now to a fixed time
            // This ensures calculateNextMidnightPT is called with the mocked time
            // and Date.now() used in checkAndResetIfNeeded is also consistent
            const mockNow = DateTime.fromISO("2024-06-15T14:00:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);
            jest.spyOn(Date, "now").mockReturnValue(mockNow.toMillis());
            quotaManager = new QuotaManager();
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it("should record API call and initialize quota for new application", () => {
            quotaManager.recordApiCall("app1", "streamList", 5);

            const usage = quotaManager.getQuotaUsage("app1");
            expect(usage).toBeDefined();
            expect(usage?.quotaUnitsUsed).toBe(5);
        });

        it("should accumulate quota units for multiple calls", () => {
            quotaManager.recordApiCall("app1", "streamList", 5);
            quotaManager.recordApiCall("app1", "streamList", 5);
            quotaManager.recordApiCall("app1", "liveChatMessages.insert", 50);

            const usage = quotaManager.getQuotaUsage("app1");
            expect(usage?.quotaUnitsUsed).toBe(60);
        });

        it("should track different applications independently", () => {
            quotaManager.recordApiCall("app1", "streamList", 5);
            quotaManager.recordApiCall("app2", "streamList", 5);

            const usage1 = quotaManager.getQuotaUsage("app1");
            const usage2 = quotaManager.getQuotaUsage("app2");

            expect(usage1?.quotaUnitsUsed).toBe(5);
            expect(usage2?.quotaUnitsUsed).toBe(5);
        });

        it("should update lastUpdated timestamp", () => {
            const beforeTime = Date.now();
            quotaManager.recordApiCall("app1", "streamList", 5);
            const afterTime = Date.now();

            const usage = quotaManager.getQuotaUsage("app1");
            expect(usage?.lastUpdated).toBeGreaterThanOrEqual(beforeTime);
            expect(usage?.lastUpdated).toBeLessThanOrEqual(afterTime);
        });
    });

    describe("calculateDelay", () => {
        it("should return custom delay when override is enabled", () => {
            const quotaSettings = {
                dailyQuota: 10000,
                maxStreamHours: 8,
                overridePollingDelay: true,
                customPollingDelaySeconds: 120
            };

            const delay = quotaManager.calculateDelay(quotaSettings);
            expect(delay).toBe(120000);
        });

        it("should calculate the correct delay based on quota budget", () => {
            const quotaSettings = {
                dailyQuota: 10000,
                maxStreamHours: 8,
                overridePollingDelay: false,
                customPollingDelaySeconds: 0
            };

            const delay = quotaManager.calculateDelay(quotaSettings);
            expect(delay).toBe(8005); // 8.0050031269625 seconds converted to milliseconds and rounded
        });

        it("should not return a negative delay", () => {
            const quotaSettings = {
                dailyQuota: 10000,
                maxStreamHours: 4,
                overridePollingDelay: false,
                customPollingDelaySeconds: 0
            };

            const delay = quotaManager.calculateDelay(quotaSettings);
            expect(delay).toBe(0);
        });

        it("should return null for invalid daily quota", () => {
            const quotaSettings = {
                dailyQuota: 0,
                maxStreamHours: 8,
                overridePollingDelay: false,
                customPollingDelaySeconds: 0
            };

            const delay = quotaManager.calculateDelay(quotaSettings);
            expect(delay).toBeNull();
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Invalid dailyQuota")
            );
        });

        it("should return null for invalid max stream hours", () => {
            const quotaSettings = {
                dailyQuota: 10000,
                maxStreamHours: -1,
                overridePollingDelay: false,
                customPollingDelaySeconds: 0
            };

            const delay = quotaManager.calculateDelay(quotaSettings);
            expect(delay).toBeNull();
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Invalid maxStreamHours")
            );
        });
    });

    describe("formatDelay", () => {
        it("should format seconds only", () => {
            const result = quotaManager.formatDelay(45000);
            expect(result).toBe("45s");
        });

        it("should format minutes and seconds", () => {
            const result = quotaManager.formatDelay(125000); // 2 minutes 5 seconds
            expect(result).toBe("2m 5s");
        });

        it("should format minutes without seconds", () => {
            const result = quotaManager.formatDelay(120000);
            expect(result).toBe("2m");
        });

        it("should handle 1 second", () => {
            const result = quotaManager.formatDelay(1000);
            expect(result).toBe("1s");
        });

        it("should handle 1 minute", () => {
            const result = quotaManager.formatDelay(60000);
            expect(result).toBe("1m");
        });
    });

    describe("getQuotaRemaining", () => {
        beforeEach(() => {
            jest.useFakeTimers();
            // Create a new quotaManager AFTER mocking DateTime and Date.now to a fixed time
            // This ensures calculateNextMidnightPT is called with the mocked time
            // and Date.now() used in checkAndResetIfNeeded is also consistent
            const mockNow = DateTime.fromISO("2024-06-15T14:00:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);
            jest.spyOn(Date, "now").mockReturnValue(mockNow.toMillis());
            quotaManager = new QuotaManager();
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it("should return full quota when no usage recorded", () => {
            const remaining = quotaManager.getQuotaRemaining("app1", 10000);
            expect(remaining).toBe(10000);
        });

        it("should calculate remaining quota after usage", () => {
            quotaManager.recordApiCall("app1", "streamList", 500);

            const remaining = quotaManager.getQuotaRemaining("app1", 10000);
            expect(remaining).toBe(9500);
        });

        it("should return 0 when quota is exhausted", () => {
            quotaManager.recordApiCall("app1", "streamList", 15000);

            const remaining = quotaManager.getQuotaRemaining("app1", 10000);
            expect(remaining).toBe(0);
        });
    });

    describe("isQuotaAvailable", () => {
        beforeEach(() => {
            jest.useFakeTimers();
            // Create a new quotaManager AFTER mocking DateTime and Date.now to a fixed time
            // This ensures calculateNextMidnightPT is called with the mocked time
            // and Date.now() used in checkAndResetIfNeeded is also consistent
            const mockNow = DateTime.fromISO("2024-06-15T14:00:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);
            jest.spyOn(Date, "now").mockReturnValue(mockNow.toMillis());
            quotaManager = new QuotaManager();
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it("should return true when enough quota is available", () => {
            quotaManager.recordApiCall("app1", "streamList", 100);

            const available = quotaManager.isQuotaAvailable("app1", 50, 10000);
            expect(available).toBe(true);
        });

        it("should return false when insufficient quota", () => {
            quotaManager.recordApiCall("app1", "streamList", 9900);

            const available = quotaManager.isQuotaAvailable("app1", 200, 10000);
            expect(available).toBe(false);
        });

        it("should return true when exact quota amount available", () => {
            quotaManager.recordApiCall("app1", "streamList", 9950);

            const available = quotaManager.isQuotaAvailable("app1", 50, 10000);
            expect(available).toBe(true);
        });

        it("should log warning when quota exhausted", () => {
            quotaManager.recordApiCall("app1", "streamList", 9900);

            quotaManager.isQuotaAvailable("app1", 200, 10000);
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Quota exhausted")
            );
        });
    });

    describe("checkAndResetIfNeeded", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it("should reset quota when midnight PT has passed", () => {
            // Start with a fixed time in the middle of the day
            const mockNow = DateTime.fromISO("2024-06-15T14:00:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);
            jest.spyOn(Date, "now").mockReturnValue(mockNow.toMillis());
            quotaManager = new QuotaManager();

            quotaManager.recordApiCall("app1", "streamList", 500);

            // Mock midnight PT to be in the past
            const usage = quotaManager.getQuotaUsage("app1");
            if (usage) {
                usage.quotaResetTime = Date.now() - 1000; // 1 second in the past
            }

            // Trigger check by getting usage again
            quotaManager.recordApiCall("app1", "streamList", 0); // Trigger checkAndResetIfNeeded

            const updatedUsage = quotaManager.getQuotaUsage("app1");
            expect(updatedUsage?.quotaUnitsUsed).toBe(0);
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("Resetting quota")
            );
        });

        it("should not reset quota when midnight PT has not passed", () => {
            // Start with a fixed time in the middle of the day
            const mockNow = DateTime.fromISO("2024-06-15T14:00:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);
            jest.spyOn(Date, "now").mockReturnValue(mockNow.toMillis());
            quotaManager = new QuotaManager();

            quotaManager.recordApiCall("app1", "streamList", 500);

            const usage = quotaManager.getQuotaUsage("app1");
            const initialQuota = usage?.quotaUnitsUsed;

            // Trigger check (but reset time should be in future, so no reset)
            quotaManager.recordApiCall("app1", "streamList", 100);

            const updatedUsage = quotaManager.getQuotaUsage("app1");
            expect(updatedUsage?.quotaUnitsUsed).toBe((initialQuota || 0) + 100);
        });
    });

    describe("flushQuotaData", () => {
        it("should exist and be callable", () => {
            expect(() => {
                quotaManager.flushQuotaData();
            }).not.toThrow();
        });
    });

    describe("initialize", () => {
        it("should be callable and return a promise", async () => {
            const result = quotaManager.initialize();
            expect(result).toBeInstanceOf(Promise);
            await result;
        });
    });

    describe("threshold detection", () => {
        // Helper to capture triggered events from mocked eventManager
        const getTriggeredEvents = (): {
            applicationId: string;
            applicationName: string;
            quotaConsumed: number;
            quotaLimit: number;
            threshold: number;
        }[] => {
            const triggerEvent = (firebot.modules.eventManager.triggerEvent as jest.Mock);
            return triggerEvent.mock.calls
                .filter((call: [string, string, Record<string, unknown>]) => call[1] === "quota-threshold-crossed")
                .map((call: [string, string, Record<string, unknown>]) => call[2] as unknown as {
                    applicationId: string;
                    applicationName: string;
                    quotaConsumed: number;
                    quotaLimit: number;
                    threshold: number;
                });
        };

        // Helper to clear previously recorded events before testing a specific action
        const clearTriggeredEvents = (): void => {
            (firebot.modules.eventManager.triggerEvent as jest.Mock).mockClear();
        };

        beforeEach(() => {
            jest.useFakeTimers();
            const mockNow = DateTime.fromISO("2024-06-15T14:00:00", { zone: "America/Los_Angeles" });
            jest.spyOn(DateTime, "now").mockReturnValue(mockNow as any);
            jest.spyOn(Date, "now").mockReturnValue(mockNow.toMillis());
            // Clear firebot eventManager mock calls to prevent event accumulation across tests
            (firebot.modules.eventManager.triggerEvent as jest.Mock).mockClear();
            // Set up mockGetApplication to return application names with quota settings
            mockGetApplication.mockImplementation((appId: string) => ({
                id: appId,
                name: "Test App Name",
                quotaSettings: {
                    dailyQuota: 10000
                }
            }));
            quotaManager = new QuotaManager(mockIntegration as any);
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it("should emit single threshold event when crossing from 0% to 1%", () => {
            // Start at 98/10000 = 0% (floor(98 * 100 / 10000) = 0)
            quotaManager.recordApiCall("app1", "streamList", 98);

            // Add 4 more units: 102/10000 = 1% (floor(102 * 100 / 10000) = 1)
            quotaManager.recordApiCall("app1", "streamList", 4);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({
                applicationId: "app1",
                applicationName: "Test App Name",
                quotaConsumed: 102,
                quotaLimit: 10000,
                threshold: 1
            });
        });

        it("should emit multiple threshold events when crossing multiple levels", () => {
            // Start at 98/10000 = 0%
            quotaManager.recordApiCall("app1", "streamList", 98);

            // Add 107 more units: 205/10000 = 2% (floor(205 * 100 / 10000) = 2)
            quotaManager.recordApiCall("app1", "streamList", 107);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(2);
            expect(events[0]).toEqual({
                applicationId: "app1",
                applicationName: "Test App Name",
                quotaConsumed: 205,
                quotaLimit: 10000,
                threshold: 1
            });
            expect(events[1]).toEqual({
                applicationId: "app1",
                applicationName: "Test App Name",
                quotaConsumed: 205,
                quotaLimit: 10000,
                threshold: 2
            });
        });

        it("should not emit events when staying within same percentage level", () => {
            // Start at 50/10000 = 0%
            quotaManager.recordApiCall("app1", "streamList", 50);

            // Add 49 more units: 99/10000 = 0% (still 0%)
            quotaManager.recordApiCall("app1", "streamList", 49);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(0);
        });

        it("should handle exact boundary at threshold 1", () => {
            // Start at 99/10000 = 0%
            quotaManager.recordApiCall("app1", "streamList", 99);

            // Add 1 more unit: 100/10000 = 1% (exactly at boundary)
            quotaManager.recordApiCall("app1", "streamList", 1);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({
                applicationId: "app1",
                applicationName: "Test App Name",
                quotaConsumed: 100,
                quotaLimit: 10000,
                threshold: 1
            });
        });

        it("should emit events in ascending order for multiple thresholds", () => {
            // Start at 0
            quotaManager.recordApiCall("app1", "streamList", 0);

            // Jump to 350/10000 = 3%
            quotaManager.recordApiCall("app1", "streamList", 350);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(3);
            expect(events[0].threshold).toBe(1);
            expect(events[1].threshold).toBe(2);
            expect(events[2].threshold).toBe(3);
        });

        it("should not emit events for reverse threshold change (midnight reset)", () => {
            // Start at 5000/10000 = 50%
            quotaManager.recordApiCall("app1", "streamList", 5000);
            clearTriggeredEvents(); // Clear events from setup

            // Simulate midnight reset: back to 0
            quotaManager.recordApiCall("app1", "streamList", -5000);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(0);
        });

        it("should not emit events for small negative change (bug scenario)", () => {
            // Start at 205/10000 = 2%
            quotaManager.recordApiCall("app1", "streamList", 205);
            clearTriggeredEvents(); // Clear events from setup

            // Simulate bug: small decrease to 198/10000 = 1%
            quotaManager.recordApiCall("app1", "streamList", -7);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(0);
        });

        it("should handle threshold 100 correctly", () => {
            // Start at 9900/10000 = 99%
            quotaManager.recordApiCall("app1", "streamList", 9900);
            clearTriggeredEvents(); // Clear events from setup (thresholds 1-99)

            // Add 100 more: 10000/10000 = 100%
            quotaManager.recordApiCall("app1", "streamList", 100);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({
                applicationId: "app1",
                applicationName: "Test App Name",
                quotaConsumed: 10000,
                quotaLimit: 10000,
                threshold: 100
            });
        });

        it("should clamp threshold to 100%", () => {
            // Start at 9950/10000 = 99%
            quotaManager.recordApiCall("app1", "streamList", 9950);
            clearTriggeredEvents(); // Clear events from setup (thresholds 1-99)

            // Add 1000 more: 10950/10000 = 109.5% but should clamp to 100%
            quotaManager.recordApiCall("app1", "streamList", 1000);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({
                applicationId: "app1",
                applicationName: "Test App Name",
                quotaConsumed: 10950,
                quotaLimit: 10000,
                threshold: 100
            });
        });

        it ("should clamp threshold to 100% and not emit when at 100%", () => {
            // Start at 10000/10000 = 100%
            quotaManager.recordApiCall("app1", "streamList", 10000);
            clearTriggeredEvents(); // Clear events from setup (thresholds 1-100)

            // Add 1000 more: 11000/10000 = 110% but should clamp to 100%
            quotaManager.recordApiCall("app1", "streamList", 1000);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(0);
        });

        it ("should ignore negative quota usage", () => {
            // Start at 500/10000 = 5%
            quotaManager.recordApiCall("app1", "streamList", 500);
            clearTriggeredEvents(); // Clear events from setup (thresholds 1-5)

            // Simulate negative usage bug
            quotaManager.recordApiCall("app1", "streamList", -600);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(0);
        });

        it ("should not have divide by zero error with zero daily quota", () => {
            // Override mock to return zero daily quota
            mockGetApplication.mockImplementation((appId: string) => ({
                id: appId,
                name: "Test App Name",
                quotaSettings: {
                    dailyQuota: 0
                }
            }));

            // Start at 0/0 daily quota
            quotaManager.recordApiCall("app1", "streamList", 0);

            // Add some usage
            quotaManager.recordApiCall("app1", "streamList", 100);

            const events = getTriggeredEvents();
            expect(events).toHaveLength(0);
        });
    });
});
