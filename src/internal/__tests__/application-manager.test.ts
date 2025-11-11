/* eslint-disable @typescript-eslint/unbound-method */
import { logger } from "../../main";
import { QuotaSettings } from "../../types";
import { ApplicationManager } from "../application-manager";

// Mock dependencies
jest.mock("../../main", () => ({
    firebot: {
        modules: {
            fs: {
                existsSync: jest.fn(),
                readFileSync: jest.fn(),
                writeFileSync: jest.fn()
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

jest.mock("../../util/datafile", () => ({
    getDataFilePath: jest.fn((filename: string) => `/mock/path/${filename}`)
}));

jest.mock("../application-utils", () => ({
    isApplicationReady: jest.fn(app => app.ready),
    updateApplicationReadyStatus: jest.fn(),
    getApplicationStatusMessage: jest.fn(app => app.ready ? "Ready" : "Awaiting connection"),
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

describe("ApplicationManager", () => {
    let applicationManager: ApplicationManager;
    let mockQuotaSettings: QuotaSettings;
    let mockFs: {
        existsSync: jest.MockedFunction<any>;
        readFileSync: jest.MockedFunction<any>;
        writeFileSync: jest.MockedFunction<any>;
    };

    beforeEach(() => {
        // Get reference to the mocked fs functions
        const mockedMain = jest.requireMock("../../main");
        mockFs = mockedMain.firebot.modules.fs;

        applicationManager = new ApplicationManager();
        jest.clearAllMocks();

        mockQuotaSettings = {
            dailyQuota: 10000,
            maxStreamHours: 8,
            overridePollingDelay: false,
            customPollingDelaySeconds: -1
        };

        // Default mock fs behavior
        mockFs.existsSync.mockReturnValue(false);
    });

    afterEach(async () => {
        // Clean up any timers
        jest.clearAllTimers();
    });

    describe("initialize", () => {
        it("should initialize with empty storage when no file exists", async () => {
            mockFs.existsSync.mockReturnValue(false);

            await applicationManager.initialize();

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("ApplicationManager initialized with 0 applications")
            );
        });

        it("should load existing applications from file", async () => {
            const mockApplications = {
                applications: {
                    "app1": {
                        id: "app1",
                        name: "Test App 1",
                        clientId: "client1",
                        clientSecret: "secret1",
                        refreshToken: "refresh1",
                        quotaSettings: mockQuotaSettings,
                        ready: true,
                        status: "Ready"
                    }
                },
                activeApplicationId: "app1"
            };

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(mockApplications));

            await applicationManager.initialize();

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("ApplicationManager initialized with 1 applications")
            );
        });

        it("should handle invalid file format gracefully", async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue("invalid json");

            await applicationManager.initialize();

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to load applications data")
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("ApplicationManager initialized with 0 applications")
            );
        });
    });

    describe("getApplications", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
        });

        it("should return empty map when no applications", () => {
            const appsMap = applicationManager.getApplications();
            expect(appsMap).toEqual({});
        });

        it("should return all applications", async () => {
            // Add some test applications
            await applicationManager.addApplication("App 1", "client1", "secret1");
            await applicationManager.addApplication("App 2", "client2", "secret2");

            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            expect(apps).toHaveLength(2);
            expect(apps[0].name).toBe("App 1");
            expect(apps[1].name).toBe("App 2");
        });
    });

    describe("getApplication", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
            await applicationManager.addApplication("Test App", "client1", "secret1");
        });

        it("should return application by ID", () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            const app = applicationManager.getApplication(apps[0].id);

            expect(app).toBeTruthy();
            expect(app?.name).toBe("Test App");
        });

        it("should return null for non-existent ID", () => {
            const app = applicationManager.getApplication("nonexistent");
            expect(app).toBeNull();
        });
    });

    describe("getActiveApplication", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
            await applicationManager.addApplication("Test App", "client1", "secret1");
        });

        it("should return null when no active application", () => {
            const app = applicationManager.getActiveApplication();
            expect(app).toBeNull();
        });

        it("should return active application", async () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            // Add refresh token so app can be set as active
            apps[0].refreshToken = "test-token";

            await applicationManager.setActiveApplication(apps[0].id);

            const activeApp = applicationManager.getActiveApplication();
            expect(activeApp).toBeTruthy();
            expect(activeApp?.name).toBe("Test App");
        });
    });

    describe("getReadyApplications", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
            await applicationManager.addApplication("Ready App", "client1", "secret1");
            await applicationManager.addApplication("Not Ready App", "client2", "secret2");
        });

        it("should return only ready applications", () => {
            const { isApplicationReady } = require("../application-utils");

            // Mock ready status
            isApplicationReady.mockImplementation((app: any) => (app).name === "Ready App");

            const readyAppsMap = applicationManager.getReadyApplications();
            const readyAppsList = Object.values(readyAppsMap);
            expect(readyAppsList).toHaveLength(1);
            expect(readyAppsList[0].name).toBe("Ready App");
        });
    });

    describe("addApplication", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
        });

        it("should add new application successfully", async () => {
            const app = await applicationManager.addApplication("New App", "client1", "secret1", mockQuotaSettings);

            expect(app.name).toBe("New App");
            expect(app.clientId).toBe("client1");
            expect(app.clientSecret).toBe("secret1");
            expect(app.quotaSettings).toEqual(mockQuotaSettings);
            expect(app.ready).toBe(false);
        });

        it("should trim whitespace from inputs", async () => {
            const app = await applicationManager.addApplication("  Trim App  ", "  client1  ", "  secret1  ");

            expect(app.name).toBe("Trim App");
            expect(app.clientId).toBe("client1");
            expect(app.clientSecret).toBe("secret1");
        });

        it("should throw error for missing name", async () => {
            await expect(applicationManager.addApplication("", "client1", "secret1"))
                .rejects.toThrow("Application name is required");
        });

        it("should throw error for missing client ID", async () => {
            await expect(applicationManager.addApplication("Test App", "", "secret1"))
                .rejects.toThrow("Client ID is required");
        });

        it("should throw error for missing client secret", async () => {
            await expect(applicationManager.addApplication("Test App", "client1", ""))
                .rejects.toThrow("Client secret is required");
        });

        it("should throw error for duplicate name", async () => {
            await applicationManager.addApplication("Test App", "client1", "secret1");
            await expect(applicationManager.addApplication("Test App", "client2", "secret2"))
                .rejects.toThrow('Application with name "Test App" already exists');
        });

        it("should throw error for case-insensitive duplicate name", async () => {
            await applicationManager.addApplication("Test App", "client1", "secret1");
            await expect(applicationManager.addApplication("test app", "client2", "secret2"))
                .rejects.toThrow('Application with name "test app" already exists');
        });
    });

    describe("updateApplication", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
            await applicationManager.addApplication("Original App", "client1", "secret1");
        });

        it("should update application successfully", async () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            const updatedApp = await applicationManager.updateApplication(apps[0].id, {
                name: "Updated App",
                clientId: "new-client"
            });

            expect(updatedApp.name).toBe("Updated App");
            expect(updatedApp.clientId).toBe("new-client");
            expect(updatedApp.clientSecret).toBe("secret1"); // Unchanged
        });

        it("should throw error for non-existent application", async () => {
            await expect(applicationManager.updateApplication("nonexistent", { name: "New Name" }))
                .rejects.toThrow('Application with ID "nonexistent" not found');
        });

        it("should throw error for duplicate name", async () => {
            await applicationManager.addApplication("Another App", "client2", "secret2");
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);

            await expect(applicationManager.updateApplication(apps[0].id, { name: "Another App" }))
                .rejects.toThrow('Application with name "Another App" already exists');
        });
    });

    describe("removeApplication", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
            await applicationManager.addApplication("Test App", "client1", "secret1");
        });

        it("should remove application successfully", async () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            await applicationManager.removeApplication(apps[0].id);

            const remainingApps = applicationManager.getApplications();
            const remainingAppsList = Object.values(remainingApps);
            expect(remainingAppsList).toHaveLength(0);
        });

        it("should throw error for non-existent application", async () => {
            await expect(applicationManager.removeApplication("nonexistent"))
                .rejects.toThrow('Application with ID "nonexistent" not found');
        });

        it("should clear active application if it was removed", async () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            // Add refresh token so app can be set as active
            apps[0].refreshToken = "test-token";

            await applicationManager.setActiveApplication(apps[0].id);
            await applicationManager.removeApplication(apps[0].id);

            expect(applicationManager.getActiveApplication()).toBeNull();
        });
    });

    describe("setActiveApplication", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
            await applicationManager.addApplication("Test App", "client1", "secret1");
        });

        it("should set active application successfully", async () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            // Add refresh token so app can be set as active
            apps[0].refreshToken = "test-token";

            await applicationManager.setActiveApplication(apps[0].id);

            expect(applicationManager.getActiveApplication()?.name).toBe("Test App");
        });

        it("should throw error for non-existent application", async () => {
            await expect(applicationManager.setActiveApplication("nonexistent"))
                .rejects.toThrow('Application with ID "nonexistent" not found');
        });

        it("should throw error for not authorized application", async () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            // Apps created without refresh tokens cannot be set as active

            await expect(applicationManager.setActiveApplication(apps[0].id))
                .rejects.toThrow('Application "Test App" is not authorized. Please authorize it first.');
        });
    });

    describe("clearActiveApplication", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
            await applicationManager.addApplication("Test App", "client1", "secret1");
        });

        it("should clear active application", async () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            // Add refresh token so app can be set as active
            apps[0].refreshToken = "test-token";

            await applicationManager.setActiveApplication(apps[0].id);
            expect(applicationManager.getActiveApplication()).toBeTruthy();

            await applicationManager.clearActiveApplication();
            expect(applicationManager.getActiveApplication()).toBeNull();
        });

        it("should do nothing when no active application", async () => {
            await applicationManager.clearActiveApplication();
            expect(applicationManager.getActiveApplication()).toBeNull();
        });
    });

    // TODO: Implement reorderApplications feature
    describe.skip("reorderApplications", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
            await applicationManager.addApplication("App 1", "client1", "secret1");
            await applicationManager.addApplication("App 2", "client2", "secret2");
            await applicationManager.addApplication("App 3", "client3", "secret3");
        });

        it("should reorder applications successfully", async () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            const originalOrder = apps.map(app => app.name);

            // await applicationManager.reorderApplications([apps[2].id, apps[0].id, apps[1].id]);

            const reorderedAppsMap = applicationManager.getApplications();
            const reorderedApps = Object.values(reorderedAppsMap);
            const newOrder = reorderedApps.map(app => app.name);

            expect(newOrder).toEqual(["App 3", "App 1", "App 2"]);
            expect(newOrder).not.toEqual(originalOrder);
        });

        it("should throw error for non-existent application", async () => {
            // await expect(applicationManager.reorderApplications(["nonexistent", "app1"]))
            //     .rejects.toThrow('Application with ID "nonexistent" not found');
        });

        it("should preserve applications not in reorder list", async () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            // await applicationManager.reorderApplications([apps[0].id]); // Only reorder first app

            const reorderedAppsMap = applicationManager.getApplications();
            const reorderedApps = Object.values(reorderedAppsMap);
            expect(reorderedApps).toHaveLength(3); // All 3 apps should still be there
            expect(reorderedApps[0].id).toBe(apps[0].id);
        });
    });

    describe("updateApplicationReadyStatus", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
            await applicationManager.addApplication("Test App", "client1", "secret1");
        });

        it("should update ready status successfully", async () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            const { updateApplicationReadyStatus: mockUpdateReadyStatus } = require("../application-utils");

            await applicationManager.updateApplicationReadyStatus(apps[0].id, true, "Ready");

            expect(mockUpdateReadyStatus).toHaveBeenCalledWith(
                expect.anything(),
                true,
                "Ready"
            );
        });

        it("should warn for non-existent application", async () => {
            await applicationManager.updateApplicationReadyStatus("nonexistent", true);

            expect(logger.warn).toHaveBeenCalledWith(
                "Attempted to update ready status for non-existent application: nonexistent"
            );
        });

        it("should clear active application if it becomes not ready", async () => {
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            // Add refresh token so app can be set as active
            apps[0].refreshToken = "test-token";

            await applicationManager.setActiveApplication(apps[0].id);
            expect(applicationManager.getActiveApplication()).toBeTruthy();

            // Make app not ready
            await applicationManager.updateApplicationReadyStatus(apps[0].id, false);

            expect(applicationManager.getActiveApplication()).toBeNull();
        });
    });

    describe("getStatistics", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
        });

        it("should return correct statistics for empty state", () => {
            const stats = applicationManager.getStatistics();

            expect(stats).toEqual({
                total: 0,
                ready: 0,
                notReady: 0,
                hasActive: false
            });
        });

        it("should return correct statistics with mixed applications", async () => {
            await applicationManager.addApplication("Ready App", "client1", "secret1");
            await applicationManager.addApplication("Not Ready App", "client2", "secret2");

            const { isApplicationReady } = require("../application-utils");
            isApplicationReady.mockImplementation((app: any) => (app).name === "Ready App");

            const stats = applicationManager.getStatistics();

            expect(stats.total).toBe(2);
            expect(stats.ready).toBe(1);
            expect(stats.notReady).toBe(1);
            expect(stats.hasActive).toBe(false);
        });

        it("should detect active application", async () => {
            await applicationManager.addApplication("Test App", "client1", "secret1");
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            // Add refresh token so app can be set as active
            apps[0].refreshToken = "test-token";

            await applicationManager.setActiveApplication(apps[0].id);

            const stats = applicationManager.getStatistics();
            expect(stats.hasActive).toBe(true);
        });
    });

    describe("validateAllApplications", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
        });

        it("should set ready status based on refresh token", async () => {
            await applicationManager.addApplication("With Token", "client1", "secret1");
            await applicationManager.addApplication("Without Token", "client2", "secret2");

            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            // Manually set refresh token for first app only
            apps[0].refreshToken = "has-token";
            apps[1].refreshToken = "";

            await applicationManager.validateAllApplications();

            const { updateApplicationReadyStatus: mockUpdateReadyStatus } = require("../application-utils");
            // Both applications should be marked as not ready on startup
            // Ready status is now computed dynamically, no error messages passed
            expect(mockUpdateReadyStatus).toHaveBeenCalledWith(apps[0], false);
            expect(mockUpdateReadyStatus).toHaveBeenCalledWith(apps[1], false);
        });

        it("should clear active application if it's not ready", async () => {
            await applicationManager.addApplication("Test App", "client1", "secret1");
            const appsMap = applicationManager.getApplications();
            const apps = Object.values(appsMap);
            apps[0].refreshToken = ""; // No token

            // Manually set active application ID since setActiveApplication would fail
            const storage = applicationManager.getStorage();
            storage.activeApplicationId = apps[0].id;

            await applicationManager.validateAllApplications();

            expect(applicationManager.getActiveApplication()).toBeNull();
        });
    });

    describe("error handling", () => {
        beforeEach(async () => {
            await applicationManager.initialize();
        });

        it("should handle file system errors gracefully", async () => {
            mockFs.existsSync.mockImplementation((): never => {
                throw new Error("File system error");
            });

            await applicationManager.initialize();

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to load applications data")
            );
        });

        it("should handle save errors", async () => {
            mockFs.writeFileSync.mockImplementation(() => {
                throw new Error("Write error");
            });

            await expect(applicationManager.addApplication("Test App", "client1", "secret1"))
                .rejects.toThrow("Write error");
        });
    });
});
