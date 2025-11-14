import { ApplicationManager } from "../internal/application-manager";
import { ApplicationActivationCause } from "../events";

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
