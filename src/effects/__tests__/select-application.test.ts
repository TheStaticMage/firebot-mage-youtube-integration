/* eslint-disable @typescript-eslint/unbound-method */
import { integration } from "../../integration";
import { ApplicationManager } from "../../internal/application-manager";
import { selectApplicationEffect } from "../select-application";
import { logger } from "../../main";
import { YouTubeOAuthApplication } from "../../types";

// Mock the integration module
jest.mock("../../integration", () => ({
    integration: {
        getApplicationManager: jest.fn()
    }
}));

// Mock the logger
jest.mock("../../main", () => ({
    logger: {
        error: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    }
}));

describe("YouTube Select Application Effect", () => {
    let mockApplicationManager: jest.Mocked<ApplicationManager>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockApplicationManager = {
            getApplication: jest.fn(),
            getActiveApplication: jest.fn(),
            setActiveApplication: jest.fn()
        } as any;

        (integration.getApplicationManager as jest.Mock).mockReturnValue(mockApplicationManager);
    });

    describe("onTriggerEvent", () => {
        const mockTrigger = {} as any;
        const mockSendDataToOverlay = jest.fn();
        const mockAbortSignal = new AbortController().signal;

        it("should activate application successfully", async () => {
            const mockApp: YouTubeOAuthApplication = {
                id: "app-123",
                name: "Test App",
                clientId: "client-id",
                clientSecret: "client-secret",
                refreshToken: "refresh-token",
                quotaSettings: {
                    dailyQuota: 10000,
                    maxStreamHours: 8,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: 10
                },
                ready: true
            };

            mockApplicationManager.getApplication.mockReturnValue(mockApp);
            mockApplicationManager.getActiveApplication.mockReturnValue(null);
            mockApplicationManager.setActiveApplication.mockResolvedValue(undefined);

            const effect = { applicationId: "app-123" };
            const result = await selectApplicationEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(true);
            expect(mockApplicationManager.setActiveApplication).toHaveBeenCalledWith("app-123");
            expect(logger.info).toHaveBeenCalledWith("Activated YouTube application: Test App");
        });

        it("should log warning when no application ID provided", async () => {
            const effect = { applicationId: "" };
            const result = await selectApplicationEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(true);
            expect(logger.warn).toHaveBeenCalledWith("Select application effect triggered with no application ID");
            expect(mockApplicationManager.setActiveApplication).not.toHaveBeenCalled();
        });

        it("should log warning when application does not exist", async () => {
            mockApplicationManager.getApplication.mockReturnValue(undefined as any);

            const effect = { applicationId: "non-existent" };
            const result = await selectApplicationEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(true);
            expect(logger.warn).toHaveBeenCalledWith("Select application effect triggered with non-existent application ID: non-existent");
            expect(mockApplicationManager.setActiveApplication).not.toHaveBeenCalled();
        });

        it("should log info when application is already active", async () => {
            const mockApp: YouTubeOAuthApplication = {
                id: "app-123",
                name: "Test App",
                clientId: "client-id",
                clientSecret: "client-secret",
                refreshToken: "refresh-token",
                quotaSettings: {
                    dailyQuota: 10000,
                    maxStreamHours: 8,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: 10
                },
                ready: true
            };

            mockApplicationManager.getApplication.mockReturnValue(mockApp);
            mockApplicationManager.getActiveApplication.mockReturnValue(mockApp);

            const effect = { applicationId: "app-123" };
            const result = await selectApplicationEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(true);
            expect(logger.info).toHaveBeenCalledWith("Application Test App is already active");
            expect(mockApplicationManager.setActiveApplication).not.toHaveBeenCalled();
        });

        it("should log warning when application has no refresh token", async () => {
            const mockApp: YouTubeOAuthApplication = {
                id: "app-123",
                name: "Test App",
                clientId: "client-id",
                clientSecret: "client-secret",
                refreshToken: "",
                quotaSettings: {
                    dailyQuota: 10000,
                    maxStreamHours: 8,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: 10
                },
                ready: false
            };

            mockApplicationManager.getApplication.mockReturnValue(mockApp);
            mockApplicationManager.getActiveApplication.mockReturnValue(null);

            const effect = { applicationId: "app-123" };
            const result = await selectApplicationEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(true);
            expect(logger.warn).toHaveBeenCalledWith("Cannot activate application Test App: no refresh token");
            expect(mockApplicationManager.setActiveApplication).not.toHaveBeenCalled();
        });

        it("should handle exceptions gracefully", async () => {
            const mockApp: YouTubeOAuthApplication = {
                id: "app-123",
                name: "Test App",
                clientId: "client-id",
                clientSecret: "client-secret",
                refreshToken: "refresh-token",
                quotaSettings: {
                    dailyQuota: 10000,
                    maxStreamHours: 8,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: 10
                },
                ready: true
            };

            mockApplicationManager.getApplication.mockReturnValue(mockApp);
            mockApplicationManager.getActiveApplication.mockReturnValue(null);
            mockApplicationManager.setActiveApplication.mockRejectedValue(new Error("Test error"));

            const effect = { applicationId: "app-123" };
            const result = await selectApplicationEffect.onTriggerEvent({
                trigger: mockTrigger,
                effect,
                sendDataToOverlay: mockSendDataToOverlay,
                abortSignal: mockAbortSignal
            });

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith("Error in select application effect: Error: Test error");
        });
    });
});
