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
        logger.debug(`Initializing MultiAuthManager with ${applications.length} applications`);

        // Clear existing timers and managers
        this.clearAllTimers();
        this.authManagers.clear();
        this.applications.clear();

        // Create managers and schedule refresh for each application
        for (const app of applications) {
            this.applications.set(app.id, app);

            if (app.refreshToken) {
                const manager = new ApplicationAuthManager(app);
                this.authManagers.set(app.id, manager);

                // Schedule refresh for this application
                this.scheduleRefreshForApplication(app);
            } else {
                // Application without refresh token is not ready
                updateApplicationReadyStatus(app, false, "Authorization required");
            }
        }

        logger.info(`MultiAuthManager initialized with ${this.authManagers.size} applications having refresh tokens`);
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
            app.status = "Ready";

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
        }

        // Schedule next refresh (50 minutes)
        const timer = setTimeout(async () => {
            await this.refreshApplicationToken(app.id);
            // Reschedule next refresh
            this.scheduleRefreshForApplication(app);
        }, 50 * 60 * 1000); // 50 minutes

        this.refreshTimers.set(app.id, timer);
        logger.debug(`Token refresh scheduled for application ${app.id} at ${new Date(Date.now() + 50 * 60 * 1000).toISOString()}`);
    }

    /**
     * Refresh token for a specific application
     * @param applicationId The ID of the application to refresh
     */
    async refreshApplicationToken(applicationId: string): Promise<void> {
        const manager = this.authManagers.get(applicationId);
        const app = this.applications.get(applicationId);

        if (!manager || !app) {
            logger.error(`Cannot refresh token for application ${applicationId}: manager or app not found`);
            return;
        }

        try {
            await manager.refreshAccessToken();
            updateApplicationReadyStatus(app, true);
            logger.debug(`Token refreshed successfully for application ${applicationId}`);
        } catch (error: any) {
            logger.error(`Failed to refresh token for application ${applicationId}: ${error.message}`);
            updateApplicationReadyStatus(app, false, error.message);
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
