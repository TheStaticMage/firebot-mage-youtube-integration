import { createHash } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { IntegrationConstants } from "../constants";
import { firebot, logger } from "../main";
import { YouTubeOAuthApplication } from "../types";
import type { ApplicationManager } from "./application-manager";
import { updateApplicationReadyStatus } from "./application-utils";
import { ApiCallType } from "./error-constants";
import { ErrorTracker } from "./error-tracker";

/**
 * MultiAuthManager handles YouTube OAuth 2.0 authentication for multiple applications
 *
 * Responsibilities:
 * - Manage per-application OAuth2 clients
 * - Schedule automatic token refresh for ALL applications
 * - Provide access tokens for specific applications
 * - Handle OAuth callbacks for any application
 * - Maintain ready status for all applications
 * - Generate authorization URLs for specific applications
 */
export class MultiAuthManager {
    private applicationManager: ApplicationManager;
    private applications = new Map<string, YouTubeOAuthApplication>();
    private authManagers = new Map<string, ApplicationAuthManager>();
    private errorTracker: ErrorTracker;
    private refreshTimers = new Map<string, NodeJS.Timeout>();

    constructor(errorTracker: ErrorTracker, applicationManager: ApplicationManager) {
        this.errorTracker = errorTracker;
        this.applicationManager = applicationManager;
    }

    /**
     * Initialize the MultiAuthManager with applications
     * @param applications Array of YouTube OAuth applications
     */
    async initialize(applications: YouTubeOAuthApplication[]): Promise<void> {
        logger.info(`Initializing MultiAuthManager with ${applications.length} application(s)`);

        // Clear existing timers and managers
        this.clearAllTimers();
        this.authManagers.clear();
        this.applications.clear();

        let authorizedCount = 0;
        let unauthorizedCount = 0;

        // Create managers and schedule refresh for each application
        for (const app of applications) {
            this.applications.set(app.id, app);

            if (app.refreshToken) {
                const manager = new ApplicationAuthManager(app, this.applicationManager);
                this.authManagers.set(app.id, manager);

                // Schedule refresh for this application (automatic background refresh every ~50 minutes)
                this.scheduleRefreshForApplication(app);
                authorizedCount++;
                logger.debug(`Application "${app.name}" (${app.id}) - scheduled for background token refresh`);
            } else {
                // Application without refresh token is not ready
                updateApplicationReadyStatus(app, false);
                unauthorizedCount++;
                logger.debug(`Application "${app.name}" (${app.id}) - awaiting authorization`);
            }
        }

        logger.info(`MultiAuthManager initialized: ${authorizedCount} authorized application(s) with automatic refresh, ${unauthorizedCount} awaiting authorization`);
    }

    /**
     * Get an access token for a specific application
     * @param applicationId The ID of the application
     * @returns Access token if available, empty string otherwise
     */
    async getAccessToken(applicationId: string): Promise<string> {
        const manager = this.authManagers.get(applicationId);
        if (!manager) {
            logger.error(`No auth manager found for application ${applicationId}`);
            return "";
        }

        try {
            return await manager.getAccessToken();
        } catch (error: any) {
            logger.error(`Failed to get access token for application ${applicationId}: ${error.message}`);

            // Update ready status on failure
            const app = this.applications.get(applicationId);
            if (app) {
                updateApplicationReadyStatus(app, false);
            }

            return "";
        }
    }

    /**
     * Generate authorization URL for a specific application
     * @param applicationId The ID of the application
     * @returns Authorization URL for OAuth flow
     */
    generateAuthorizationUrl(applicationId: string, state: string): string {
        const app = this.applications.get(applicationId);
        if (!app || !app.clientId) {
            throw new Error(`Application ${applicationId} not found or missing client ID`);
        }

        const redirectUri = this.getRedirectUri();

        const oauth2Client = new OAuth2Client(
            app.clientId,
            app.clientSecret,
            redirectUri
        );

        const authUrl = oauth2Client.generateAuthUrl({
            // eslint-disable-next-line camelcase
            access_type: 'offline',
            scope: this.getYouTubeScopes(),
            prompt: 'consent', // Force consent to get refresh token
            state // Include state parameter for CSRF protection
        });

        logger.debug(`Generated YouTube authorization URL for application ${applicationId}: ${authUrl}`);
        return authUrl;
    }

