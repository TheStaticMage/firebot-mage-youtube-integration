import { IntegrationData, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { EventEmitter } from "events";
import { IntegrationConstants } from "./constants";
import { YouTubeEventSource } from "./events";
import { AuthManager } from "./internal/auth-manager";
import { ApplicationManager } from "./internal/application-manager";
import { BroadcastManager } from "./internal/broadcast-manager";
import { ChatManager } from "./internal/chat-manager";
import { ChatStreamClient } from "./internal/chatstream-client";
import { QuotaManager } from "./internal/quota-manager";
import { RestApiClient } from "./internal/rest-api-client";
import { MultiAuthManager } from "./internal/multi-auth-manager";
import { firebot, logger } from "./main";
import { getDataFilePath } from "./util/datafile";
import { chatEffect } from "./effects/chat";
import { YouTubeOAuthApplication, ApplicationStorage } from "./types";

type IntegrationParameters = {
    googleApp: {
        clientId: string;
        clientSecret: string;
        channelId: string;
    };
    accounts: {
        authorizeStreamerAccount: unknown;
    };
    chat: {
        chatFeed: boolean;
    };
    quota: {
        dailyQuota: number;
        maxStreamHours: number;
        overridePollingDelay: boolean;
        customPollingDelaySeconds: number;
    };
    triggerTwitchEvents: {
        chatMessage: boolean;
    };
    logging: {
        logChatPushes: boolean;
        logApiResponses: boolean;
    };
    advanced: {
        suppressChatFeedNotifications: boolean;
    };
};

interface IntegrationFileData {
    refreshToken: string;
}

export class YouTubeIntegration extends EventEmitter {
    // connected needs to be set to true when the integration is successfully
    // connected. The Firebot integration manager checks this variable directly
    // rather than using a method.
    connected = false;

    // Managers for production integration
    private authManager: AuthManager = new AuthManager();
    private applicationManager: ApplicationManager = new ApplicationManager();
    private multiAuthManager: MultiAuthManager = new MultiAuthManager();
    private broadcastManager: BroadcastManager = new BroadcastManager();
    private quotaManager: QuotaManager = new QuotaManager();
    private chatManager: ChatManager | null = null;
    private restApiClient: RestApiClient = new RestApiClient();

    // Stream monitoring
    private streamCheckInterval: NodeJS.Timeout | null = null;
    private currentLiveChatId: string | null = null;

    // Data file paths
    private dataFilePath = "";
    private applicationsDataFilePath = "";

    // Multi-application data
    private applicationsStorage: ApplicationStorage = {
        applications: {},
        activeApplicationId: null
    };

    private settings: IntegrationParameters = {
        googleApp: {
            clientId: "",
            clientSecret: "",
            channelId: ""
        },
        accounts: {
            authorizeStreamerAccount: null
        },
        chat: {
            chatFeed: true
        },
        quota: {
            dailyQuota: 10000,
            maxStreamHours: 8,
            overridePollingDelay: false,
            customPollingDelaySeconds: -1
        },
        triggerTwitchEvents: {
            chatMessage: false
        },
        logging: {
            logChatPushes: false,
            logApiResponses: false
        },
        advanced: {
            suppressChatFeedNotifications: false
        }
    };

    // Whether to insert YT chat messages into the Firebot chat dashboard.
    private chatFeed = true;

    init(linked: boolean, integrationData: IntegrationData<IntegrationParameters>) {
        logger.info("YouTube integration initializing...");

        // Load settings
        if (integrationData.userSettings) {
            this.settings = JSON.parse(JSON.stringify(integrationData.userSettings));
        }

        // Register event source
        const { eventManager, httpServer } = firebot.modules;
        eventManager.registerEventSource(YouTubeEventSource);
        logger.info("YouTube event source registered");

        // Register HTTP endpoints for multi-application OAuth
        this.registerHttpEndpoints(httpServer);
        logger.info("Multi-application OAuth HTTP endpoints registered");

        // Register frontend communicator listeners
        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.on('mage-youtube-integration:getCharacterLimit', () => {
            return IntegrationConstants.YOUTUBE_CHAT_MESSAGE_CHARACTER_LIMIT;
        });
        frontendCommunicator.on('mage-youtube-integration:log', (data: { level: string; message: string }) => {
            const level = data.level || "info";
            const message = data.message || "";

            switch (level) {
                case "debug":
                    logger.debug(message);
                    break;
                case "info":
                    logger.info(message);
                    break;
                case "warn":
                    logger.warn(message);
                    break;
                case "error":
                    logger.error(message);
                    break;
                default:
                    logger.info(message);
                    break;
            }
        });
        logger.info("Frontend communicator listeners registered");

        // Register UI Extension communicator listeners
        this.registerUIExtensionListeners(frontendCommunicator);
        logger.info("UI Extension communicator listeners registered");

        // Register effects
        const { effectManager } = firebot.modules;
        effectManager.registerEffect(chatEffect);

        // Load integration data file (refresh token)
        this.dataFilePath = getDataFilePath("integration-data.json");
        const fileData = this.loadIntegrationData();

        // Initialize ApplicationManager path (needed for UI extension operations)
        this.applicationManager.initPath();

        // Load applications asynchronously (don't block init)
        this.applicationManager.initialize().catch((error) => {
            logger.error(`Failed to initialize ApplicationManager: ${error.message}`);
        });

        // Initialize auth manager with stored refresh token
        if (linked && fileData?.refreshToken) {
            try {
                this.authManager.init(fileData.refreshToken);
                logger.info("YouTube OAuth initialized with stored refresh token");
            } catch (error: any) {
                logger.error(`Failed to initialize auth manager: ${error.message}`);
            }
        }
    }

    async connect() {
        logger.info("YouTube integration connecting...");

        try {
            // Step 1: Check OAuth authentication
            if (!this.authManager.canConnect()) {
                throw new Error("No YouTube account linked. Please authorize your account in settings.");
            }

            // Connect auth manager (refreshes access token)
            await this.authManager.connect();
            logger.info("YouTube OAuth connected successfully");

            // Step 2: Find active live stream
            const accessToken = await this.authManager.getAccessToken();
            const channelId = this.settings.googleApp.channelId || undefined;

            logger.info("Searching for active YouTube broadcast...");
            const liveChatId = await this.broadcastManager.findActiveLiveChatId(accessToken, channelId);

            if (!liveChatId) {
                logger.warn("No active YouTube broadcast found. Will check periodically.");
                this.connected = true;
                this.emit("connected", IntegrationConstants.INTEGRATION_ID);

                // Start periodic stream checking
                this.startStreamChecking();
                return;
            }

            // Step 3: Start streaming chat
            await this.startChatStreaming(liveChatId, accessToken);

            this.connected = true;
            this.emit("connected", IntegrationConstants.INTEGRATION_ID);

            // Start periodic stream checking to detect when stream ends
            this.startStreamChecking();

            logger.info("YouTube integration connected successfully");

        } catch (error: any) {
            logger.error(`Failed to connect YouTube integration: ${error.message}`);
            this.sendCriticalErrorNotification(`Failed to connect: ${error.message}`);

            // Disconnect auth manager on failure
            this.authManager.disconnect();
            throw error;
        }
    }

    /**
     * Start streaming chat for a specific liveChatId
     */
    private async startChatStreaming(liveChatId: string, accessToken: string): Promise<void> {
        // Stop any existing stream first
        if (this.chatManager) {
            await this.chatManager.stopChatStreaming();
        }

        this.currentLiveChatId = liveChatId;
        // Create ChatManager with ChatStreamClient factory and integration reference
        this.chatManager = new ChatManager(logger, this.quotaManager, () => new ChatStreamClient(), this);

        // Start streaming (ChatManager will calculate delay internally)
        await this.chatManager.startChatStreaming(liveChatId, accessToken);
    }

    /**
     * Start periodic checking for stream status
     * Checks every 60 seconds to see if stream started/ended
     */
    private startStreamChecking(): void {
        if (this.streamCheckInterval) {
            clearInterval(this.streamCheckInterval);
        }

        this.streamCheckInterval = setInterval(async () => {
            try {
                await this.checkStreamStatus();
            } catch (error: any) {
                logger.error(`Error checking stream status: ${error.message}`);
            }
        }, 60000); // Check every 60 seconds
    }

    /**
     * Check if stream started or ended
     */
    private async checkStreamStatus(): Promise<void> {
        if (!this.connected) {
            return;
        }

        try {
            const accessToken = await this.authManager.getAccessToken();
            const channelId = this.settings.googleApp.channelId || undefined;

            const liveChatId = await this.broadcastManager.findActiveLiveChatId(accessToken, channelId);

            // Case 1: Stream just started
            if (!this.currentLiveChatId && liveChatId) {
                logger.info("YouTube stream detected, starting chat streaming");
                await this.startChatStreaming(liveChatId, accessToken);
                return;
            }

            // Case 2: Stream ended
            if (this.currentLiveChatId && !liveChatId) {
                logger.info("YouTube stream ended, stopping chat streaming");
                if (this.chatManager) {
                    await this.chatManager.stopChatStreaming();
                    this.chatManager = null;
                }
                this.currentLiveChatId = null;
                return;
            }

            // Case 3: Different stream started (liveChatId changed)
            if (this.currentLiveChatId && liveChatId && this.currentLiveChatId !== liveChatId) {
                logger.info("Different YouTube stream detected, switching streams");
                await this.startChatStreaming(liveChatId, accessToken);
                return;
            }

        } catch (error: any) {
            // Check if it's a quota error
            if (this.quotaManager.isQuotaExceededError(error)) {
                logger.error("YouTube API quota exceeded. Disconnecting integration.");
                this.sendCriticalErrorNotification("YouTube API quota exceeded. Please wait until quota resets.");
                await this.disconnect();
            } else {
                logger.error(`Stream status check failed: ${error.message}`);
            }
        }
    }

    async disconnect() {
        logger.debug("YouTube integration disconnecting...");
        this.emit("disconnecting", IntegrationConstants.INTEGRATION_ID);

        // Stop stream checking
        if (this.streamCheckInterval) {
            clearInterval(this.streamCheckInterval);
            this.streamCheckInterval = null;
        }

        // Stop chat streaming
        if (this.chatManager) {
            await this.chatManager.stopChatStreaming();
            this.chatManager = null;
        }

        // Disconnect auth manager
        this.authManager.disconnect();

        this.currentLiveChatId = null;
        this.connected = false;
        this.emit("disconnected", IntegrationConstants.INTEGRATION_ID);
        logger.info("YouTube integration disconnected.");
    }

    async onUserSettingsUpdate(integrationData: IntegrationData<IntegrationParameters>) {
        if (integrationData.userSettings) {
            logger.debug("YouTube integration user settings updated.");
            this.settings = JSON.parse(JSON.stringify(integrationData.userSettings));
        }
    }

    isChatFeedEnabled(): boolean {
        return this.settings.chat.chatFeed;
    }

    getModules(): ScriptModules {
        return firebot.modules;
    }

    getSettings(): IntegrationParameters {
        return this.settings;
    }

    getRestApiClient(): RestApiClient {
        return this.restApiClient;
    }

    getCurrentLiveChatId(): string | null {
        return this.currentLiveChatId;
    }

    getAuthManager(): AuthManager {
        return this.authManager;
    }

    getMultiAuthManager(): MultiAuthManager {
        return this.multiAuthManager;
    }

    getApplicationsStorage(): ApplicationStorage {
        return this.applicationsStorage;
    }

    /**
     * Get access token for active application
     */
    async getActiveApplicationAccessToken(): Promise<string> {
        if (!this.applicationsStorage.activeApplicationId) {
            logger.error("No active application set");
            return "";
        }

        return await this.multiAuthManager.getAccessToken(this.applicationsStorage.activeApplicationId);
    }

    /**
     * Set active application
     */
    setActiveApplication(applicationId: string): void {
        if (!this.applicationsStorage.applications[applicationId]) {
            throw new Error(`Application ${applicationId} not found`);
        }

        const app = this.applicationsStorage.applications[applicationId];
        if (!app.ready) {
            throw new Error(`Application ${applicationId} is not ready`);
        }

        this.applicationsStorage.activeApplicationId = applicationId;
        this.saveApplicationsStorage();
        logger.info(`Active application set to ${applicationId} (${app.name})`);
    }

    sendCriticalErrorNotification(message: string) {
        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("error", `YouTube Integration: ${message}`);
        logger.info(`Pop-up critical notification sent: ${JSON.stringify(message)}`);
    }

    sendChatFeedErrorNotification(message: string) {
        if (this.settings.advanced.suppressChatFeedNotifications) {
            logger.warn(`Chat feed notifications suppressed. Not sending this message: ${JSON.stringify(message)}`);
            return;
        }

        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("chatUpdate", {
            fbEvent: "ChatAlert",
            message: `YouTube Integration: ${message}`,
            icon: "fas fa-exclamation-triangle"
        });
        logger.info(`Chat feed notification sent: ${JSON.stringify(message)}`);
    }

    /**
     * Register HTTP endpoints for multi-application OAuth
     */
    private registerHttpEndpoints(httpServer: any): void {
        // Endpoint: /integrations/{prefix}/link/{appId}/streamer - Redirects to Google OAuth for specific app
        httpServer.registerCustomRoute(
            IntegrationConstants.INTEGRATION_URI,
            "link/:appId/streamer",
            "GET",
            this.handleLinkCallback.bind(this)
        );

        // Endpoint: /integrations/{prefix}/auth/callback - Handles OAuth callback for any app
        httpServer.registerCustomRoute(
            IntegrationConstants.INTEGRATION_URI,
            "auth/callback",
            "GET",
            this.handleAuthCallback.bind(this)
        );
    }

    /**
     * Handle the /link/{appId}/streamer endpoint
     * Redirects user to Google OAuth consent screen for specific application
     */
    private async handleLinkCallback(req: any, res: any): Promise<void> {
        const { appid } = req.params; // It comes through as lowercase
        const appId = appid as string;

        if (!appId) {
            res.status(400).send("Missing application ID");
            return;
        }

        // Load applications to get the specific application
        this.loadApplicationsStorage();
        const app = this.applicationsStorage.applications[appId];

        if (!app) {
            res.status(404).send("Application not found");
            return;
        }

        if (!app.clientId || !app.clientSecret) {
            res.status(400).send("Application missing client credentials");
            return;
        }

        try {
            // Initialize multi-auth manager with current applications
            await this.multiAuthManager.updateApplications(Object.values(this.applicationsStorage.applications));

            // Generate state with CSRF protection
            const state = JSON.stringify({
                appId: appId,
                timestamp: Date.now()
            });

            const authUrl = this.multiAuthManager.generateAuthorizationUrl(appId, state);
            logger.debug(`Redirecting user to authorization URL for application ${appId}: ${authUrl}`);
            res.redirect(authUrl);
        } catch (error: any) {
            logger.error(`Error handling link callback for application ${appId}: ${error.message}`);
            res.status(500).send(`Error handling link callback: ${error.message}`);
        }
    }

    /**
     * Handle the OAuth callback from Google
     * Exchange the authorization code for tokens
     */
    private async handleAuthCallback(req: any, res: any): Promise<void> {
        // Load applications to ensure multi-auth manager has current data
        this.loadApplicationsStorage();
        await this.multiAuthManager.updateApplications(Object.values(this.applicationsStorage.applications));

        // Delegate to multi-auth manager
        await this.multiAuthManager.handleAuthCallback(req, res);

        // Save updated applications data after callback
        this.saveApplicationsStorage();

        // Reload application manager to reflect the updated ready status
        await this.applicationManager.initialize();
    }

    /**
     * Load applications storage from file
     */
    private loadApplicationsStorage(): void {
        this.applicationsDataFilePath = getDataFilePath("applications.json");
        const { fs } = firebot.modules;

        if (!fs.existsSync(this.applicationsDataFilePath)) {
            logger.debug("No applications data file found");
            this.applicationsStorage = {
                applications: {},
                activeApplicationId: null
            };
            return;
        }

        try {
            const data = fs.readFileSync(this.applicationsDataFilePath, "utf8");
            const parsed = JSON.parse(data) as ApplicationStorage;
            this.applicationsStorage = parsed;
            logger.debug("Applications data loaded successfully");
        } catch (error: any) {
            logger.error(`Failed to load applications data: ${error.message}`);
            this.applicationsStorage = {
                applications: {},
                activeApplicationId: null
            };
        }
    }

    /**
     * Save applications storage to file
     */
    private saveApplicationsStorage(): void {
        const { fs } = firebot.modules;

        try {
            // Get updated applications from multi-auth manager
            const applications = this.multiAuthManager.getApplications();
            const applicationsMap: Record<string, YouTubeOAuthApplication> = {};

            for (const app of applications) {
                applicationsMap[app.id] = app;
            }

            // Preserve active application ID if it still exists
            if (this.applicationsStorage.activeApplicationId &&
                !applicationsMap[this.applicationsStorage.activeApplicationId]) {
                this.applicationsStorage.activeApplicationId = null;
            }

            this.applicationsStorage.applications = applicationsMap;

            fs.writeFileSync(this.applicationsDataFilePath, JSON.stringify(this.applicationsStorage, null, 2));
            logger.debug("Applications data saved successfully");
        } catch (error: any) {
            logger.error(`Failed to save applications data: ${error.message}`);
        }
    }

    /**
     * Load integration data from file
     */
    private loadIntegrationData(): IntegrationFileData | null {
        const { fs } = firebot.modules;

        if (!fs.existsSync(this.dataFilePath)) {
            logger.debug("No integration data file found");
            return null;
        }

        try {
            const data = fs.readFileSync(this.dataFilePath, "utf8");
            const parsed = JSON.parse(data) as IntegrationFileData;
            logger.debug("Integration data loaded successfully");
            return parsed;
        } catch (error: any) {
            logger.error(`Failed to load integration data: ${error.message}`);
            return null;
        }
    }

    /**
     * Save integration token data (OAuth refresh token)
     * Called by AuthManager after successful OAuth flow
     */
    saveIntegrationTokenData(tokenData: { refreshToken: string }): void {
        const data: IntegrationFileData = {
            refreshToken: tokenData.refreshToken
        };

        const { fs } = firebot.modules;
        fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2));
        logger.debug("YouTube OAuth refresh token saved to file");
    }

    /**
     * Unlink integration (revoke OAuth)
     * Called by AuthManager when user unlinks account
     */
    async unlinkIntegration(): Promise<void> {
        logger.debug("Unlinking YouTube integration...");

        // Disconnect if currently connected
        if (this.connected) {
            await this.disconnect();
        }

        // Delete integration data file
        const { fs } = firebot.modules;
        if (fs.existsSync(this.dataFilePath)) {
            fs.unlinkSync(this.dataFilePath);
            logger.info("YouTube integration data file deleted");
        }

        logger.info("YouTube integration unlinked successfully");
    }

    /**
     * Register UI Extension communicator listeners
     * Handles requests from the YouTube Applications UI extension
     */
    private registerUIExtensionListeners(frontendCommunicator: any): void {
        // Get all applications (returns application IDs and basic info only)
        frontendCommunicator.on('youTube:getApplications', () => {
            try {
                const applicationsMap = this.applicationManager.getApplications();
                const serializedMap: Record<string, any> = {};
                for (const [id, app] of Object.entries(applicationsMap)) {
                    serializedMap[id] = {
                        id: app.id,
                        name: app.name,
                        ready: app.ready,
                        status: app.status,
                        quotaSettings: {
                            dailyQuota: app.quotaSettings.dailyQuota,
                            maxStreamHours: app.quotaSettings.maxStreamHours,
                            overridePollingDelay: app.quotaSettings.overridePollingDelay,
                            customPollingDelaySeconds: app.quotaSettings.customPollingDelaySeconds
                        }
                    };
                }
                return { applications: serializedMap };
            } catch (error: any) {
                logger.error(`Error getting applications: ${error.message}`);
                return { errorMessage: error.message };
            }
        });

        // Get active application
        frontendCommunicator.on('youTube:getActiveApplication', () => {
            try {
                const activeApp = this.applicationManager.getActiveApplication();
                return { activeApplicationId: activeApp?.id || null };
            } catch (error: any) {
                logger.error(`Error getting active application: ${error.message}`);
                return { errorMessage: error.message };
            }
        });

        // Get application details (including credentials for editing)
        frontendCommunicator.on('youTube:getApplicationDetails', (data: { applicationId: string }) => {
            try {
                const app = this.applicationManager.getApplication(data.applicationId);
                if (!app) {
                    return { errorMessage: `Application with ID "${data.applicationId}" not found` };
                }
                return {
                    id: app.id,
                    name: app.name,
                    clientId: app.clientId,
                    clientSecret: app.clientSecret,
                    quotaSettings: {
                        dailyQuota: app.quotaSettings.dailyQuota,
                        maxStreamHours: app.quotaSettings.maxStreamHours,
                        overridePollingDelay: app.quotaSettings.overridePollingDelay,
                        customPollingDelaySeconds: app.quotaSettings.customPollingDelaySeconds
                    }
                };
            } catch (error: any) {
                logger.error(`Error getting application details: ${error.message}`);
                return { errorMessage: error.message };
            }
        });

        // Set active application
        frontendCommunicator.onAsync('youTube:setActiveApplication', async (data: { applicationId: string | null }) => {
            try {
                if (data.applicationId) {
                    await this.applicationManager.setActiveApplication(data.applicationId);
                } else {
                    await this.applicationManager.clearActiveApplication();
                }
                return { success: true };
            } catch (error: any) {
                logger.error(`Error setting active application: ${error.message}`);
                return { errorMessage: error.message };
            }
        });

        // Save application
        frontendCommunicator.onAsync('youTube:saveApplication', async (data: { applicationId: string; application: any }) => {
            try {
                const { applicationId, application } = data;
                const existingApp = this.applicationManager.getApplication(applicationId);

                if (existingApp) {
                    // Update existing application (preserves refreshToken)
                    await this.applicationManager.updateApplication(applicationId, {
                        name: application.name,
                        clientId: application.clientId,
                        clientSecret: application.clientSecret,
                        quotaSettings: application.quotaSettings
                    });
                } else {
                    // Add new application (refreshToken will be added during OAuth flow)
                    await this.applicationManager.addApplication(
                        application.name,
                        application.clientId,
                        application.clientSecret,
                        application.quotaSettings
                    );
                }

                const applicationsMap = this.applicationManager.getApplications();
                const serializedMap: Record<string, any> = {};
                for (const [id, app] of Object.entries(applicationsMap)) {
                    serializedMap[id] = {
                        id: app.id,
                        name: app.name,
                        ready: app.ready,
                        status: app.status,
                        quotaSettings: {
                            dailyQuota: app.quotaSettings.dailyQuota,
                            maxStreamHours: app.quotaSettings.maxStreamHours,
                            overridePollingDelay: app.quotaSettings.overridePollingDelay,
                            customPollingDelaySeconds: app.quotaSettings.customPollingDelaySeconds
                        }
                    };
                }
                return { success: true, applications: serializedMap };
            } catch (error: any) {
                logger.error(`Error saving application: ${error.message}`);
                return { errorMessage: error.message };
            }
        });

        // Delete application
        frontendCommunicator.onAsync('youTube:deleteApplication', async (data: { applicationId: string }) => {
            try {
                await this.applicationManager.removeApplication(data.applicationId);
                const applicationsMap = this.applicationManager.getApplications();
                const serializedMap: Record<string, any> = {};
                for (const [id, app] of Object.entries(applicationsMap)) {
                    serializedMap[id] = {
                        id: app.id,
                        name: app.name,
                        ready: app.ready,
                        status: app.status,
                        quotaSettings: {
                            dailyQuota: app.quotaSettings.dailyQuota,
                            maxStreamHours: app.quotaSettings.maxStreamHours,
                            overridePollingDelay: app.quotaSettings.overridePollingDelay,
                            customPollingDelaySeconds: app.quotaSettings.customPollingDelaySeconds
                        }
                    };
                }
                return { success: true, applications: serializedMap };
            } catch (error: any) {
                logger.error(`Error deleting application: ${error.message}`);
                return { errorMessage: error.message };
            }
        });

        // Deauthorize application
        frontendCommunicator.onAsync('youTube:deauthorizeApplication', async (data: { applicationId: string }) => {
            try {
                const app = this.applicationManager.getApplication(data.applicationId);
                if (!app) {
                    throw new Error(`Application with ID "${data.applicationId}" not found`);
                }

                // Clear the refresh token and mark as not ready
                app.refreshToken = "";
                await this.applicationManager.updateApplicationReadyStatus(data.applicationId, false, "Authorization required");

                // Clear the auth manager for this application
                this.multiAuthManager.clearApplicationAuth(data.applicationId);

                const applicationsMap = this.applicationManager.getApplications();
                const serializedMap: Record<string, any> = {};
                for (const [id, appData] of Object.entries(applicationsMap)) {
                    serializedMap[id] = {
                        id: appData.id,
                        name: appData.name,
                        ready: appData.ready,
                        status: appData.status,
                        quotaSettings: {
                            dailyQuota: appData.quotaSettings.dailyQuota,
                            maxStreamHours: appData.quotaSettings.maxStreamHours,
                            overridePollingDelay: appData.quotaSettings.overridePollingDelay,
                            customPollingDelaySeconds: appData.quotaSettings.customPollingDelaySeconds
                        }
                    };
                }
                return { success: true, applications: serializedMap };
            } catch (error: any) {
                logger.error(`Error deauthorizing application: ${error.message}`);
                return { errorMessage: error.message };
            }
        });

        // Refresh application states
        frontendCommunicator.onAsync('youTube:refreshApplicationStates', async () => {
            try {
                // Trigger manual refresh of all application states
                // This would trigger the MultiAuthManager to refresh tokens
                logger.debug("Refresh application states request received");
                return { success: true };
            } catch (error: any) {
                logger.error(`Error refreshing application states: ${error.message}`);
                return { errorMessage: error.message };
            }
        });
    }
}

export const integration = new YouTubeIntegration();
