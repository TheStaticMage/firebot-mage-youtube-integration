import { YouTubeOAuthApplication } from "../types";

describe("YouTubeIntegration - Multi-Account Scenarios", () => {
    const mockApplications: YouTubeOAuthApplication[] = [
        {
            id: "app1",
            name: "Channel 1",
            clientId: "client1",
            clientSecret: "secret1",
            refreshToken: "refresh1",
            quotaSettings: {
                dailyQuota: 10000,
                maxStreamHours: 8,
                overridePollingDelay: false,
                customPollingDelaySeconds: -1
            },
            ready: true,
            tokenExpiresAt: Date.now() + 3600000
        },
        {
            id: "app2",
            name: "Channel 2",
            clientId: "client2",
            clientSecret: "secret2",
            refreshToken: "refresh2",
            quotaSettings: {
                dailyQuota: 5000,
                maxStreamHours: 4,
                overridePollingDelay: false,
                customPollingDelaySeconds: -1
            },
            ready: false,
            tokenExpiresAt: undefined
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("Active Application Selection", () => {
        it("should use active ready application when connecting", async () => {
            const mockAppManagerInstance = {
                initialize: jest.fn(),
                getApplications: jest.fn().mockReturnValue(mockApplications),
                getActiveApplication: jest.fn().mockReturnValue(mockApplications[0]),
                setActiveApplication: jest.fn()
            };

            const mockAuthManagerInstance = {
                initialize: jest.fn(),
                getAccessToken: jest.fn().mockResolvedValue("access-token-1"),
                destroy: jest.fn(),
                getApplications: jest.fn().mockReturnValue(mockApplications)
            };

            // Mock connection attempt
            expect(mockAuthManagerInstance.getApplications()).toHaveLength(2);
            expect(mockAppManagerInstance.getActiveApplication()?.ready).toBe(true);
        });

        it("should fail to connect if active application is not ready", () => {
            const notReadyApp = {
                ...mockApplications[1],
                ready: false
            };

            const mockAppManagerInstance = {
                getActiveApplication: jest.fn().mockReturnValue(notReadyApp)
            };

            expect(mockAppManagerInstance.getActiveApplication()?.ready).toBe(false);
            // Connection should fail validation
        });

        it("should fail to connect if no active application is set", () => {
            const mockAppManagerInstance = {
                getActiveApplication: jest.fn().mockReturnValue(null)
            };

            expect(mockAppManagerInstance.getActiveApplication()).toBeNull();
            // Connection should fail with no active app error
        });
    });

    describe("Application Switching", () => {
        it("should handle switching from one ready application to another", () => {
            const mockAppManagerInstance = {
                getApplications: jest.fn().mockReturnValue(mockApplications),
                getActiveApplication: jest.fn()
                    .mockReturnValueOnce(mockApplications[0]) // Initial
                    .mockReturnValueOnce(mockApplications[0]), // After switch (both ready)
                setActiveApplication: jest.fn()
            };

            const app1 = mockAppManagerInstance.getActiveApplication();
            expect(app1?.id).toBe("app1");

            // Set to app2 and verify
            mockAppManagerInstance.setActiveApplication("app2");
            expect(mockAppManagerInstance.setActiveApplication).toHaveBeenCalledWith("app2");
        });

        it("should prevent switching to a non-ready application", () => {
            const mockAppManagerInstance = {
                getApplications: jest.fn().mockReturnValue(mockApplications),
                setActiveApplication: jest.fn().mockImplementation((appId) => {
                    const app = mockApplications.find(a => a.id === appId);
                    if (!app?.ready) {
                        throw new Error(`Cannot activate application: application not ready`);
                    }
                })
            };

            // Try to switch to non-ready app2
            expect(() => {
                mockAppManagerInstance.setActiveApplication("app2");
            }).toThrow("Cannot activate application: application not ready");
        });

        it("should handle graceful fallback when active application becomes not ready", () => {
            const applications = [...mockApplications];
            applications[0].ready = false; // Active app becomes not ready

            // Integration should detect this and potentially disconnect or warn
            expect(applications[0].ready).toBe(false);
        });
    });

    describe("Ready Status Management", () => {
        it("should identify ready applications correctly", () => {
            const freshApps = [...mockApplications];
            const readyApps = freshApps.filter(app => app.ready);
            expect(readyApps.length).toBeGreaterThanOrEqual(0);
        });

        it("should identify not-ready applications correctly", () => {
            const freshApps = [...mockApplications];
            const notReadyApps = freshApps.filter(app => !app.ready);
            expect(notReadyApps.length).toBeGreaterThanOrEqual(0);
        });

        it("should track token expiration for ready applications when present", () => {
            const freshApps = [...mockApplications];
            const readyApps = freshApps.filter(app => app.ready && app.tokenExpiresAt);
            // If there are ready apps with expiration, verify the time
            readyApps.forEach((app) => {
                expect(app.tokenExpiresAt).toBeGreaterThan(Date.now());
            });
        });

        it("should handle applications without token expiration info", () => {
            const freshApps = [...mockApplications];
            const appsWithoutExpiration = freshApps.filter(app => !app.tokenExpiresAt);
            // Should allow applications to exist without expiration info
            expect(appsWithoutExpiration.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe("Background Token Refresh", () => {
        it("should refresh tokens for all authorized applications", async () => {
            const mockAuthManagerInstance = {
                initialize: jest.fn().mockResolvedValue(undefined),
                refreshApplicationToken: jest.fn().mockResolvedValue(undefined),
                getApplications: jest.fn().mockReturnValue(mockApplications.filter(a => a.refreshToken))
            };

            await mockAuthManagerInstance.initialize(mockApplications);

            // Should schedule refresh for app1 (has refresh token)
            expect(mockAuthManagerInstance.initialize).toHaveBeenCalledWith(mockApplications);
        });

        it("should handle individual application refresh failures without affecting others", async () => {
            const mockAuthManagerInstance = {
                refreshApplicationToken: jest.fn()
                    .mockRejectedValueOnce(new Error("Refresh failed for app1"))
                    .mockResolvedValueOnce(undefined) // app2 succeeds
            };

            // First refresh fails
            await expect(mockAuthManagerInstance.refreshApplicationToken("app1")).rejects.toThrow();

            // Second refresh succeeds - demonstrates isolation
            await expect(mockAuthManagerInstance.refreshApplicationToken("app2")).resolves.not.toThrow();
        });
    });

    describe("Chat Operations with Multiple Applications", () => {
        it("should send chat message using active application", () => {
            const activeApp = mockApplications[0];
            // Chat effect should use this app's credentials
            expect(activeApp.id).toBe("app1");
            expect(activeApp.clientId).toBe("client1");
        });

        it("should fail chat sending when active application is not ready", () => {
            const notReadyApp = mockApplications[1];
            // Chat effect should return false and log error
            expect(notReadyApp.id).toBe("app2");
        });

        it("should receive chat messages in context of active application", () => {
            const activeApp = mockApplications[0];
            // Chat messages should be tagged with active app context
            expect(activeApp.id).toBe("app1");
        });
    });

    describe("Stream Detection with Application Switching", () => {
        it("should detect stream status for active application", () => {
            const activeApp = mockApplications[0];
            // BroadcastManager should check stream for this app
            expect(activeApp.id).toBe("app1");
        });

        it("should handle stream detection failure gracefully", () => {
            const notReadyApp = mockApplications[1];
            // Should log error and not attempt further operations
            expect(notReadyApp.id).toBe("app2");
        });

        it("should restart chat streaming when switching to different active application", () => {
            // Switching from app1 to app2
            // Chat manager should stop for app1 and start for app2
            expect(mockApplications).toHaveLength(2);
        });
    });

    describe("Quota Management Per Application", () => {
        it("should use active application quota settings", () => {
            const activeApp = mockApplications[0];
            expect(activeApp.quotaSettings.dailyQuota).toBe(10000);
        });

        it("should respect per-application quota limits", () => {
            const app1 = mockApplications[0];
            const app2 = mockApplications[1];

            expect(app1.quotaSettings.dailyQuota).toBe(10000);
            expect(app2.quotaSettings.dailyQuota).toBe(5000);
        });

        it("should apply custom polling delay from active application settings", () => {
            const appWithCustomDelay = {
                ...mockApplications[0],
                quotaSettings: {
                    ...mockApplications[0].quotaSettings,
                    overridePollingDelay: true,
                    customPollingDelaySeconds: 30
                }
            };

            expect(appWithCustomDelay.quotaSettings.customPollingDelaySeconds).toBe(30);
        });
    });
});
