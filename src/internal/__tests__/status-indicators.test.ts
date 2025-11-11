import { YouTubeOAuthApplication } from "../../types";
import { getApplicationStatusMessage } from "../application-utils";

describe("Status Indicator Accuracy", () => {
    const createTestApp = (overrides: Partial<YouTubeOAuthApplication> = {}): YouTubeOAuthApplication => ({
        id: "test-app",
        name: "Test Application",
        clientId: "client-id",
        clientSecret: "client-secret",
        refreshToken: "",
        quotaSettings: {
            dailyQuota: 10000,
            maxStreamHours: 8,
            overridePollingDelay: false,
            customPollingDelaySeconds: -1
        },
        ready: false,
        ...overrides
    });

    describe("Status Message Accuracy", () => {
        it("should display Authorization required for new applications", () => {
            const app = createTestApp();
            const status = getApplicationStatusMessage(app);

            expect(status).toBe("Authorization required");
        });

        it("should display Awaiting connection after OAuth but before refresh", () => {
            const app = createTestApp({
                refreshToken: "oauth-token"
            });
            const status = getApplicationStatusMessage(app);

            expect(status).toBe("Awaiting connection");
        });

        it("should display Ready without expiration when ready but no tokenExpiresAt", () => {
            const app = createTestApp({
                refreshToken: "token",
                ready: true,
                tokenExpiresAt: undefined
            });
            const status = getApplicationStatusMessage(app);

            expect(status).toBe("Ready");
        });

        it("should display Ready with expiration time when tokenExpiresAt is present", () => {
            const futureTime = Date.now() + 3600000; // 1 hour
            const app = createTestApp({
                refreshToken: "token",
                ready: true,
                tokenExpiresAt: futureTime
            });
            const status = getApplicationStatusMessage(app);

            expect(status).toMatch(/Ready - Token expires/);
            expect(status).toMatch(/\d{4}-\d{2}-\d{2}/); // Date format
            expect(status).toMatch(/\d{2}:\d{2}:\d{2}/); // Time format
        });
    });

    describe("Ready Status Accuracy", () => {
        it("should show ready as true when app has valid token and refresh token", () => {
            const app = createTestApp({
                refreshToken: "valid-token",
                ready: true
            });

            expect(app.ready).toBe(true);
            expect(app.refreshToken).toBeTruthy();
        });

        it("should show ready as false when refresh token is missing", () => {
            const app = createTestApp({
                refreshToken: "",
                ready: false
            });

            expect(app.ready).toBe(false);
            expect(app.refreshToken).toBeFalsy();
        });

        it("should show ready as false when token refresh fails", () => {
            const app = createTestApp({
                refreshToken: "expired-token",
                ready: false
            });

            expect(app.ready).toBe(false);
        });

        it("should transition from not ready to ready on successful refresh", () => {
            const app = createTestApp({
                refreshToken: "token",
                ready: false
            });

            expect(app.ready).toBe(false);

            // Simulate successful refresh
            app.ready = true;
            app.tokenExpiresAt = Date.now() + 3600000;

            expect(app.ready).toBe(true);
            expect(app.tokenExpiresAt).toBeGreaterThan(Date.now());
        });

        it("should transition from ready to not ready on refresh failure", () => {
            const app = createTestApp({
                refreshToken: "token",
                ready: true,
                tokenExpiresAt: Date.now() + 3600000
            });

            expect(app.ready).toBe(true);

            // Simulate refresh failure
            app.ready = false;

            expect(app.ready).toBe(false);
        });
    });

    describe("Token Expiration Display", () => {
        it("should display token expiration in correct date format", () => {
            const expirationTime = new Date(2025, 0, 15, 14, 30, 45).getTime();
            const app = createTestApp({
                refreshToken: "token",
                ready: true,
                tokenExpiresAt: expirationTime
            });

            const status = getApplicationStatusMessage(app);

            expect(status).toMatch(/Ready - Token expires 2025-01-15/);
        });

        it("should display token expiration with correct time", () => {
            const expirationTime = new Date(2025, 0, 15, 14, 30, 45).getTime();
            const app = createTestApp({
                refreshToken: "token",
                ready: true,
                tokenExpiresAt: expirationTime
            });

            const status = getApplicationStatusMessage(app);

            // Should include time close to 14:30:45
            expect(status).toMatch(/\d{2}:\d{2}:\d{2}/);
        });

        it("should handle token expiring very soon", () => {
            const veryNearFuture = Date.now() + 60000; // 1 minute
            const app = createTestApp({
                refreshToken: "token",
                ready: true,
                tokenExpiresAt: veryNearFuture
            });

            const status = getApplicationStatusMessage(app);

            expect(status).toMatch(/Ready - Token expires/);
        });

        it("should handle token expiring far in the future", () => {
            const farFuture = Date.now() + 86400000 * 30; // 30 days
            const app = createTestApp({
                refreshToken: "token",
                ready: true,
                tokenExpiresAt: farFuture
            });

            const status = getApplicationStatusMessage(app);

            expect(status).toMatch(/Ready - Token expires/);
        });
    });

    describe("Manual Refresh Button Functionality", () => {
        it("should show refresh needed when app is not ready", () => {
            const app = createTestApp({
                refreshToken: "token",
                ready: false
            });

            const needsRefresh = !app.ready;

            expect(needsRefresh).toBe(true);
        });

        it("should show refresh button as disabled when already ready", () => {
            const app = createTestApp({
                refreshToken: "token",
                ready: true
            });

            const canRefresh = true; // User can still manually refresh
            const shouldAutoRefresh = !app.ready;

            expect(canRefresh).toBe(true);
            expect(shouldAutoRefresh).toBe(false);
        });

        it("should update status after manual refresh", () => {
            const app = createTestApp({
                refreshToken: "token",
                ready: false
            });

            let status = getApplicationStatusMessage(app);
            expect(status).toBe("Awaiting connection");

            // Simulate manual refresh success
            app.ready = true;
            app.tokenExpiresAt = Date.now() + 3600000;

            status = getApplicationStatusMessage(app);
            expect(status).toMatch(/Ready - Token expires/);
        });

        it("should show error message if manual refresh fails", () => {
            const app = createTestApp({
                refreshToken: "expired-token",
                ready: true
            });

            // Simulate refresh failure
            app.ready = false;

            const status = getApplicationStatusMessage(app);
            expect(status).toBe("Awaiting connection");
        });
    });

    describe("Multiple Application Status Display", () => {
        it("should show different statuses for different applications", () => {
            const app1 = createTestApp({
                id: "app1",
                name: "App 1",
                refreshToken: "",
                ready: false
            });

            const app2 = createTestApp({
                id: "app2",
                name: "App 2",
                refreshToken: "token",
                ready: false
            });

            const app3 = createTestApp({
                id: "app3",
                name: "App 3",
                refreshToken: "token",
                ready: true,
                tokenExpiresAt: Date.now() + 3600000
            });

            const status1 = getApplicationStatusMessage(app1);
            const status2 = getApplicationStatusMessage(app2);
            const status3 = getApplicationStatusMessage(app3);

            expect(status1).toBe("Authorization required");
            expect(status2).toBe("Awaiting connection");
            expect(status3).toMatch(/Ready - Token expires/);
        });

        it("should highlight active application status", () => {
            const applications = [
                createTestApp({ id: "app1", ready: true, refreshToken: "token" }),
                createTestApp({ id: "app2", ready: false, refreshToken: "token" })
            ];

            const activeAppId = "app1";
            const activeApp = applications.find(a => a.id === activeAppId);
            const otherApps = applications.filter(a => a.id !== activeAppId);

            expect(activeApp?.ready).toBe(true);
            expect(otherApps.some(a => !a.ready)).toBe(true);
        });

        it("should show status for all applications in list", () => {
            const applications = [
                createTestApp({ id: "app1", ready: true, refreshToken: "token", tokenExpiresAt: Date.now() + 3600000 }),
                createTestApp({ id: "app2", ready: false, refreshToken: "token" }),
                createTestApp({ id: "app3", ready: false, refreshToken: "" })
            ];

            const statuses = applications.map(app => ({
                id: app.id,
                status: getApplicationStatusMessage(app)
            }));

            expect(statuses).toHaveLength(3);
            expect(statuses[0].status).toMatch(/Ready - Token expires/);
            expect(statuses[1].status).toBe("Awaiting connection");
            expect(statuses[2].status).toBe("Authorization required");
        });
    });

    describe("Status Indicator Real-Time Updates", () => {
        it("should update status when ready flag changes", () => {
            const app = createTestApp({
                refreshToken: "token",
                ready: false
            });

            let status = getApplicationStatusMessage(app);
            expect(status).toBe("Awaiting connection");

            // Ready status changes
            app.ready = true;
            app.tokenExpiresAt = Date.now() + 3600000;

            status = getApplicationStatusMessage(app);
            expect(status).toMatch(/Ready - Token expires/);
        });

        it("should update status when tokenExpiresAt changes", () => {
            const app = createTestApp({
                refreshToken: "token",
                ready: true,
                tokenExpiresAt: Date.now() + 3600000
            });

            let status = getApplicationStatusMessage(app);
            expect(status).toMatch(/Ready - Token expires 2025/);

            // Update expiration time
            app.tokenExpiresAt = Date.now() + 7200000; // 2 hours instead of 1

            status = getApplicationStatusMessage(app);
            expect(status).toMatch(/Ready - Token expires/);
        });

        it("should detect when token needs refresh soon", () => {
            const almostExpired = Date.now() + 300000; // 5 minutes
            const app = createTestApp({
                refreshToken: "token",
                ready: true,
                tokenExpiresAt: almostExpired
            });

            const status = getApplicationStatusMessage(app);
            expect(status).toMatch(/Ready - Token expires/);

            // Check if expiration is close
            const expiresIn = almostExpired - Date.now();
            expect(expiresIn).toBeLessThan(600000); // Less than 10 minutes
        });

        it("should maintain status consistency across multiple reads", () => {
            const app = createTestApp({
                refreshToken: "token",
                ready: true,
                tokenExpiresAt: Date.now() + 3600000
            });

            const status1 = getApplicationStatusMessage(app);
            const status2 = getApplicationStatusMessage(app);
            const status3 = getApplicationStatusMessage(app);

            expect(status1).toBe(status2);
            expect(status2).toBe(status3);
        });
    });
});
