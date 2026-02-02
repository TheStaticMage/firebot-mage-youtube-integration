import { ApplicationActivationCause } from "../events";
import { YouTubeIntegration } from "../integration-singleton";
import { ApplicationManager } from "../internal/application-manager";

// Mock dependencies
jest.mock("../main", () => ({
    firebot: {
        modules: {
            fs: {
                existsSync: jest.fn(),
                readFileSync: jest.fn(),
                writeFileSync: jest.fn()
            },
            eventManager: {
                registerEventSource: jest.fn(),
                triggerEvent: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock("../util/datafile", () => ({
    getDataFilePath: jest.fn((filename: string) => `/mock/path/${filename}`)
}));

jest.mock("../internal/application-utils", () => ({
    isApplicationReady: jest.fn(app => app.ready),
    updateApplicationReadyStatus: jest.fn(),
    getApplicationStatusMessage: jest.fn(app => (app.ready ? "Ready" : "Awaiting connection")),
    validateApplication: jest.fn(app => !!(app.id && app.name && app.clientId && app.clientSecret)),
    createApplication: jest.fn((id, name) => ({
        id,
        name,
        clientId: "",
        clientSecret: "",
        refreshToken: "",
        quotaSettings: {
            dailyQuota: 10000,
            maxStreamHours: 8,
            overridePollingDelay: false,
            customPollingDelaySeconds: -1
        },
        ready: false,
        status: "Authorization required"
    }))
}));

jest.mock("../internal/chat-manager", () => ({
    ChatManager: jest.fn().mockImplementation(() => ({
        startChatStreaming: jest.fn(() => Promise.resolve()),
        stopChatStreaming: jest.fn(() => Promise.resolve())
    }))
}));

describe("ApplicationManager - Active Application Switching", () => {
    let applicationManager: ApplicationManager;
    let mockFs: any;
    let mockLogger: any;

    beforeEach(() => {
        jest.clearAllMocks();

        const mockedMain = jest.requireMock("../main");
        mockLogger = mockedMain.logger;
        mockFs = mockedMain.firebot.modules.fs;

        applicationManager = new ApplicationManager();
        applicationManager.initPath();

        // Default mock fs behavior
        mockFs.existsSync.mockReturnValue(false);
    });

    describe("setActiveApplication - Integration notification", () => {
        it("should notify integration to switch polling when active application changes while connected", async () => {
            // Setup: Create mock applications
            const app1 = {
                id: "app-1",
                name: "App 1",
                clientId: "client-1",
                clientSecret: "secret-1",
                refreshToken: "token-1",
                quotaSettings: {
                    dailyQuota: 10000,
                    maxStreamHours: 8,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: -1
                },
                ready: true,
                status: "Ready"
            };

            const app2 = {
                id: "app-2",
                name: "App 2",
                clientId: "client-2",
                clientSecret: "secret-2",
                refreshToken: "token-2",
                quotaSettings: {
                    dailyQuota: 10000,
                    maxStreamHours: 8,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: -1
                },
                ready: true,
                status: "Ready"
            };

            // Add applications
            await applicationManager.addApplication(app1.name, app1.clientId, app1.clientSecret);
            await applicationManager.addApplication(app2.name, app2.clientId, app2.clientSecret);

            // Get the app IDs
            const apps = Object.entries(applicationManager.getApplications());
            const [id1] = apps[0];
            const [id2] = apps[1];

            // Update refresh tokens
            const applications = applicationManager.getApplications();
            const appsWithTokens = Object.values(applications);
            for (const app of appsWithTokens) {
                app.refreshToken = `token-${app.id}`;
            }

            // Set app1 as active
            await applicationManager.setActiveApplication(id1, ApplicationActivationCause.USER_CLICKED, false);

            // Mock the integration module
            const mockIntegration = {
                switchActiveApplication: jest.fn().mockResolvedValue(undefined)
            };

            jest.doMock("../integration-singleton", () => ({
                integration: mockIntegration
            }));

            // Now switch to app2 while connected
            await applicationManager.setActiveApplication(id2, ApplicationActivationCause.USER_CLICKED, true);

            // Verify logger was called about switching
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("Notifying integration to switch polling")
            );

            jest.dontMock("../integration-singleton");
        });

        it("should not notify integration if application did not change", async () => {
            // Setup
            const app = {
                id: "app-1",
                name: "App 1",
                clientId: "client-1",
                clientSecret: "secret-1",
                refreshToken: "token-1",
                quotaSettings: {
                    dailyQuota: 10000,
                    maxStreamHours: 8,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: -1
                },
                ready: true,
                status: "Ready"
            };

            // Add application
            await applicationManager.addApplication(app.name, app.clientId, app.clientSecret);

            const apps = Object.entries(applicationManager.getApplications());
            const [appId] = apps[0];

            // Update refresh token
            const applications = applicationManager.getApplications();
            const appsWithTokens = Object.values(applications);
            for (const a of appsWithTokens) {
                a.refreshToken = `token-${a.id}`;
            }

            // Set as active
            await applicationManager.setActiveApplication(appId, ApplicationActivationCause.USER_CLICKED, true);
            mockLogger.debug.mockClear();

            // Set the same app as active again
            await applicationManager.setActiveApplication(appId, ApplicationActivationCause.USER_CLICKED, true);

            // Verify logger was NOT called about switching (no change)
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining("Notifying integration to switch polling")
            );
        });

        it("should not notify integration if integration is disconnected", async () => {
            // Setup
            const app1 = {
                id: "app-1",
                name: "App 1",
                clientId: "client-1",
                clientSecret: "secret-1",
                refreshToken: "token-1",
                quotaSettings: {
                    dailyQuota: 10000,
                    maxStreamHours: 8,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: -1
                },
                ready: true,
                status: "Ready"
            };

            const app2 = {
                id: "app-2",
                name: "App 2",
                clientId: "client-2",
                clientSecret: "secret-2",
                refreshToken: "token-2",
                quotaSettings: {
                    dailyQuota: 10000,
                    maxStreamHours: 8,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: -1
                },
                ready: true,
                status: "Ready"
            };

            // Add applications
            await applicationManager.addApplication(app1.name, app1.clientId, app1.clientSecret);
            await applicationManager.addApplication(app2.name, app2.clientId, app2.clientSecret);

            // Get the app IDs
            const apps = Object.entries(applicationManager.getApplications());
            const [id1] = apps[0];
            const [id2] = apps[1];

            // Update refresh tokens
            const applications = applicationManager.getApplications();
            const appsWithTokens = Object.values(applications);
            for (const app of appsWithTokens) {
                app.refreshToken = `token-${app.id}`;
            }

            // Set app1 as active
            await applicationManager.setActiveApplication(id1, ApplicationActivationCause.USER_CLICKED, false);
            mockLogger.debug.mockClear();

            // Switch to app2 while DISCONNECTED (connected=false)
            await applicationManager.setActiveApplication(id2, ApplicationActivationCause.USER_CLICKED, false);

            // Verify logger was NOT called about switching (disconnected)
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining("Notifying integration to switch polling")
            );
        });
    });
});

describe("YouTubeIntegration - Offline Monitoring", () => {
    let integration: YouTubeIntegration;
    let mockBroadcastManager: any;
    let mockMultiAuthManager: any;
    let mockQuotaManager: any;
    let mockApplicationManager: any;
    let mockQuotaFailoverManager: any;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        mockBroadcastManager = {
            findLiveBroadcast: jest.fn()
        };

        mockMultiAuthManager = {
            getAccessToken: jest.fn(() => Promise.resolve('mock-access-token'))
        };

        mockQuotaManager = {
            isQuotaExceededError: jest.fn(() => false),
            getQuotaUsage: jest.fn()
        };

        mockQuotaFailoverManager = {
            attemptQuotaFailover: jest.fn()
        };

        mockApplicationManager = {
            getApplication: jest.fn(() => ({
                id: 'test-app-id',
                name: 'Test App',
                ready: true
            })),
            getApplications: jest.fn(() => ({
                'test-app-id': {
                    id: 'test-app-id',
                    name: 'Test App',
                    ready: true
                }
            })),
            getActiveApplication: jest.fn(() => ({
                id: 'test-app-id',
                name: 'Test App',
                ready: true
            })),
            setActiveApplication: jest.fn()
        };

        // Mock dependencies
        jest.doMock("../internal/broadcast-manager", () => ({
            BroadcastManager: jest.fn(() => mockBroadcastManager)
        }));

        jest.doMock("../internal/multi-auth-manager", () => ({
            MultiAuthManager: jest.fn(() => mockMultiAuthManager)
        }));

        jest.doMock("../internal/quota-manager", () => ({
            QuotaManager: jest.fn(() => mockQuotaManager)
        }));

        jest.doMock("../internal/quota-failover-manager", () => ({
            QuotaFailoverManager: jest.fn(() => mockQuotaFailoverManager)
        }));

        jest.doMock("../internal/application-manager", () => ({
            ApplicationManager: jest.fn(() => mockApplicationManager)
        }));

        // Dynamically require YouTubeIntegration after mocking dependencies
        const { YouTubeIntegration: IntegrationClass } = require("../integration-singleton");

        // Create real integration instance with mocked dependencies
        integration = new IntegrationClass();
        integration.connected = true;
        integration["currentActiveApplicationId"] = 'test-app-id';

        // Spy on methods that are called by the failover manager
        jest.spyOn(integration, "switchActiveApplication" as any);
    });

    afterEach(() => {
        // Clean up any running intervals
        if (integration["offlineMonitoringInterval"]) {
            clearInterval(integration["offlineMonitoringInterval"]);
            integration["offlineMonitoringInterval"] = null;
        }
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.dontMock("../internal/broadcast-manager");
        jest.dontMock("../internal/multi-auth-manager");
        jest.dontMock("../internal/quota-manager");
        jest.dontMock("../internal/quota-failover-manager");
        jest.dontMock("../internal/application-manager");
    });

    describe("startOfflineMonitoring", () => {
        it("should start a 10-second interval to check for broadcast", () => {
            // Act
            integration["startOfflineMonitoring"]();

            // Assert
            expect(integration["offlineMonitoringInterval"]).not.toBeNull();
        });

        it("should clear existing interval before starting new one", () => {
            // Arrange
            const existingInterval = setInterval(() => {
                // Empty interval for testing
            }, 5000);
            integration["offlineMonitoringInterval"] = existingInterval;

            // Act
            integration["startOfflineMonitoring"]();

            // Assert
            expect(integration["offlineMonitoringInterval"]).not.toBe(existingInterval);
            clearInterval(existingInterval);
        });

        it("should skip broadcast check if one is already in progress", async () => {
            // Arrange
            let callCount = 0;
            mockBroadcastManager.findLiveBroadcast.mockImplementation(async () => {
                callCount++;
                return null;
            });

            integration["startOfflineMonitoring"]();

            // Simulate a slow broadcast check that doesn't complete before next interval
            integration["offlineMonitoringInProgress"] = true;

            // Act - trigger the interval callback
            jest.advanceTimersByTime(10000);

            // Assert - callback should have skipped because check was in progress
            expect(callCount).toBe(0);

            // Clean up
            integration["offlineMonitoringInProgress"] = false;
        });

    });

    describe("stopOfflineMonitoring", () => {
        it("should clear the offline monitoring interval", () => {
            // Arrange
            integration["startOfflineMonitoring"]();
            const interval = integration["offlineMonitoringInterval"];

            // Act
            integration["stopOfflineMonitoring"]();

            // Assert
            expect(integration["offlineMonitoringInterval"]).toBeNull();
            if (interval) {
                clearInterval(interval);
            }
        });

        it("should do nothing if no interval is set", () => {
            // Arrange
            integration["offlineMonitoringInterval"] = null;

            // Act
            integration["stopOfflineMonitoring"]();

            // Assert
            expect(integration["offlineMonitoringInterval"]).toBeNull();
        });
    });

    describe("checkForBroadcast", () => {
        it("should call findLiveBroadcast when connected and active application is set", async () => {
            // Arrange
            mockBroadcastManager.findLiveBroadcast.mockResolvedValue(null);

            // Act
            await integration["checkForBroadcast"]();

            // Assert
            expect(mockBroadcastManager.findLiveBroadcast).toHaveBeenCalledWith(
                'mock-access-token',
                undefined,
                'test-app-id'
            );
        });

        it("should return early if not connected", async () => {
            // Arrange
            integration.connected = false;

            // Act
            await integration["checkForBroadcast"]();

            // Assert
            expect(mockBroadcastManager.findLiveBroadcast).not.toHaveBeenCalled();
        });

        it("should return early if no active application is set", async () => {
            // Arrange
            integration["currentActiveApplicationId"] = null;

            // Act
            await integration["checkForBroadcast"]();

            // Assert
            expect(mockBroadcastManager.findLiveBroadcast).not.toHaveBeenCalled();
        });

        it("should handle broadcast found and call handleStreamOnline", async () => {
            // Arrange
            const broadcastInfo = {
                liveChatId: 'test-live-chat-id',
                broadcastId: 'test-broadcast-id',
                channelId: 'test-channel-id',
                privacyStatus: 'public'
            };
            mockBroadcastManager.findLiveBroadcast.mockResolvedValue(broadcastInfo);

            // Act
            await integration["checkForBroadcast"]();

            // Assert - verify stream state was updated by handleStreamOnline
            expect(integration["currentLiveChatId"]).toBe('test-live-chat-id');
            expect(integration["currentBroadcastId"]).toBe('test-broadcast-id');
            expect(integration["currentChannelId"]).toBe('test-channel-id');
            expect(integration["currentBroadcastPrivacyStatus"]).toBe('public');
        });

        it("should not update state when no broadcast found", async () => {
            // Arrange
            mockBroadcastManager.findLiveBroadcast.mockResolvedValue(null);
            const originalState = {
                liveChatId: integration["currentLiveChatId"],
                broadcastId: integration["currentBroadcastId"]
            };

            // Act
            await integration["checkForBroadcast"]();

            // Assert
            expect(integration["currentLiveChatId"]).toBe(originalState.liveChatId);
            expect(integration["currentBroadcastId"]).toBe(originalState.broadcastId);
        });
    });

    describe("handleStreamOnline", () => {
        it("should stop offline monitoring", async () => {
            // Arrange
            const broadcastInfo = {
                liveChatId: 'test-live-chat-id',
                broadcastId: 'test-broadcast-id',
                channelId: 'test-channel-id',
                privacyStatus: 'public'
            };
            integration["startOfflineMonitoring"]();
            const intervalBefore = integration["offlineMonitoringInterval"];

            // Act
            await integration["handleStreamOnline"](broadcastInfo);

            // Assert
            expect(integration["offlineMonitoringInterval"]).toBeNull();
            if (intervalBefore) {
                clearInterval(intervalBefore);
            }
        });

        it("should update stream state", async () => {
            // Arrange
            const broadcastInfo = {
                liveChatId: 'test-live-chat-id',
                broadcastId: 'test-broadcast-id',
                channelId: 'test-channel-id',
                privacyStatus: 'public'
            };

            // Act
            await integration["handleStreamOnline"](broadcastInfo);

            // Assert
            expect(integration["currentLiveChatId"]).toBe('test-live-chat-id');
            expect(integration["currentBroadcastId"]).toBe('test-broadcast-id');
            expect(integration["currentChannelId"]).toBe('test-channel-id');
            expect(integration["currentBroadcastPrivacyStatus"]).toBe('public');
            expect(integration["isStreamLive"]).toBe(true);
        });

        it("should not start chat streaming when liveChatId is null", async () => {
            // Arrange
            const broadcastInfo = {
                liveChatId: null,
                broadcastId: 'test-broadcast-id',
                channelId: 'test-channel-id',
                privacyStatus: 'public'
            };

            // Act
            await integration["handleStreamOnline"](broadcastInfo);

            // Assert - verify stream state was updated
            expect(integration["currentBroadcastId"]).toBe('test-broadcast-id');
            expect(integration["currentChannelId"]).toBe('test-channel-id');
            // liveChatId should still be null (no chat streaming started)
            expect(integration["currentLiveChatId"]).toBeNull();
        });
    });
});
