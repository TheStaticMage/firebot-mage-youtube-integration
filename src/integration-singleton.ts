import { IntegrationData } from "@crowbartools/firebot-custom-scripts-types";
import { EventEmitter } from "events";
import { IntegrationConstants } from "./constants";
import { chatEffect } from "./effects/chat";
import { YouTubeEventSource } from "./events";
import { ApplicationManager } from "./internal/application-manager";
import { getApplicationStatusMessage } from "./internal/application-utils";
import { BroadcastManager } from "./internal/broadcast-manager";
import { ChatManager } from "./internal/chat-manager";
import { ChatStreamClient } from "./internal/chatstream-client";
import { MultiAuthManager } from "./internal/multi-auth-manager";
import { QuotaManager } from "./internal/quota-manager";
import { RestApiClient } from "./internal/rest-api-client";
import { firebot, logger } from "./main";
import { ApplicationStorage, YouTubeOAuthApplication } from "./types";
import { getDataFilePath } from "./util/datafile";
import { registerUIExtensions } from "./ui-extensions";

type IntegrationParameters = {
    chat: {
        chatFeed: boolean;
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
    private applicationManager: ApplicationManager = new ApplicationManager();
    private multiAuthManager: MultiAuthManager = new MultiAuthManager();
    private quotaManager: QuotaManager = new QuotaManager();
    private broadcastManager: BroadcastManager = new BroadcastManager(this);
    private chatManager: ChatManager | null = null;
    private restApiClient: RestApiClient = new RestApiClient(this);

    // Stream monitoring
    private streamCheckInterval: NodeJS.Timeout | null = null;
    private currentLiveChatId: string | null = null;
    private currentActiveApplicationId: string | null = null;

    // Data file paths
    private dataFilePath = "";

    private settings: IntegrationParameters = {
        chat: {
            chatFeed: true
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

    init(_linked: boolean, integrationData: IntegrationData<IntegrationParameters>) {
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

        // Register UI extensions
        registerUIExtensions();
        logger.info("UI Extensions registered");

        // Initialize QuotaManager
        this.quotaManager.initialize().catch((error) => {
            logger.error(`Failed to initialize QuotaManager: ${error.message}`);
        });
        logger.info("QuotaManager initialized");

        // Initialize ApplicationManager
        this.dataFilePath = getDataFilePath("integration-data.json");
        this.applicationManager.initPath();

        // Load applications asynchronously (don't block init)
        // ApplicationManager.initialize() will load applications from file and validate ready status
        this.applicationManager.initialize().catch((error) => {
            logger.error(`Failed to initialize ApplicationManager: ${error.message}`);
        });
    }

    async connect() {
        logger.info("YouTube integration connecting...");

        try {
            // Step 0: Get applications from ApplicationManager
            const applicationsMap = this.applicationManager.getApplications();
            const applications = Object.values(applicationsMap);

            if (applications.length === 0) {
                throw new Error("No YouTube applications configured. Please add an application in the YouTube Applications settings.");
            }

            // Step 1: Determine active application
            // First, try to use the previously-active application if it still exists and has a refresh token
            let activeApp = this.applicationManager.getActiveApplication();

            // If no previously-active application, find first application with a refresh token
            if (!activeApp || !activeApp.refreshToken) {
                activeApp = applications.find(app => app.refreshToken) || null;
            }

            if (!activeApp) {
                throw new Error("No YouTube applications with valid refresh tokens available. Please authorize an application in the YouTube Applications settings.");
            }

            const activeApplicationId = activeApp.id;

            // Restore or set the active application if needed
            const currentActive = this.applicationManager.getActiveApplication();
            if (!currentActive || currentActive.id !== activeApplicationId) {
                logger.info(`Setting active application: ${activeApp.name} (${activeApplicationId})`);
                await this.applicationManager.setActiveApplication(activeApplicationId);
            }

            logger.info(`Using active application: ${activeApp.name} (${activeApplicationId})`);

            // Step 2: Initialize MultiAuthManager with all applications and start background refresh
            await this.multiAuthManager.initialize(applications);
            logger.info(`Initialized MultiAuthManager with ${applications.length} application(s) - background refresh started`);

            // Step 3: Immediately refresh active application's token before use
            logger.debug(`Refreshing active application token before use: ${activeApp.name}`);
            await this.multiAuthManager.refreshApplicationToken(activeApplicationId);

            // Step 4: Get access token for active application
            const accessToken = await this.multiAuthManager.getAccessToken(activeApplicationId);
            if (!accessToken) {
                throw new Error(`Failed to get access token for active application "${activeApp.name}".`);
            }
            logger.info("YouTube OAuth connected successfully");

            // Step 5: Find active live stream
            logger.info("Searching for active YouTube broadcast...");
            const liveChatId = await this.broadcastManager.findActiveLiveChatId(accessToken, undefined, activeApplicationId);

            if (!liveChatId) {
                logger.warn("No active YouTube broadcast found. Will check periodically.");
                this.connected = true;
                this.currentActiveApplicationId = activeApplicationId;
                this.emit("connected", IntegrationConstants.INTEGRATION_ID);

                // Start periodic stream checking
                this.startStreamChecking();
                return;
            }

            // Step 6: Start streaming chat
            this.currentActiveApplicationId = activeApplicationId;
            await this.startChatStreaming(liveChatId, accessToken, activeApplicationId);

            this.connected = true;
            this.emit("connected", IntegrationConstants.INTEGRATION_ID);

            // Start periodic stream checking to detect when stream ends
            this.startStreamChecking();

            logger.info("YouTube integration connected successfully");

        } catch (error: any) {
            logger.error(`Failed to connect YouTube integration: ${error.message}`);
            this.sendCriticalErrorNotification(`Failed to connect: ${error.message}`);

            throw error;
        }
    }

    /**
     * Start streaming chat for a specific liveChatId
     */
    private async startChatStreaming(liveChatId: string, accessToken: string, activeApplicationId: string): Promise<void> {
        // Stop any existing stream first
        if (this.chatManager) {
            await this.chatManager.stopChatStreaming();
        }

        this.currentLiveChatId = liveChatId;
        // Create ChatManager with ChatStreamClient factory and integration reference
        this.chatManager = new ChatManager(logger, this.quotaManager, () => new ChatStreamClient(this), this);

        // Start streaming (ChatManager will calculate delay internally)
        await this.chatManager.startChatStreaming(liveChatId, accessToken);
        logger.debug(`Chat streaming started for application ${activeApplicationId}`);
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
        if (!this.connected || !this.currentActiveApplicationId) {
            return;
        }

        try {
            // Verify active application is still ready
            const activeApp = this.applicationManager.getApplication(this.currentActiveApplicationId || "");
            if (!activeApp || !activeApp.ready) {
                logger.error("Active application is no longer ready. Disconnecting.");
                this.sendCriticalErrorNotification("Active YouTube application is no longer ready. Disconnecting.");
                await this.disconnect();
                return;
            }

            const accessToken = await this.multiAuthManager.getAccessToken(this.currentActiveApplicationId);
            if (!accessToken) {
                logger.error("Failed to get access token for active application during stream status check.");
                await this.disconnect();
                return;
            }

            const liveChatId = await this.broadcastManager.findActiveLiveChatId(accessToken, undefined, this.currentActiveApplicationId);

            // Case 1: Stream just started
            if (!this.currentLiveChatId && liveChatId) {
                logger.info("YouTube stream detected, starting chat streaming");
                await this.startChatStreaming(liveChatId, accessToken, this.currentActiveApplicationId);
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
                await this.startChatStreaming(liveChatId, accessToken, this.currentActiveApplicationId);
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
        logger.info("YouTube integration disconnecting...");
        this.emit("disconnecting", IntegrationConstants.INTEGRATION_ID);

        // Stop periodic stream checking
        if (this.streamCheckInterval) {
            clearInterval(this.streamCheckInterval);
            this.streamCheckInterval = null;
            logger.debug("Stream checking stopped");
        }

        // Stop chat streaming
        if (this.chatManager) {
            await this.chatManager.stopChatStreaming();
            this.chatManager = null;
            logger.debug("Chat streaming stopped");
        }

        // Flush quota data before disconnect
        this.quotaManager.flushQuotaData();

        // Destroy multi-auth manager and stop all background refresh timers
        this.multiAuthManager.destroy();
        logger.debug("Background token refresh timers destroyed for all applications");

        this.currentLiveChatId = null;
        this.currentActiveApplicationId = null;
        this.connected = false;
        this.emit("disconnected", IntegrationConstants.INTEGRATION_ID);
        logger.info("YouTube integration disconnected successfully");
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

    getSettings(): IntegrationParameters {
        return this.settings;
    }

    getRestApiClient(): RestApiClient {
        return this.restApiClient;
    }

    getCurrentLiveChatId(): string | null {
        return this.currentLiveChatId;
    }

    getMultiAuthManager(): MultiAuthManager {
        return this.multiAuthManager;
    }

    getQuotaManager(): QuotaManager {
        return this.quotaManager;
    }

    getApplicationsStorage(): ApplicationStorage {
        // Build ApplicationStorage from ApplicationManager as the single source of truth
        const applicationsMap = this.applicationManager.getApplications();
        const activeApp = this.applicationManager.getActiveApplication();
        return {
            applications: applicationsMap,
            activeApplicationId: activeApp?.id || null
        };
    }

    /**
     * Get access token for active application
     */
    async getActiveApplicationAccessToken(): Promise<string> {
        const activeApp = this.applicationManager.getActiveApplication();
        if (!activeApp) {
            logger.error("No active application set");
            return "";
        }

        return await this.multiAuthManager.getAccessToken(activeApp.id);
    }

    /**
     * Switch to a different active application
     * If currently connected, seamlessly switches streaming to the new application
     */
    async switchActiveApplication(newApplicationId: string): Promise<void> {
        const newApp = this.applicationManager.getApplication(newApplicationId);
        if (!newApp) {
            throw new Error(`Application ${newApplicationId} not found`);
        }

        if (!newApp.ready) {
            throw new Error(`Application ${newApplicationId} is not ready`);
        }

        const previousApplicationId = this.currentActiveApplicationId;
        this.currentActiveApplicationId = newApplicationId;

        // Update active application in ApplicationManager
        await this.applicationManager.setActiveApplication(newApplicationId);

        logger.info(`Active application switched from ${previousApplicationId} to ${newApplicationId} (${newApp.name})`);

        // If connected, restart streaming with new application
        if (this.connected && this.currentLiveChatId) {
            try {
                logger.info("Restarting chat streaming with new active application");

                // Stop existing chat stream
                if (this.chatManager) {
                    await this.chatManager.stopChatStreaming();
                    this.chatManager = null;
                }

                // Get access token for new application
                const accessToken = await this.multiAuthManager.getAccessToken(newApplicationId);
                if (!accessToken) {
                    throw new Error(`Failed to get access token for new application ${newApplicationId}`);
                }

                // Restart chat streaming with new application
                await this.startChatStreaming(this.currentLiveChatId, accessToken, newApplicationId);
                logger.info("Chat streaming restarted successfully with new active application");
            } catch (error: any) {
                logger.error(`Failed to restart chat streaming with new application: ${error.message}`);
                // If seamless switch fails, disconnect to prevent inconsistent state
                await this.disconnect();
                this.sendCriticalErrorNotification(`Failed to switch applications: ${error.message}`);
                throw error;
            }
        }
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
     * Notify UI about application status changes
     */
    notifyApplicationStatusChange(applicationId: string, app: YouTubeOAuthApplication): void {
        const { frontendCommunicator } = firebot.modules;

        // Send status change event to UI
        const displayStatus = getApplicationStatusMessage(app);
        frontendCommunicator.send("youTube:applicationStatusChanged", {
            applicationId: applicationId,
            ready: app.ready,
            status: displayStatus,
            name: app.name
        });

        logger.debug(`Notified UI of application status change: ${app.name} - ${displayStatus}`);
    }

    /**
     * Serialize applications for UI (with formatted status messages)
     */
    private serializeApplicationsForUI(applicationsMap: Record<string, YouTubeOAuthApplication>): Record<string, any> {
        const serializedMap: Record<string, any> = {};
        for (const [id, app] of Object.entries(applicationsMap)) {
            const quotaUsage = this.quotaManager.getQuotaUsage(id);
            const quotaUnitsUsed = quotaUsage?.quotaUnitsUsed || 0;
            serializedMap[id] = {
                id: app.id,
                name: app.name,
                ready: app.ready,
                status: getApplicationStatusMessage(app),
                quotaSettings: {
                    dailyQuota: app.quotaSettings.dailyQuota,
                    maxStreamHours: app.quotaSettings.maxStreamHours,
                    overridePollingDelay: app.quotaSettings.overridePollingDelay,
                    customPollingDelaySeconds: app.quotaSettings.customPollingDelaySeconds
                },
                quotaUnitsUsed: quotaUnitsUsed
            };
        }
        return serializedMap;
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

        // Get the specific application from ApplicationManager
        const app = this.applicationManager.getApplication(appId);

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
            const applications = Object.values(this.applicationManager.getApplications());
            await this.multiAuthManager.updateApplications(applications);

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
        // Get current applications from ApplicationManager
        const applications = Object.values(this.applicationManager.getApplications());
        await this.multiAuthManager.updateApplications(applications);

        // Delegate to multi-auth manager
        await this.multiAuthManager.handleAuthCallback(req, res);

        // Extract the updated application from MultiAuthManager and sync back to ApplicationManager
        // This ensures the refresh token received from Google OAuth is persisted to disk
        const updatedApplications = this.multiAuthManager.getApplications();
        for (const app of updatedApplications) {
            try {
                await this.applicationManager.updateApplication(app.id, {
                    refreshToken: app.refreshToken,
                    ready: app.ready,
                    tokenExpiresAt: app.tokenExpiresAt
                });
            } catch (error: any) {
                logger.error(`Failed to sync updated application ${app.id} after OAuth callback: ${error.message}`);
            }
        }
    }

    /**
     * Save integration token data (OAuth refresh token)
     * Legacy method - OAuth is now managed per-application via ApplicationManager
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
                const serializedMap = this.serializeApplicationsForUI(applicationsMap);
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
                const serializedMap = this.serializeApplicationsForUI(applicationsMap);
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
                const serializedMap = this.serializeApplicationsForUI(applicationsMap);
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
                const serializedMap = this.serializeApplicationsForUI(applicationsMap);
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