    /**
     * Handle OAuth callback for any application
     * @param req Express request object
     * @param res Express response object
     */
    async handleAuthCallback(req: any, res: any): Promise<string | undefined> {
        const { code, state } = req.query;

        if (!code) {
            logger.error("Missing 'code' in OAuth callback.");
            res.status(400).send("Missing 'code' in callback.");
            return;
        }

        if (!state) {
            logger.error("Missing 'state' in OAuth callback.");
            res.status(400).send("Missing 'state' in callback.");
            return;
        }

        // Parse state to get application ID
        let applicationId: string;
        try {
            const stateData = JSON.parse(state);
            applicationId = stateData.appId;

            if (!applicationId) {
                throw new Error("Missing appId in state");
            }
        } catch (error: any) {
            logger.error(`Invalid state parameter in OAuth callback: ${error.message}`);
            res.status(400).send("Invalid state parameter.");
            return;
        }

        let app = this.applications.get(applicationId);
        if (!app) {
            logger.error(`Application ${applicationId} not found in OAuth callback`);
            res.status(400).send("Application not found.");
            return;
        }

        logger.info(`OAuth callback received for application ${applicationId}`);

        const redirectUri = this.getRedirectUri();

        const oauth2Client = new OAuth2Client(
            app.clientId,
            app.clientSecret,
            redirectUri
        );

        try {
            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code);

            if (!tokens.refresh_token) {
                logger.error(`No refresh token received for application ${applicationId}`);
                res.status(400).send(
                    `<p>Error: No refresh token received.</p><p>This can happen if you previously authorized this app. Try <a href="${this.generateAuthorizationUrl(applicationId, state)}">authorizing again</a> in an incognito window.</p>`
                );
                return;
            }

            // Get user email from token info
            let userEmail: string | undefined;
            try {
                const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token || "");
                userEmail = tokenInfo.email;
                if (userEmail) {
                    const emailHash = createHash("sha256").update(userEmail).digest("hex").substring(0, 11);
                    logger.debug(`Retrieved email for application ${applicationId}: <sha256:${emailHash}>`);
                }
            } catch (error: any) {
                logger.warn(`Failed to retrieve email for application ${applicationId}: ${error.message}`);
            }

            // Create or update auth manager and persist all token data
            const manager = new ApplicationAuthManager(app, this.applicationManager);
            await manager.setTokens(tokens, userEmail);
            this.authManagers.set(applicationId, manager);

            // Refresh snapshot to include persisted token updates
            const refreshedApp = this.refreshApplicationSnapshot(applicationId, true);
            if (refreshedApp) {
                app = refreshedApp;
            }

            // Schedule refresh for this application
            this.scheduleRefreshForApplication(app);

            logger.info(`Application ${applicationId} authorized successfully`);

            res.status(200).send(
                `<p>YouTube application "${app.name}" authorized! You can close this tab.</p>`
            );

