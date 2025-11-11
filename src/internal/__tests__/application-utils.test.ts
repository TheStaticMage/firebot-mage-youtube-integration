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

        it("should set ready to false on failure with error message", () => {
            const errorMessage = "Invalid credentials";
            updateApplicationReadyStatus(testApp, false, errorMessage);

            expect(testApp.ready).toBe(false);
        });

        it("should set ready to false on failure without message", () => {
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
});
