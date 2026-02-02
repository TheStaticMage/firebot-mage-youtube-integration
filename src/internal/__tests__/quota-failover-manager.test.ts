/* eslint-disable @typescript-eslint/unbound-method */
import { triggerQuotaFailover } from "../../events/failover";
import { logger } from "../../main";
import type { YouTubeOAuthApplication } from "../../types";
import { QuotaFailoverManager } from "../quota-failover-manager";

// Mock the logger
jest.mock("../../main", () => ({
    logger: {
        error: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock triggerQuotaFailover
jest.mock("../../events/failover", () => ({
    triggerQuotaFailover: jest.fn()
}));

// Mock types and other imports as needed
describe("QuotaFailoverManager", () => {
    let mockIntegration: any;
    let mockQuotaManager: any;
    let failoverManager: QuotaFailoverManager;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock integration
        mockIntegration = {
            getSettings: jest.fn(),
            getApplicationManager: jest.fn(),
            getMultiAuthManager: jest.fn(),
            getBroadcastManager: jest.fn(),
            getCurrentChannelId: jest.fn(),
            isConnected: jest.fn(),
            getCurrentActiveApplicationId: jest.fn(),
            switchActiveApplication: jest.fn()
        };

        // Mock quota manager
        mockQuotaManager = {
            getQuotaUsage: jest.fn()
        };

        failoverManager = new QuotaFailoverManager(mockIntegration, mockQuotaManager);
    });

    describe("attemptQuotaFailover", () => {
        it("should use quotaUnitsUsed for quotaConsumed in failover event instead of computed value", async () => {
            // Setup mocks
            const currentAppId = "current-app";
            const targetAppId = "target-app";
            const quotaUnitsUsed = 1;
            const dailyQuota = 3;
            const threshold = 50;

            mockIntegration.getSettings.mockReturnValue({
                advanced: {
                    enableAutomaticFailover: true,
                    automaticFailoverThreshold: threshold
                }
            });

            const targetApp: YouTubeOAuthApplication = {
                id: targetAppId,
                name: "Target App",
                email: "target@example.com",
                clientId: "client-id",
                clientSecret: "client-secret",
                refreshToken: "refresh-token",
                quotaSettings: {
                    dailyQuota,
                    maxStreamHours: 24,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: 30
                },
                ready: true
            };

            mockIntegration.getApplicationManager.mockReturnValue({
                getApplications: jest.fn(() => ({
                    [currentAppId]: { id: currentAppId, name: "Current App" },
                    [targetAppId]: targetApp
                })),
                setActiveApplication: jest.fn().mockResolvedValue(undefined)
            });

            mockQuotaManager.getQuotaUsage.mockImplementation((appId: string) => {
                if (appId === targetAppId) {
                    return { quotaUnitsUsed };
                }
                return null;
            });

            mockIntegration.getMultiAuthManager.mockReturnValue({
                getAccessToken: jest.fn().mockResolvedValue("token")
            });

            mockIntegration.getBroadcastManager.mockReturnValue({
                findLiveBroadcast: jest.fn().mockResolvedValue({})
            });

            mockIntegration.isConnected.mockReturnValue(true);
            mockIntegration.getCurrentActiveApplicationId.mockReturnValue(currentAppId);
            mockIntegration.switchActiveApplication.mockResolvedValue(undefined);

            // Act
            await failoverManager["attemptQuotaFailover"](currentAppId);

            // Assert
            expect(triggerQuotaFailover).toHaveBeenCalledWith({
                previousApplicationId: currentAppId,
                applicationId: targetAppId,
                applicationName: targetApp.name,
                quotaConsumed: quotaUnitsUsed,
                quotaLimit: dailyQuota,
                threshold
            });
        });

        it("should include applications with no quota usage record as 0 usage", async () => {
            // Setup mocks
            const currentAppId = "current-app";
            const targetAppId = "target-app";
            const dailyQuota = 1000;
            const threshold = 50;

            mockIntegration.getSettings.mockReturnValue({
                advanced: {
                    enableAutomaticFailover: true,
                    automaticFailoverThreshold: threshold
                }
            });

            const targetApp: YouTubeOAuthApplication = {
                id: targetAppId,
                name: "Target App",
                email: "target@example.com",
                clientId: "client-id",
                clientSecret: "client-secret",
                refreshToken: "refresh-token",
                quotaSettings: {
                    dailyQuota,
                    maxStreamHours: 24,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: 30
                },
                ready: true
            };

            mockIntegration.getApplicationManager.mockReturnValue({
                getApplications: jest.fn(() => ({
                    [currentAppId]: { id: currentAppId, name: "Current App" },
                    [targetAppId]: targetApp
                })),
                setActiveApplication: jest.fn().mockResolvedValue(undefined)
            });

            // Mock getQuotaUsage to return null for the target app (no usage record)
            mockQuotaManager.getQuotaUsage.mockReturnValue(null);

            mockIntegration.getMultiAuthManager.mockReturnValue({
                getAccessToken: jest.fn().mockResolvedValue("token")
            });

            mockIntegration.getBroadcastManager.mockReturnValue({
                findLiveBroadcast: jest.fn().mockResolvedValue({})
            });

            mockIntegration.isConnected.mockReturnValue(true);
            mockIntegration.getCurrentActiveApplicationId.mockReturnValue(currentAppId);
            mockIntegration.switchActiveApplication.mockResolvedValue(undefined);

            // Act
            await failoverManager["attemptQuotaFailover"](currentAppId);

            // Assert
            expect(triggerQuotaFailover).toHaveBeenCalledWith({
                previousApplicationId: currentAppId,
                applicationId: targetAppId,
                applicationName: targetApp.name,
                quotaConsumed: 0,
                quotaLimit: dailyQuota,
                threshold
            });
        });

        it("should handle missing settings.advanced gracefully", async () => {
            // Setup mocks
            const currentAppId = "current-app";

            // Mock getSettings to return settings without advanced
            mockIntegration.getSettings.mockReturnValue({});

            // Act & Assert - should not throw and should log debug message
            await expect(failoverManager["attemptQuotaFailover"](currentAppId)).resolves.not.toThrow();

            // Should log debug about automatic failover disabled
            expect(logger.debug).toHaveBeenCalledWith("Automatic failover is disabled, skipping");
        });

        it("should clamp failover threshold to 100 when value is 150", async () => {
            // Setup mocks
            const currentAppId = "current-app";
            const targetAppId = "target-app";
            const quotaUnitsUsed = 10;
            const dailyQuota = 100;

            mockIntegration.getSettings.mockReturnValue({
                advanced: {
                    enableAutomaticFailover: true,
                    automaticFailoverThreshold: 150
                }
            });

            const targetApp: YouTubeOAuthApplication = {
                id: targetAppId,
                name: "Target App",
                email: "target@example.com",
                clientId: "client-id",
                clientSecret: "client-secret",
                refreshToken: "refresh-token",
                quotaSettings: {
                    dailyQuota,
                    maxStreamHours: 24,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: 30
                },
                ready: true
            };

            mockIntegration.getApplicationManager.mockReturnValue({
                getApplications: jest.fn(() => ({
                    [currentAppId]: { id: currentAppId, name: "Current App" },
                    [targetAppId]: targetApp
                })),
                setActiveApplication: jest.fn().mockResolvedValue(undefined)
            });

            mockQuotaManager.getQuotaUsage.mockImplementation((appId: string) => {
                if (appId === targetAppId) {
                    return { quotaUnitsUsed };
                }
                return null;
            });

            mockIntegration.getMultiAuthManager.mockReturnValue({
                getAccessToken: jest.fn().mockResolvedValue("token")
            });

            mockIntegration.getBroadcastManager.mockReturnValue({
                findLiveBroadcast: jest.fn().mockResolvedValue({})
            });

            mockIntegration.isConnected.mockReturnValue(true);
            mockIntegration.getCurrentActiveApplicationId.mockReturnValue(currentAppId);
            mockIntegration.switchActiveApplication.mockResolvedValue(undefined);

            // Act
            await failoverManager["attemptQuotaFailover"](currentAppId);

            // Assert - threshold should be clamped to 100
            expect(triggerQuotaFailover).toHaveBeenCalledWith(
                expect.objectContaining({ threshold: 100 })
            );
        });

        it("should allow failover threshold of 100 without clamping", async () => {
            mockIntegration.getSettings.mockReturnValue({
                advanced: {
                    enableAutomaticFailover: true,
                    automaticFailoverThreshold: 100
                }
            });

            // Reuse the same setup as above, but change threshold
            const currentAppId = "current-app";
            const targetAppId = "target-app";
            const quotaUnitsUsed = 10;
            const dailyQuota = 100;

            const targetApp: YouTubeOAuthApplication = {
                id: targetAppId,
                name: "Target App",
                email: "target@example.com",
                clientId: "client-id",
                clientSecret: "client-secret",
                refreshToken: "refresh-token",
                quotaSettings: {
                    dailyQuota,
                    maxStreamHours: 24,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: 30
                },
                ready: true
            };

            mockIntegration.getApplicationManager.mockReturnValue({
                getApplications: jest.fn(() => ({
                    [currentAppId]: { id: currentAppId, name: "Current App" },
                    [targetAppId]: targetApp
                })),
                setActiveApplication: jest.fn().mockResolvedValue(undefined)
            });

            mockQuotaManager.getQuotaUsage.mockImplementation((appId: string) => {
                if (appId === targetAppId) {
                    return { quotaUnitsUsed };
                }
                return null;
            });

            mockIntegration.getMultiAuthManager.mockReturnValue({
                getAccessToken: jest.fn().mockResolvedValue("token")
            });

            mockIntegration.getBroadcastManager.mockReturnValue({
                findLiveBroadcast: jest.fn().mockResolvedValue({})
            });

            mockIntegration.isConnected.mockReturnValue(true);
            mockIntegration.getCurrentActiveApplicationId.mockReturnValue(currentAppId);
            mockIntegration.switchActiveApplication.mockResolvedValue(undefined);

            await failoverManager["attemptQuotaFailover"](currentAppId);

            expect(triggerQuotaFailover).toHaveBeenCalledWith(
                expect.objectContaining({ threshold: 100 })
            );
        });

        it("should clamp failover threshold to 100 when value is 420", async () => {
            mockIntegration.getSettings.mockReturnValue({
                advanced: {
                    enableAutomaticFailover: true,
                    automaticFailoverThreshold: 420
                }
            });

            // Same setup
            const currentAppId = "current-app";
            const targetAppId = "target-app";
            const quotaUnitsUsed = 10;
            const dailyQuota = 100;

            const targetApp: YouTubeOAuthApplication = {
                id: targetAppId,
                name: "Target App",
                email: "target@example.com",
                clientId: "client-id",
                clientSecret: "client-secret",
                refreshToken: "refresh-token",
                quotaSettings: {
                    dailyQuota,
                    maxStreamHours: 24,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: 30
                },
                ready: true
            };

            mockIntegration.getApplicationManager.mockReturnValue({
                getApplications: jest.fn(() => ({
                    [currentAppId]: { id: currentAppId, name: "Current App" },
                    [targetAppId]: targetApp
                })),
                setActiveApplication: jest.fn().mockResolvedValue(undefined)
            });

            mockQuotaManager.getQuotaUsage.mockImplementation((appId: string) => {
                if (appId === targetAppId) {
                    return { quotaUnitsUsed };
                }
                return null;
            });

            mockIntegration.getMultiAuthManager.mockReturnValue({
                getAccessToken: jest.fn().mockResolvedValue("token")
            });

            mockIntegration.getBroadcastManager.mockReturnValue({
                findLiveBroadcast: jest.fn().mockResolvedValue({})
            });

            mockIntegration.isConnected.mockReturnValue(true);
            mockIntegration.getCurrentActiveApplicationId.mockReturnValue(currentAppId);
            mockIntegration.switchActiveApplication.mockResolvedValue(undefined);

            await failoverManager["attemptQuotaFailover"](currentAppId);

            expect(triggerQuotaFailover).toHaveBeenCalledWith(
                expect.objectContaining({ threshold: 100 })
            );
        });

        it("should clamp failover threshold to 1 when value is 0", async () => {
            mockIntegration.getSettings.mockReturnValue({
                advanced: {
                    enableAutomaticFailover: true,
                    automaticFailoverThreshold: 0
                }
            });

            const currentAppId = "current-app";
            const targetAppId = "target-app";
            const quotaUnitsUsed = 0; // Set to 0 so usagePercent=0 < 1
            const dailyQuota = 100;

            const targetApp: YouTubeOAuthApplication = {
                id: targetAppId,
                name: "Target App",
                email: "target@example.com",
                clientId: "client-id",
                clientSecret: "client-secret",
                refreshToken: "refresh-token",
                quotaSettings: {
                    dailyQuota,
                    maxStreamHours: 24,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: 30
                },
                ready: true
            };

            mockIntegration.getApplicationManager.mockReturnValue({
                getApplications: jest.fn(() => ({
                    [currentAppId]: { id: currentAppId, name: "Current App" },
                    [targetAppId]: targetApp
                })),
                setActiveApplication: jest.fn().mockResolvedValue(undefined)
            });

            mockQuotaManager.getQuotaUsage.mockImplementation((appId: string) => {
                if (appId === targetAppId) {
                    return { quotaUnitsUsed };
                }
                return null;
            });

            mockIntegration.getMultiAuthManager.mockReturnValue({
                getAccessToken: jest.fn().mockResolvedValue("token")
            });

            mockIntegration.getBroadcastManager.mockReturnValue({
                findLiveBroadcast: jest.fn().mockResolvedValue({})
            });

            mockIntegration.isConnected.mockReturnValue(true);
            mockIntegration.getCurrentActiveApplicationId.mockReturnValue(currentAppId);
            mockIntegration.switchActiveApplication.mockResolvedValue(undefined);

            await failoverManager["attemptQuotaFailover"](currentAppId);

            expect(triggerQuotaFailover).toHaveBeenCalledWith(
                expect.objectContaining({ threshold: 1 })
            );
        });

        it("should clamp failover threshold to 1 when value is -1", async () => {
            mockIntegration.getSettings.mockReturnValue({
                advanced: {
                    enableAutomaticFailover: true,
                    automaticFailoverThreshold: -1
                }
            });

            const currentAppId = "current-app";
            const targetAppId = "target-app";
            const quotaUnitsUsed = 0; // Set to 0 so usagePercent=0 < 1
            const dailyQuota = 100;

            const targetApp: YouTubeOAuthApplication = {
                id: targetAppId,
                name: "Target App",
                email: "target@example.com",
                clientId: "client-id",
                clientSecret: "client-secret",
                refreshToken: "refresh-token",
                quotaSettings: {
                    dailyQuota,
                    maxStreamHours: 24,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: 30
                },
                ready: true
            };

            mockIntegration.getApplicationManager.mockReturnValue({
                getApplications: jest.fn(() => ({
                    [currentAppId]: { id: currentAppId, name: "Current App" },
                    [targetAppId]: targetApp
                })),
                setActiveApplication: jest.fn().mockResolvedValue(undefined)
            });

            mockQuotaManager.getQuotaUsage.mockImplementation((appId: string) => {
                if (appId === targetAppId) {
                    return { quotaUnitsUsed };
                }
                return null;
            });

            mockIntegration.getMultiAuthManager.mockReturnValue({
                getAccessToken: jest.fn().mockResolvedValue("token")
            });

            mockIntegration.getBroadcastManager.mockReturnValue({
                findLiveBroadcast: jest.fn().mockResolvedValue({})
            });

            mockIntegration.isConnected.mockReturnValue(true);
            mockIntegration.getCurrentActiveApplicationId.mockReturnValue(currentAppId);
            mockIntegration.switchActiveApplication.mockResolvedValue(undefined);

            await failoverManager["attemptQuotaFailover"](currentAppId);

            expect(triggerQuotaFailover).toHaveBeenCalledWith(
                expect.objectContaining({ threshold: 1 })
            );
        });
    });
});