            // Return the authorized application ID so the caller can set it as active if needed
            return applicationId;

        } catch (error: any) {
            logger.error(`Failed to exchange code for tokens for application ${applicationId}: ${error.message}`);
            updateApplicationReadyStatus(app, false);
            res.status(500).send(`<p>Failed to exchange code for tokens: ${error.message}</p>`);
        }
    }

    /**
     * Schedule token refresh for a specific application
     * @param app The application to schedule refresh for
     */
    private scheduleRefreshForApplication(app: YouTubeOAuthApplication): void {
        // Clear existing timer for this application
        if (this.refreshTimers.has(app.id)) {
            clearTimeout(this.refreshTimers.get(app.id));
            logger.debug(`Cleared existing refresh timer for application "${app.name}" (${app.id})`);
        }

        // Schedule next refresh (50 minutes = 3000 seconds)
        const refreshInterval = 50 * 60 * 1000;
        const refreshTime = new Date(Date.now() + refreshInterval);

        const timer = setTimeout(async () => {
            await this.refreshApplicationToken(app.id);
            // Reschedule next refresh for this application
            this.scheduleRefreshForApplication(app);
        }, refreshInterval);

        this.refreshTimers.set(app.id, timer);
        logger.info(`Token refresh scheduled for application "${app.name}" (${app.id}) at ${refreshTime.toISOString()}`);
    }

    /**
     * Refresh token for a specific application
     * Can be called manually or by the automatic refresh scheduler
     * @param applicationId The ID of the application to refresh
     */
    async refreshApplicationToken(applicationId: string): Promise<void> {
        const manager = this.authManagers.get(applicationId);
        let app = this.applications.get(applicationId);

        if (!manager || !app) {
            logger.error(`Cannot refresh token for application ${applicationId}: manager or app not found`);
            return;
        }

        logger.debug(`Starting automatic token refresh for application "${app.name}" (${applicationId})`);

        try {
            await manager.refreshAccessToken();
            this.errorTracker.recordSuccess(ApiCallType.REFRESH_TOKEN);
            updateApplicationReadyStatus(app, true);
            const refreshedApp = this.refreshApplicationSnapshot(applicationId, app.ready);
            if (refreshedApp) {
                app = refreshedApp;
            }
            logger.info(`Token refreshed successfully for application "${app.name}" (${applicationId}). Valid until: ${new Date(Date.now() + 3600000).toISOString()}`);

            // Notify UI of status change
            this.notifyApplicationStatusChange(applicationId, app);
        } catch (error: any) {
            const errorMetadata = this.errorTracker.recordError(ApiCallType.REFRESH_TOKEN, error);
            logger.error(`Failed to refresh token for application "${app.name}" (${applicationId}): ${error.message}`);
            updateApplicationReadyStatus(app, false);
            const refreshedApp = this.refreshApplicationSnapshot(applicationId, app.ready);
            if (refreshedApp) {
                app = refreshedApp;
            }

            // Log detailed error information for debugging
            if (error.code) {
                logger.debug(`Error code: ${error.code}`);
            }
            if (error.response?.data) {
                logger.debug(`Error details: ${JSON.stringify(error.response.data)}`);
            }

            const { eventManager } = firebot.modules;
            eventManager.triggerEvent(
                IntegrationConstants.INTEGRATION_ID,
                "api-error",
                errorMetadata as unknown as Record<string, unknown>
            );

            // Notify UI of status change
            this.notifyApplicationStatusChange(applicationId, app);
        }
    }

    /**
     * Get current applications with their ready status
     * @returns Array of applications with current ready status
     */
    getApplications(): YouTubeOAuthApplication[] {
        return Array.from(this.applications.values());
    }

    /**
     * Update applications and reinitialize managers
     * @param applications New applications list
     */
    async updateApplications(applications: YouTubeOAuthApplication[]): Promise<void> {
        await this.initialize(applications);
    }

    private refreshApplicationSnapshot(applicationId: string, readyOverride?: boolean): YouTubeOAuthApplication | null {
        const persistedApp = this.applicationManager.getApplication(applicationId);
        if (!persistedApp) {
            return null;
        }

        const updatedApp: YouTubeOAuthApplication = {
            ...persistedApp,
            ready: readyOverride ?? persistedApp.ready
        };

        this.applications.set(applicationId, updatedApp);
        return updatedApp;
    }

    /**
     * Check if an application can connect (has refresh token)
     * @param applicationId The ID of the application
     * @returns true if application can connect
     */
    canConnect(applicationId: string): boolean {
        const manager = this.authManagers.get(applicationId);
        return manager ? manager.canConnect() : false;
    }

    /**
     * Get the redirect URI for OAuth callbacks
     */
    private getRedirectUri(): string {
        // This will need to be updated to support multiple applications
        // For now, use the existing endpoint
        return `http://localhost:7472/integrations/mage-youtube-integration/auth/callback`;
    }

    /**
     * Get YouTube OAuth scopes
     */
    private getYouTubeScopes(): string[] {
        return [
            'https://www.googleapis.com/auth/youtube',
            'https://www.googleapis.com/auth/youtube.force-ssl',
            'https://www.googleapis.com/auth/userinfo.email'
        ];
    }

    /**
     * Clear all refresh timers
     */
    private clearAllTimers(): void {
        for (const [appId, timer] of this.refreshTimers) {
            clearTimeout(timer);
            logger.debug(`Cleared refresh timer for application ${appId}`);
        }
        this.refreshTimers.clear();
    }

    /**
     * Clear authorization for a specific application
     * Removes the auth manager and clears refresh timers
     * @param applicationId The ID of the application
     */
    clearApplicationAuth(applicationId: string): void {
        // Remove auth manager
        this.authManagers.delete(applicationId);

        // Clear refresh timer
        if (this.refreshTimers.has(applicationId)) {
            clearTimeout(this.refreshTimers.get(applicationId));
            this.refreshTimers.delete(applicationId);
        }

        logger.debug(`Cleared authorization for application ${applicationId}`);
    }

    /**
     * Notify integration about application status change
     */
    private notifyApplicationStatusChange(applicationId: string, app: YouTubeOAuthApplication): void {
        try {
            const { integration } = require("../integration-singleton");
            if (integration && integration.notifyApplicationStatusChange) {
                integration.notifyApplicationStatusChange(applicationId, app);
            }
        } catch (error: any) {
            logger.error(`Failed to notify application status change: ${error.message}`);
        }
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.clearAllTimers();
        this.authManagers.clear();
        this.applications.clear();
        logger.debug("MultiAuthManager destroyed");
    }
}

/**
 * ApplicationAuthManager handles OAuth for a single application
 *
 * Uses hybrid storage model:
 * - Access tokens are cached in memory for performance
 * - Refresh tokens are read from ApplicationManager (disk-backed) on every use
 */
