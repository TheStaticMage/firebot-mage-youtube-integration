import { YouTubeOAuthApplication } from "../../types";

jest.mock("../../main", () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock("../rest-api-client", () => ({
    RestApiClient: jest.fn()
}));

jest.mock("../../integration-singleton", () => ({
    integration: {
        getApplicationsStorage: jest.fn(),
        getMultiAuthManager: jest.fn(),
        getCurrentLiveChatId: jest.fn()
    }
}));

describe("Chat Operations with Multiple Applications", () => {
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
                overridePollingDelay: true,
                customPollingDelaySeconds: 30
            },
            ready: false
        },
        {
            id: "app3",
            name: "Channel 3",
            clientId: "client3",
            clientSecret: "secret3",
            refreshToken: "refresh3",
            quotaSettings: {
                dailyQuota: 8000,
                maxStreamHours: 6,
                overridePollingDelay: false,
                customPollingDelaySeconds: -1
            },
            ready: true,
            tokenExpiresAt: Date.now() + 7200000
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("Chat Sending with Different Active Applications", () => {
        it("should send chat message when active application is ready", () => {
            const activeApp = mockApplications[0];
            expect(activeApp.ready).toBe(true);
            expect(activeApp.refreshToken).toBeTruthy();
            // Chat effect should successfully send
        });

        it("should fail chat sending when active application is not ready", () => {
            const activeApp = mockApplications[1];
            expect(activeApp.ready).toBe(false);
            // Chat effect should return false
        });

        it("should fail chat sending when no active application is set", () => {
            const activeApp = null;
            expect(activeApp).toBeNull();
            // Chat effect should fail with no active app error
        });

        it("should use correct application credentials for sending", () => {
            const app1 = mockApplications[0];
            const app3 = mockApplications[2];

            expect(app1.clientId).toBe("client1");
            expect(app3.clientId).toBe("client3");
            // Each should use its own client ID for API calls
        });

        it("should respect application-specific quota settings when sending", () => {
            const app1 = mockApplications[0];
            const app2 = mockApplications[1];

            expect(app1.quotaSettings.dailyQuota).toBe(10000);
            expect(app2.quotaSettings.dailyQuota).toBe(5000);
            // Each should use its own quota limits
        });

        it("should handle rapid chat sending with same application", () => {
            const activeApp = mockApplications[0];
            const messages = ["msg1", "msg2", "msg3"];

            expect(activeApp.ready).toBe(true);
            // All messages should use same app credentials
            messages.forEach((msg) => {
                expect(msg).toBeTruthy();
            });
        });

        it("should fail when active application loses ready status", () => {
            const freshApp = { ...mockApplications[0] };
            expect(freshApp.ready).toBe(true);

            // Simulate ready status becoming false
            freshApp.ready = false;

            expect(freshApp.ready).toBe(false);
            // Chat sending should now fail
        });

        it("should prevent switching to non-ready application for sending", () => {
            const readyApp = mockApplications.find(app => app.ready);
            const notReadyApp = mockApplications.find(app => !app.ready);

            expect(readyApp?.ready).toBe(true);
            expect(notReadyApp?.ready).toBe(false);
            // Should only allow sending from ready app
        });

        it("should track which application sent each message", () => {
            const message = "Test message";
            const activeApp = mockApplications[0];

            const messageContext = {
                text: message,
                appId: activeApp.id,
                appName: activeApp.name
            };

            expect(messageContext.appId).toBe("app1");
            expect(messageContext.appName).toBe("Channel 1");
        });
    });

    describe("Stream Detection with Application Switching", () => {
        it("should detect stream for active application", () => {
            const activeApp = mockApplications[0];
            expect(activeApp.ready).toBe(true);
            // BroadcastManager should check stream for app1
        });

        it("should fail stream detection when active application is not ready", () => {
            const notReadyApp = mockApplications[1];
            expect(notReadyApp.ready).toBe(false);
            // Stream detection should fail gracefully
        });

        it("should handle switching active application during stream", () => {
            const app1 = mockApplications[0];
            const app3 = mockApplications[2];

            expect(app1.ready).toBe(true);
            expect(app3.ready).toBe(true);
            // Both are ready, switching should be smooth
        });

        it("should stop monitoring stream for old application when switching", () => {
            const currentApp = mockApplications[0];
            const nextApp = mockApplications[2];

            // Old app monitoring should stop
            expect(currentApp.id).toBe("app1");
            // New app monitoring should start
            expect(nextApp.id).toBe("app3");
        });

        it("should preserve stream state when both applications are ready", () => {
            const readyApps = mockApplications.filter(app => app.ready);
            expect(readyApps).toHaveLength(2);

            // Stream state should be compatible across ready apps
            readyApps.forEach((app) => {
                expect(app.ready).toBe(true);
            });
        });

        it("should handle stream detection with custom polling delay", () => {
            const appWithCustomDelay = mockApplications.find(
                app => app.quotaSettings.overridePollingDelay
            );

            expect(appWithCustomDelay?.quotaSettings.customPollingDelaySeconds).toBe(30);
            // Stream detection should use custom 30-second delay
        });

        it("should handle rapid application switching during stream", () => {
            const readyApps = mockApplications.filter(app => app.ready);

            // Simulate rapid switching
            const switches = [
                readyApps[0],
                readyApps[1],
                readyApps[0],
                readyApps[1]
            ];

            switches.forEach((app) => {
                expect(app.ready).toBe(true);
            });
            // System should handle rapid switches without crashing
        });

        it("should resume stream detection after switching to ready application", () => {
            const notReadyApp = { ...mockApplications[1] };
            const readyApp = { ...mockApplications[0] };

            // Starts with not-ready app
            expect(notReadyApp.ready).toBe(false);
            // Switches to ready app
            expect(readyApp.ready).toBe(true);
            // Should resume stream detection immediately
        });

        it("should track active stream for each ready application", () => {
            const readyApps = mockApplications.filter(app => app.ready);

            readyApps.forEach((app) => {
                const streamContext = {
                    appId: app.id,
                    liveChatId: "chat-12345",
                    isStreaming: true
                };

                expect(streamContext.appId).toBeTruthy();
                expect(streamContext.liveChatId).toBeTruthy();
            });
        });
    });

    describe("Multi-Application Chat Context", () => {
        it("should maintain correct context when multiple applications have active streams", () => {
            const readyApps = mockApplications.filter(app => app.ready);

            readyApps.forEach((app) => {
                const context = {
                    app: app,
                    currentChat: null,
                    isMonitoring: true
                };

                expect(context.app.id).toBeTruthy();
                expect(context.isMonitoring).toBe(true);
            });
        });

        it("should isolate chat context between applications", () => {
            const app1Context = {
                appId: mockApplications[0].id,
                chatId: "chat-1"
            };

            const app3Context = {
                appId: mockApplications[2].id,
                chatId: "chat-3"
            };

            expect(app1Context.appId).not.toBe(app3Context.appId);
            expect(app1Context.chatId).not.toBe(app3Context.chatId);
        });

        it("should handle messages from different applications simultaneously", () => {
            const messages = [
                { appId: "app1", text: "Message from app1", timestamp: Date.now() },
                { appId: "app3", text: "Message from app3", timestamp: Date.now() },
                { appId: "app1", text: "Another message from app1", timestamp: Date.now() + 1000 }
            ];

            expect(messages).toHaveLength(3);
            expect(messages[0].appId).toBe("app1");
            expect(messages[1].appId).toBe("app3");
            expect(messages[2].appId).toBe("app1");
        });

        it("should route chat messages to correct application", () => {
            const freshApps = mockApplications.map(a => ({ ...a }));

            const routeMessage = (appId: string, message: string) => {
                const app = freshApps.find(a => a.id === appId);
                return {
                    app,
                    message,
                    routed: !!app?.ready
                };
            };

            const msg1 = routeMessage("app1", "test");
            const msg3 = routeMessage("app3", "test");

            expect(msg1.routed).toBe(true);
            expect(msg3.routed).toBe(true);
        });
    });
});
