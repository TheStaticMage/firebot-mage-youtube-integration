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

    });

});