class ApplicationAuthManager {
    private applicationId: string;
    private applicationManager: ApplicationManager;
    private accessToken = "";
    private tokenExpiresAt = 0;

    constructor(application: YouTubeOAuthApplication, applicationManager: ApplicationManager) {
        this.applicationId = application.id;
        this.applicationManager = applicationManager;
    }

    /**
     * Set tokens from OAuth callback
     * Writes refresh token directly to disk, caches access token in memory
     */
    async setTokens(tokens: any, userEmail?: string): Promise<void> {
        // Cache access token in memory for performance
        this.accessToken = tokens.access_token || "";
        this.tokenExpiresAt = tokens.expiry_date || Date.now() + 3600000; // Default 1 hour

        // Write refresh token and metadata directly to disk
        const updates: any = {
            refreshToken: tokens.refresh_token || "",
            tokenExpiresAt: this.tokenExpiresAt,
            ready: true
        };

        if (userEmail !== undefined) {
            updates.email = userEmail;
        }

        await this.applicationManager.updateApplication(this.applicationId, updates);
    }

    /**
     * Check if we can connect (have a refresh token)
     * Reads from ApplicationManager to get current state
     */
    canConnect(): boolean {
        const application = this.applicationManager.getApplication(this.applicationId);
        return !!(application && application.refreshToken);
    }

    /**
     * Get a valid access token (refresh if needed)
     */
    async getAccessToken(): Promise<string> {
        if (!this.accessToken || this.tokenExpiresAt <= Date.now()) {
            await this.refreshAccessToken();
        }

        return this.accessToken;
    }

    /**
     * Refresh the access token
     * Reads refresh token from disk, writes rotated token back to disk
     */
    async refreshAccessToken(): Promise<void> {
        // Read application from disk to get current refresh token
        const application = this.applicationManager.getApplication(this.applicationId);
        if (!application) {
            throw new Error(`Application ${this.applicationId} not found`);
        }

        if (!application.refreshToken) {
            throw new Error("No refresh token available");
        }

        const oauth2Client = new OAuth2Client(
            application.clientId,
            application.clientSecret
        );

        oauth2Client.setCredentials({
            // eslint-disable-next-line camelcase
            refresh_token: application.refreshToken
        });

        try {
            const oldRefreshToken = application.refreshToken;
            const { credentials } = await oauth2Client.refreshAccessToken();

            // Log the full refresh response payload (with partial redaction for security)
            const redactedAccessToken = credentials.access_token
                ? `${credentials.access_token.substring(0, 4)}...${credentials.access_token.substring(credentials.access_token.length - 4)}`
                : undefined;
            const redactedRefreshToken = credentials.refresh_token
                ? `${credentials.refresh_token.substring(0, 4)}...${credentials.refresh_token.substring(credentials.refresh_token.length - 4)}`
                : undefined;
            logger.debug(
                `Token refresh response for application ${this.applicationId}: ` +
                `access_token=${redactedAccessToken || 'missing'}, ` +
                `refresh_token=${redactedRefreshToken || 'not rotated'}, ` +
                `expiry_date=${credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'not set'}, ` +
                `token_type=${credentials.token_type || 'not set'}, ` +
                `scope=${credentials.scope || 'not set'}`
            );

            // Cache access token in memory for performance
            this.accessToken = credentials.access_token || "";
            this.tokenExpiresAt = credentials.expiry_date || Date.now() + 3600000; // Default 1 hour

            // If Google rotated the refresh token, persist the new one to disk
            const newRefreshToken = credentials.refresh_token || oldRefreshToken;
            const tokenChanged = newRefreshToken !== oldRefreshToken;

            // Always update token expiration; update refresh token only if it changed
            await this.applicationManager.updateApplication(this.applicationId, {
                refreshToken: newRefreshToken,
                tokenExpiresAt: this.tokenExpiresAt
            });

            logger.debug(
                `Access token refreshed for application ${this.applicationId}. ` +
                `Valid until: ${new Date(this.tokenExpiresAt).toISOString()}${
                    tokenChanged ? ' (refresh token rotated)' : ''}`
            );
        } catch (error: any) {
            // Check if refresh token is invalid
            if (error.message?.includes('invalid_grant') || error.code === 401) {
                // Clear the invalid refresh token from disk
                await this.applicationManager.updateApplication(this.applicationId, {
                    refreshToken: ""
                });
                logger.error(`Refresh token invalid for application ${this.applicationId}`);
                throw new Error("Refresh token is invalid. Please re-authorize.");
            }

            logger.error(`Error refreshing access token for application ${this.applicationId}: ${error.message}`);
            throw error;
        }
    }
}
