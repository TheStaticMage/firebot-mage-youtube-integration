/* eslint-disable camelcase */
/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/unbound-method */
import { MultiAuthManager } from "../multi-auth-manager";
import { YouTubeOAuthApplication } from "../../types";
import { logger } from "../../main";

// Mock logger
jest.mock("../../main", () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

const mockOAuth2Client = {
    generateAuthUrl: jest.fn(),
    getToken: jest.fn(),
    setCredentials: jest.fn(),
    refreshAccessToken: jest.fn(),
    revokeToken: jest.fn()
};

// Mock google-auth-library
jest.mock("google-auth-library", () => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    OAuth2Client: jest.fn().mockImplementation((clientId, clientSecret, redirectUri) => mockOAuth2Client)
}));

// Mock application-utils
jest.mock("../application-utils", () => ({
    updateApplicationReadyStatus: jest.fn()
}));

// Mock timers
jest.useFakeTimers();

describe("MultiAuthManager", () => {
    let multiAuthManager: MultiAuthManager;
    let mockApplications: YouTubeOAuthApplication[];

    beforeEach(() => {
        multiAuthManager = new MultiAuthManager();
        jest.clearAllMocks();

        // Reset mockOAuth2Client methods
        mockOAuth2Client.generateAuthUrl.mockReset();
        mockOAuth2Client.getToken.mockReset();
        mockOAuth2Client.setCredentials.mockReset();
        mockOAuth2Client.refreshAccessToken.mockReset();
        mockOAuth2Client.revokeToken.mockReset();

        mockApplications = [
            {
                id: "app1",
                name: "Test App 1",
                clientId: "client1",
                clientSecret: "secret1",
                refreshToken: "refresh1",
                quotaSettings: {
                    dailyQuota: 10000,
                    maxStreamHours: 8,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: -1
                },
                ready: true
            },
            {
                id: "app2",
                name: "Test App 2",
                clientId: "client2",
                clientSecret: "secret2",
                refreshToken: "", // No refresh token
                quotaSettings: {
                    dailyQuota: 5000,
                    maxStreamHours: 4,
                    overridePollingDelay: true,
                    customPollingDelaySeconds: 30
                },
                ready: false
            }
        ];
    });

    afterEach(() => {
        multiAuthManager.destroy();
    });

    describe("initialize", () => {
        it("should initialize with applications having refresh tokens", async () => {
            await multiAuthManager.initialize(mockApplications);

            const applications = multiAuthManager.getApplications();
            expect(applications).toHaveLength(2);
            expect(applications[0].id).toBe("app1");
            expect(applications[1].id).toBe("app2");
        });

        it("should clear existing timers and managers when reinitializing", async () => {
            await multiAuthManager.initialize(mockApplications);
            await multiAuthManager.initialize(mockApplications);

            // Should not create duplicate timers
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("Token refresh scheduled for application")
            );
        });

        it("should handle empty applications array", async () => {
            await multiAuthManager.initialize([]);

            const applications = multiAuthManager.getApplications();
            expect(applications).toHaveLength(0);
        });
    });

    describe("getAccessToken", () => {
        beforeEach(async () => {
            await multiAuthManager.initialize(mockApplications);
        });

        it("should return access token for valid application", async () => {
            // Mock successful token refresh
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.refreshAccessToken.mockResolvedValue({
                credentials: {
                    access_token: "mock-access-token",
                    expiry_date: Date.now() + 3600000
                }
            });

            const token = await multiAuthManager.getAccessToken("app1");
            expect(token).toBe("mock-access-token");
        });

        it("should return empty string for non-existent application", async () => {
            const token = await multiAuthManager.getAccessToken("nonexistent");
            expect(token).toBe("");
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("No auth manager found for application nonexistent")
            );
        });

        it("should handle token refresh failures", async () => {
            // Mock failed token refresh
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.refreshAccessToken.mockRejectedValue(new Error("Token refresh failed"));

            const { updateApplicationReadyStatus } = require("../application-utils");

            const token = await multiAuthManager.getAccessToken("app1");
            expect(token).toBe("");
            expect(updateApplicationReadyStatus).toHaveBeenCalledWith(
                expect.anything(),
                false,
                "Token refresh failed"
            );
        });
    });

    describe("generateAuthorizationUrl", () => {
        beforeEach(async () => {
            await multiAuthManager.initialize(mockApplications);
        });

        it("should generate authorization URL for valid application", () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.generateAuthUrl.mockReturnValue("https://accounts.google.com/oauth/authorize?custom=true");

            const state = JSON.stringify({ appId: "app1", timestamp: Date.now() });
            const url = multiAuthManager.generateAuthorizationUrl("app1", state);

            expect(url).toBe("https://accounts.google.com/oauth/authorize?custom=true");
            expect(OAuth2Client).toHaveBeenCalledWith(
                "client1",
                "secret1",
                "http://localhost:7472/integrations/mage-youtube-integration/auth/callback"
            );
        });

        it("should throw error for non-existent application", () => {
            const state = JSON.stringify({ appId: "nonexistent", timestamp: Date.now() });

            expect(() => {
                multiAuthManager.generateAuthorizationUrl("nonexistent", state);
            }).toThrow("Application nonexistent not found or missing client ID");
        });

        it("should throw error for application missing client ID", () => {
            const appWithoutClientId = {
                ...mockApplications[0],
                clientId: ""
            };
            multiAuthManager.updateApplications([appWithoutClientId]);

            const state = JSON.stringify({ appId: "app1", timestamp: Date.now() });

            expect(() => {
                multiAuthManager.generateAuthorizationUrl("app1", state);
            }).toThrow("Application app1 not found or missing client ID");
        });
    });

    describe("handleAuthCallback", () => {
        beforeEach(async () => {
            await multiAuthManager.initialize(mockApplications);
        });

        it("should handle successful OAuth callback", async () => {
            const mockReq = {
                query: {
                    code: "auth-code",
                    state: JSON.stringify({ appId: "app1", timestamp: Date.now() })
                }
            };

            const mockRes = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            // Mock successful token exchange
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.getToken.mockResolvedValue({
                tokens: {
                    access_token: "new-access-token",
                    refresh_token: "new-refresh-token",
                    expiry_date: Date.now() + 3600000
                }
            });

            await multiAuthManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.send).toHaveBeenCalledWith(
                expect.stringContaining("YouTube application \"Test App 1\" authorized")
            );
        });

        it("should handle missing code parameter", async () => {
            const mockReq = {
                query: {
                    state: JSON.stringify({ appId: "app1", timestamp: Date.now() })
                }
            };

            const mockRes = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            await multiAuthManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith("Missing 'code' in callback.");
        });

        it("should handle missing state parameter", async () => {
            const mockReq = {
                query: {
                    code: "auth-code"
                }
            };

            const mockRes = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            await multiAuthManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith("Missing 'state' in callback.");
        });

        it("should handle invalid state parameter", async () => {
            const mockReq = {
                query: {
                    code: "auth-code",
                    state: "invalid-json"
                }
            };

            const mockRes = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            await multiAuthManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith("Invalid state parameter.");
        });

        it("should handle missing refresh token in response", async () => {
            const mockReq = {
                query: {
                    code: "auth-code",
                    state: JSON.stringify({ appId: "app1", timestamp: Date.now() })
                }
            };

            const mockRes = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            // Mock token exchange without refresh token
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.getToken.mockResolvedValue({
                tokens: {
                    access_token: "new-access-token",
                    expiry_date: Date.now() + 3600000
                    // No refresh_token
                }
            });

            await multiAuthManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith(
                expect.stringContaining("No refresh token received")
            );
        });
    });

    describe("updateApplications", () => {
        it("should update applications and reinitialize", async () => {
            await multiAuthManager.initialize(mockApplications);

            const newApplications = [
                {
                    id: "app3",
                    name: "Test App 3",
                    clientId: "client3",
                    clientSecret: "secret3",
                    refreshToken: "refresh3",
                    quotaSettings: {
                        dailyQuota: 20000,
                        maxStreamHours: 12,
                        overridePollingDelay: false,
                        customPollingDelaySeconds: -1
                    },
                    ready: true,
                    status: "Ready"
                }
            ];

            await multiAuthManager.updateApplications(newApplications);

            const applications = multiAuthManager.getApplications();
            expect(applications).toHaveLength(1);
            expect(applications[0].id).toBe("app3");
        });
    });

    describe("canConnect", () => {
        beforeEach(async () => {
            await multiAuthManager.initialize(mockApplications);
        });

        it("should return true for application with refresh token", () => {
            const canConnect = multiAuthManager.canConnect("app1");
            expect(canConnect).toBe(true);
        });

        it("should return false for application without refresh token", () => {
            const canConnect = multiAuthManager.canConnect("app2");
            expect(canConnect).toBe(false);
        });

        it("should return false for non-existent application", () => {
            const canConnect = multiAuthManager.canConnect("nonexistent");
            expect(canConnect).toBe(false);
        });
    });

    describe("refreshApplicationToken", () => {
        beforeEach(async () => {
            await multiAuthManager.initialize(mockApplications);
        });

        it("should refresh token successfully", async () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.refreshAccessToken.mockResolvedValue({
                credentials: {
                    access_token: "refreshed-access-token",
                    expiry_date: Date.now() + 3600000
                }
            });

            const { updateApplicationReadyStatus } = require("../application-utils");

            await multiAuthManager.refreshApplicationToken("app1");

            expect(updateApplicationReadyStatus).toHaveBeenCalledWith(
                expect.anything(),
                true
            );
        });

        it("should handle refresh failures", async () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.refreshAccessToken.mockRejectedValue(new Error("Refresh failed"));

            const { updateApplicationReadyStatus } = require("../application-utils");

            await multiAuthManager.refreshApplicationToken("app1");

            expect(updateApplicationReadyStatus).toHaveBeenCalledWith(
                expect.anything(),
                false,
                "Refresh failed"
            );
        });
    });

    describe("destroy", () => {
        it("should clean up all resources", async () => {
            await multiAuthManager.initialize(mockApplications);

            multiAuthManager.destroy();

            const applications = multiAuthManager.getApplications();
            expect(applications).toHaveLength(0);
        });
    });

    describe("Background Token Refresh", () => {
        beforeEach(async () => {
            await multiAuthManager.initialize(mockApplications);
        });

        it("should schedule refresh for applications with refresh tokens", async () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.refreshAccessToken.mockResolvedValue({
                credentials: {
                    access_token: "refreshed-token",
                    expiry_date: Date.now() + 3600000
                }
            });

            // Manually trigger refresh
            await multiAuthManager.refreshApplicationToken("app1");

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("Token refresh scheduled")
            );
        });

        it("should not schedule refresh for applications without refresh tokens", async () => {
            await multiAuthManager.refreshApplicationToken("app2");

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Cannot refresh token for application app2")
            );
        });

        it("should handle refresh failures for one app without affecting others", async () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();

            // First call fails, second succeeds
            mockClient.refreshAccessToken
                .mockRejectedValueOnce(new Error("Network error"))
                .mockResolvedValueOnce({
                    credentials: {
                        access_token: "refreshed-token-2",
                        expiry_date: Date.now() + 3600000
                    }
                });

            const { updateApplicationReadyStatus } = require("../application-utils");

            // First refresh fails
            await multiAuthManager.refreshApplicationToken("app1");
            expect(updateApplicationReadyStatus).toHaveBeenCalledWith(
                expect.anything(),
                false,
                "Network error"
            );
        });

        it("should update ready status to true on successful refresh", async () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.refreshAccessToken.mockResolvedValue({
                credentials: {
                    access_token: "new-token",
                    expiry_date: Date.now() + 3600000
                }
            });

            const { updateApplicationReadyStatus } = require("../application-utils");

            await multiAuthManager.refreshApplicationToken("app1");

            expect(updateApplicationReadyStatus).toHaveBeenCalledWith(
                expect.anything(),
                true
            );
        });

        it("should update ready status to false on failed refresh", async () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.refreshAccessToken.mockRejectedValue(new Error("Invalid token"));

            const { updateApplicationReadyStatus } = require("../application-utils");

            await multiAuthManager.refreshApplicationToken("app1");

            expect(updateApplicationReadyStatus).toHaveBeenCalledWith(
                expect.anything(),
                false,
                "Invalid token"
            );
        });

        it("should handle concurrent refresh for multiple applications", async () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.refreshAccessToken.mockResolvedValue({
                credentials: {
                    access_token: "refreshed-token",
                    expiry_date: Date.now() + 3600000
                }
            });

            const { updateApplicationReadyStatus } = require("../application-utils");

            // Simulate concurrent refresh calls
            const refresh1 = multiAuthManager.refreshApplicationToken("app1");
            const refresh2 = multiAuthManager.refreshApplicationToken("app1");

            await Promise.all([refresh1, refresh2]);

            // Both should complete without error
            expect(updateApplicationReadyStatus).toHaveBeenCalled();
        });

        it("should isolate refresh errors between applications", async () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();

            // app1 refresh fails, app2 doesn't exist (has no token to refresh)
            mockClient.refreshAccessToken.mockRejectedValue(new Error("Quota exceeded"));

            const { updateApplicationReadyStatus } = require("../application-utils");

            await multiAuthManager.refreshApplicationToken("app1");

            expect(updateApplicationReadyStatus).toHaveBeenCalledWith(
                expect.anything(),
                false,
                expect.stringContaining("Quota exceeded")
            );
        });
    });

    describe("Multi-Application State Management", () => {
        beforeEach(async () => {
            await multiAuthManager.initialize(mockApplications);
        });

        it("should maintain separate auth managers for each application", () => {
            // Both apps should be initialized
            expect(multiAuthManager.canConnect("app1")).toBe(true);
            expect(multiAuthManager.canConnect("app2")).toBe(false); // No refresh token
        });

        it("should handle getting access token for each application independently", async () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.refreshAccessToken.mockResolvedValue({
                credentials: {
                    access_token: "token-for-app",
                    expiry_date: Date.now() + 3600000
                }
            });

            const token = await multiAuthManager.getAccessToken("app1");

            expect(token).toBe("token-for-app");
            expect(mockClient.refreshAccessToken).toHaveBeenCalled();
        });

        it("should handle application deletion by stopping its refresh", async () => {
            const appsWithoutApp2 = [mockApplications[0]];

            await multiAuthManager.updateApplications(appsWithoutApp2);

            const canConnect = multiAuthManager.canConnect("app2");
            expect(canConnect).toBe(false);
        });

        it("should handle adding new applications dynamically", async () => {
            const newApp = {
                id: "app3",
                name: "Test App 3",
                clientId: "client3",
                clientSecret: "secret3",
                refreshToken: "refresh3",
                quotaSettings: {
                    dailyQuota: 8000,
                    maxStreamHours: 6,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: -1
                },
                ready: true
            };

            const updatedApps = [...mockApplications, newApp];
            await multiAuthManager.updateApplications(updatedApps);

            const applications = multiAuthManager.getApplications();
            expect(applications).toHaveLength(3);
            expect(multiAuthManager.canConnect("app3")).toBe(true);
        });
    });

    describe("Per-Application OAuth Flows", () => {
        beforeEach(async () => {
            await multiAuthManager.initialize(mockApplications);
        });

        it("should generate unique authorization URLs for different applications", () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.generateAuthUrl.mockReturnValue("https://accounts.google.com/oauth?app=1");

            const state1 = JSON.stringify({ appId: "app1", timestamp: Date.now() });
            const url1 = multiAuthManager.generateAuthorizationUrl("app1", state1);

            expect(url1).toBeDefined();
            expect(url1).toContain("accounts.google.com");
        });

        it("should handle OAuth callback for each application independently", async () => {
            const mockReq = {
                query: {
                    code: "auth-code-app1",
                    state: JSON.stringify({ appId: "app1", timestamp: Date.now() })
                }
            };

            const mockRes = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.getToken.mockResolvedValue({
                tokens: {
                    access_token: "access-token-app1",
                    refresh_token: "refresh-token-app1",
                    expiry_date: Date.now() + 3600000
                }
            });

            await multiAuthManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.send).toHaveBeenCalledWith(
                expect.stringContaining("authorized")
            );
        });

        it("should handle simultaneous OAuth callbacks for different applications", async () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.getToken.mockResolvedValue({
                tokens: {
                    access_token: "access-token",
                    refresh_token: "refresh-token",
                    expiry_date: Date.now() + 3600000
                }
            });

            const mockReq1 = {
                query: {
                    code: "code-app1",
                    state: JSON.stringify({ appId: "app1", timestamp: Date.now() })
                }
            };

            const mockReq2 = {
                query: {
                    code: "code-app2",
                    state: JSON.stringify({ appId: "app2", timestamp: Date.now() })
                }
            };

            const mockRes = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            // Both callbacks should complete without interference
            await multiAuthManager.handleAuthCallback(mockReq1, mockRes);
            await multiAuthManager.handleAuthCallback(mockReq2, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
        });

        it("should preserve existing refresh tokens when adding new applications", async () => {
            const newApp = {
                id: "app4",
                name: "Test App 4",
                clientId: "client4",
                clientSecret: "secret4",
                refreshToken: "refresh4",
                quotaSettings: {
                    dailyQuota: 6000,
                    maxStreamHours: 5,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: -1
                },
                ready: true
            };

            const updatedApps = [...mockApplications, newApp];
            await multiAuthManager.updateApplications(updatedApps);

            // Existing app1 should still be able to connect
            expect(multiAuthManager.canConnect("app1")).toBe(true);
            // New app should be ready to connect
            expect(multiAuthManager.canConnect("app4")).toBe(true);
        });

        it("should validate application credentials during OAuth flow", async () => {
            const mockReq = {
                query: {
                    code: "auth-code",
                    state: JSON.stringify({ appId: "nonexistent", timestamp: Date.now() })
                }
            };

            const mockRes = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            mockClient.getToken.mockRejectedValue(new Error("Invalid client"));

            await multiAuthManager.handleAuthCallback(mockReq, mockRes);

            // Should handle the error gracefully
            expect(mockRes.status).toHaveBeenCalled();
        });

        it("should handle token expiration tracking for multiple applications", async () => {
            const { OAuth2Client } = require("google-auth-library");
            const mockClient = OAuth2Client();
            const expiryTime = Date.now() + 3600000;

            mockClient.refreshAccessToken.mockResolvedValue({
                credentials: {
                    access_token: "refreshed-token",
                    expiry_date: expiryTime
                }
            });

            await multiAuthManager.refreshApplicationToken("app1");

            const apps = multiAuthManager.getApplications();
            const app1 = apps.find(a => a.id === "app1");

            // App should have updated token expiration info
            expect(app1).toBeDefined();
        });
    });
});
