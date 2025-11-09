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
            ready: false,
            status: "Initial status"
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
        it("should set ready to true and status to Ready on success", () => {
            updateApplicationReadyStatus(testApp, true);

            expect(testApp.ready).toBe(true);
            expect(testApp.status).toBe("Ready");
        });

        it("should set ready to false and status to error message on failure", () => {
            const errorMessage = "Invalid credentials";
            updateApplicationReadyStatus(testApp, false, errorMessage);

            expect(testApp.ready).toBe(false);
            expect(testApp.status).toBe(errorMessage);
        });

        it("should set ready to false and default status on failure without message", () => {
            updateApplicationReadyStatus(testApp, false);

            expect(testApp.ready).toBe(false);
            expect(testApp.status).toBe("Authentication failed");
        });
    });

    describe("getApplicationStatusMessage", () => {
        it("should return existing status if available", () => {
            testApp.status = "Custom status message";

            expect(getApplicationStatusMessage(testApp)).toBe("Custom status message");
        });

        it("should return Authorization required when no refresh token", () => {
            testApp.status = "";
            testApp.refreshToken = "";

            expect(getApplicationStatusMessage(testApp)).toBe("Authorization required");
        });

        it("should return Ready when app is ready", () => {
            testApp.status = "";
            testApp.refreshToken = "valid-token";
            testApp.ready = true;

            expect(getApplicationStatusMessage(testApp)).toBe("Ready");
        });

        it("should return Not ready when app is not ready", () => {
            testApp.status = "";
            testApp.refreshToken = "valid-token";
            testApp.ready = false;

            expect(getApplicationStatusMessage(testApp)).toBe("Not ready");
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
            expect(app.status).toBe("Authorization required");
            expect(app.quotaSettings).toEqual({
                dailyQuota: 10000,
                maxStreamHours: 8,
                overridePollingDelay: false,
                customPollingDelaySeconds: -1
            });
        });
    });
});
