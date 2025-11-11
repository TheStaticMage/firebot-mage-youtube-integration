import { YouTubeOAuthApplication } from "../types";
import { logger } from "../main";
import { OAuth2Client } from "google-auth-library";
import { updateApplicationReadyStatus } from "./application-utils";

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
    private authManagers = new Map<string, ApplicationAuthManager>();
    private refreshTimers = new Map<string, NodeJS.Timeout>();
    private applications = new Map<string, YouTubeOAuthApplication>();

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
                const manager = new ApplicationAuthManager(app);
                this.authManagers.set(app.id, manager);

                // Schedule refresh for this application (automatic background refresh every ~50 minutes)
                this.scheduleRefreshForApplication(app);
                authorizedCount++;
                logger.debug(`Application "${app.name}" (${app.id}) - scheduled for background token refresh`);
            } else {
                // Application without refresh token is not ready
                updateApplicationReadyStatus(app, false, "Authorization required");
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
                updateApplicationReadyStatus(app, false, error.message);
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
    async handleAuthCallback(req: any, res: any): Promise<void> {
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

        const app = this.applications.get(applicationId);
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

            // Update application with new tokens
            app.refreshToken = tokens.refresh_token;
            app.ready = true;

            // Create or update auth manager
            const manager = new ApplicationAuthManager(app);
            manager.setTokens(tokens);
            this.authManagers.set(applicationId, manager);

            // Schedule refresh for this application
            this.scheduleRefreshForApplication(app);

            logger.info(`Application ${applicationId} authorized successfully`);

            res.status(200).send(
                `<p>YouTube application "${app.name}" authorized! You can close this tab.</p>`
            );

        } catch (error: any) {
            logger.error(`Failed to exchange code for tokens for application ${applicationId}: ${error.message}`);
            updateApplicationReadyStatus(app, false, error.message);
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
        const app = this.applications.get(applicationId);

        if (!manager || !app) {
            logger.error(`Cannot refresh token for application ${applicationId}: manager or app not found`);
            return;
        }

        logger.debug(`Starting automatic token refresh for application "${app.name}" (${applicationId})`);

        try {
            await manager.refreshAccessToken();
            updateApplicationReadyStatus(app, true);
            logger.info(`Token refreshed successfully for application "${app.name}" (${applicationId}). Valid until: ${new Date(Date.now() + 3600000).toISOString()}`);

            // Notify UI of status change
            this.notifyApplicationStatusChange(applicationId, app);
        } catch (error: any) {
            logger.error(`Failed to refresh token for application "${app.name}" (${applicationId}): ${error.message}`);
            updateApplicationReadyStatus(app, false, error.message);

            // Log detailed error information for debugging
            if (error.code) {
                logger.debug(`Error code: ${error.code}`);
            }
            if (error.response?.data) {
                logger.debug(`Error details: ${JSON.stringify(error.response.data)}`);
            }

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
            'https://www.googleapis.com/auth/youtube.force-ssl'
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
 */
class ApplicationAuthManager {
    private application: YouTubeOAuthApplication;
    private accessToken = "";
    private tokenExpiresAt = 0;

    constructor(application: YouTubeOAuthApplication) {
        this.application = application;
    }

    /**
     * Set tokens from OAuth callback
     */
    setTokens(tokens: any): void {
        this.accessToken = tokens.access_token || "";
        this.application.refreshToken = tokens.refresh_token || this.application.refreshToken;
        this.tokenExpiresAt = tokens.expiry_date || Date.now() + 3600000; // Default 1 hour
        this.application.tokenExpiresAt = this.tokenExpiresAt;
    }

    /**
     * Check if we can connect (have a refresh token)
     */
    canConnect(): boolean {
        return !!this.application.refreshToken;
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
     */
    async refreshAccessToken(): Promise<void> {
        if (!this.application.refreshToken) {
            throw new Error("No refresh token available");
        }

        const oauth2Client = new OAuth2Client(
            this.application.clientId,
            this.application.clientSecret
        );

        oauth2Client.setCredentials({
            // eslint-disable-next-line camelcase
            refresh_token: this.application.refreshToken
        });

        try {
            const { credentials } = await oauth2Client.refreshAccessToken();

            this.accessToken = credentials.access_token || "";

            // Google may return a new refresh token
            if (credentials.refresh_token) {
                this.application.refreshToken = credentials.refresh_token;
            }

            this.tokenExpiresAt = credentials.expiry_date || Date.now() + 3600000; // Default 1 hour
            this.application.tokenExpiresAt = this.tokenExpiresAt;

            logger.debug(`Access token refreshed for application ${this.application.id}. Valid until: ${new Date(this.tokenExpiresAt).toISOString()}`);
        } catch (error: any) {
            // Check if refresh token is invalid
            if (error.message?.includes('invalid_grant') || error.code === 401) {
                this.application.refreshToken = "";
                logger.error(`Refresh token invalid for application ${this.application.id}`);
                throw new Error("Refresh token is invalid. Please re-authorize.");
            }

            logger.error(`Error refreshing access token for application ${this.application.id}: ${error.message}`);
            throw error;
        }
    }
}
