import {
    isApplicationReady,
    updateApplicationReadyStatus,
    getApplicationStatusMessage,
    validateApplication,
    createApplication
} from "../application-utils";
import { YouTubeOAuthApplication } from "../../types";

describe("Application Utils", () => {
    let testApp: YouTubeOAuthApplication;

    beforeEach(() => {
        testApp = {
            id: "test-app",
            name: "Test App",
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
            refreshToken: "test-refresh-token",
            quotaSettings: {
                dailyQuota: 10000,
                maxStreamHours: 8,
                overridePollingDelay: false,
                customPollingDelaySeconds: -1
            },
            ready: false
        };
    });

    describe("isApplicationReady", () => {
        it("should return true when app has refresh token and is ready", () => {
            testApp.refreshToken = "valid-token";
            testApp.ready = true;

            expect(isApplicationReady(testApp)).toBe(true);
        });

        it("should return false when app has refresh token but is not ready", () => {
            testApp.refreshToken = "valid-token";
            testApp.ready = false;

            expect(isApplicationReady(testApp)).toBe(false);
        });

        it("should return false when app has no refresh token", () => {
            testApp.refreshToken = "";
            testApp.ready = true;

            expect(isApplicationReady(testApp)).toBe(false);
        });
    });

    describe("updateApplicationReadyStatus", () => {
        it("should set ready to true on success", () => {
            updateApplicationReadyStatus(testApp, true);

            expect(testApp.ready).toBe(true);
        });

        it("should set ready to false on failure", () => {
            updateApplicationReadyStatus(testApp, false);

            expect(testApp.ready).toBe(false);
        });

    });

    describe("getApplicationStatusMessage", () => {
        it("should return Authorization required when no refresh token", () => {
            testApp.refreshToken = "";

            expect(getApplicationStatusMessage(testApp)).toBe("Authorization required");
        });

        it("should return Ready with expiration time when app is ready and has tokenExpiresAt", () => {
            testApp.refreshToken = "valid-token";
            testApp.ready = true;
            // Set to a specific time for predictable testing: 2024-12-19 at 15:45:30
            const testDate = new Date("2024-12-19T15:45:30Z");
            testApp.tokenExpiresAt = testDate.getTime();

            const result = getApplicationStatusMessage(testApp);
            expect(result).toMatch(/Ready - Token expires \d{4}-\d{2}-\d{2} at \d{2}:\d{2}:\d{2}/);
        });

        it("should return Ready when app is ready without tokenExpiresAt", () => {
            testApp.refreshToken = "valid-token";
            testApp.ready = true;
            testApp.tokenExpiresAt = undefined;

            expect(getApplicationStatusMessage(testApp)).toBe("Ready");
        });

        it("should return Awaiting connection when app has refresh token but is not ready", () => {
            testApp.refreshToken = "valid-token";
            testApp.ready = false;

            expect(getApplicationStatusMessage(testApp)).toBe("Awaiting connection");
        });

        it("should return Not ready when app has no refresh token and is not ready", () => {
            testApp.refreshToken = "";
            testApp.ready = false;

            expect(getApplicationStatusMessage(testApp)).toBe("Authorization required");
        });
    });

    describe("validateApplication", () => {
        it("should return true for valid application", () => {
            expect(validateApplication(testApp)).toBe(true);
        });

        it("should return false when id is missing", () => {
            testApp.id = "";
            expect(validateApplication(testApp)).toBe(false);
        });

        it("should return false when name is missing", () => {
            testApp.name = "";
            expect(validateApplication(testApp)).toBe(false);
        });

        it("should return false when clientId is missing", () => {
            testApp.clientId = "";
            expect(validateApplication(testApp)).toBe(false);
        });

        it("should return false when clientSecret is missing", () => {
            testApp.clientSecret = "";
            expect(validateApplication(testApp)).toBe(false);
        });

        it("should return false when quotaSettings is missing", () => {
            testApp.quotaSettings = undefined as any;
            expect(validateApplication(testApp)).toBe(false);
        });
    });

    describe("createApplication", () => {
        it("should create application with default values", () => {
            const app = createApplication("new-app", "New App");

            expect(app.id).toBe("new-app");
            expect(app.name).toBe("New App");
            expect(app.clientId).toBe("");
            expect(app.clientSecret).toBe("");
            expect(app.refreshToken).toBe("");
            expect(app.ready).toBe(false);
            expect(app.quotaSettings).toEqual({
                dailyQuota: 10000,
                maxStreamHours: 8,
                overridePollingDelay: false,
                customPollingDelaySeconds: -1
            });
        });
    });

    describe("Ready Status Edge Cases", () => {
        it("should handle ready status with expired token", () => {
            testApp.refreshToken = "valid-token";
            testApp.ready = true;
            testApp.tokenExpiresAt = Date.now() - 1000; // Expired 1 second ago

            expect(isApplicationReady(testApp)).toBe(true);
            // Note: ready status doesn't check expiration, that's handled by refresh logic
        });

        it("should handle ready status transition after failed refresh", () => {
            testApp.refreshToken = "valid-token";
            testApp.ready = true;

            // Simulate failed refresh
            updateApplicationReadyStatus(testApp, false);

            expect(testApp.ready).toBe(false);
            expect(isApplicationReady(testApp)).toBe(false);
        });

        it("should handle ready status transition after successful refresh", () => {
            testApp.refreshToken = "valid-token";
            testApp.ready = false;

            // Simulate successful refresh
            updateApplicationReadyStatus(testApp, true);

            expect(testApp.ready).toBe(true);
            expect(isApplicationReady(testApp)).toBe(true);
        });

        it("should handle ready flag without refresh token", () => {
            testApp.refreshToken = "";
            testApp.ready = true;

            expect(isApplicationReady(testApp)).toBe(false);
            // Ready flag alone doesn't mean ready - need refresh token
        });

        it("should show correct status with tokenExpiresAt far in future", () => {
            testApp.refreshToken = "valid-token";
            testApp.ready = true;
            testApp.tokenExpiresAt = Date.now() + 86400000; // 1 day from now

            const status = getApplicationStatusMessage(testApp);
            expect(status).toMatch(/Ready - Token expires/);
        });

        it("should show correct status with tokenExpiresAt very soon", () => {
            testApp.refreshToken = "valid-token";
            testApp.ready = true;
            testApp.tokenExpiresAt = Date.now() + 60000; // 1 minute from now

            const status = getApplicationStatusMessage(testApp);
            expect(status).toMatch(/Ready - Token expires/);
        });
    });

    describe("Application Status Message Generation", () => {
        it("should show Authorization required for brand new application", () => {
            const newApp = createApplication("new", "New App");

            expect(getApplicationStatusMessage(newApp)).toBe("Authorization required");
        });

        it("should show Awaiting connection after OAuth but before first refresh", () => {
            testApp.refreshToken = "newly-obtained-token";
            testApp.ready = false;

            expect(getApplicationStatusMessage(testApp)).toBe("Awaiting connection");
        });

        it("should show Ready immediately after successful authorization", () => {
            testApp.refreshToken = "newly-obtained-token";
            testApp.ready = true;

            expect(getApplicationStatusMessage(testApp)).toBe("Ready");
        });

        it("should transition status correctly through authorization flow", () => {
            // Step 1: New app
            testApp.refreshToken = "";
            testApp.ready = false;
            let status = getApplicationStatusMessage(testApp);
            expect(status).toBe("Authorization required");

            // Step 2: After OAuth callback (has refresh token, awaiting connection)
            testApp.refreshToken = "oauth-token";
            testApp.ready = false;
            status = getApplicationStatusMessage(testApp);
            expect(status).toBe("Awaiting connection");

            // Step 3: After first successful refresh
            testApp.ready = true;
            testApp.tokenExpiresAt = Date.now() + 3600000;
            status = getApplicationStatusMessage(testApp);
            expect(status).toMatch(/Ready - Token expires/);
        });
    });

    describe("Application Validation Edge Cases", () => {
        it("should reject application with empty id but valid everything else", () => {
            testApp.id = "";
            expect(validateApplication(testApp)).toBe(false);
        });

        it("should accept application with valid special characters in name", () => {
            testApp.name = "My Channel #1 (Gaming)";
            expect(validateApplication(testApp)).toBe(true);
        });

        it("should accept application with very long name", () => {
            testApp.name = "A".repeat(200);
            expect(validateApplication(testApp)).toBe(true);
        });

        it("should accept application with all required fields populated", () => {
            expect(validateApplication(testApp)).toBe(true);
        });
    });

    describe("Multiple Applications Readiness", () => {
        it("should identify ready vs not-ready applications in a list", () => {
            const apps: YouTubeOAuthApplication[] = [
                { ...testApp, id: "app1", ready: true, refreshToken: "token" },
                { ...testApp, id: "app2", ready: false, refreshToken: "" },
                { ...testApp, id: "app3", ready: true, refreshToken: "token" }
            ];

            const readyApps = apps.filter(app => isApplicationReady(app));
            const notReadyApps = apps.filter(app => !isApplicationReady(app));

            expect(readyApps).toHaveLength(2);
            expect(notReadyApps).toHaveLength(1);
        });

        it("should handle concurrent ready status updates for different applications", () => {
            const app1 = { ...testApp, id: "app1" };
            const app2 = { ...testApp, id: "app2" };

            updateApplicationReadyStatus(app1, true);
            updateApplicationReadyStatus(app2, false);

            expect(isApplicationReady(app1)).toBe(true);
            expect(isApplicationReady(app2)).toBe(false);
        });

        it("should handle rapid status changes for same application", () => {
            updateApplicationReadyStatus(testApp, true);
            expect(testApp.ready).toBe(true);

            updateApplicationReadyStatus(testApp, false);
            expect(testApp.ready).toBe(false);

            updateApplicationReadyStatus(testApp, true);
            expect(testApp.ready).toBe(true);
        });
    });
});
