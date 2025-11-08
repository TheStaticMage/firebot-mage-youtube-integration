import { IntegrationConstants } from "../constants";
import { integration } from "../integration-singleton";
import { logger } from "../main";
import { OAuth2Client } from "google-auth-library";

/**
 * AuthManager handles YouTube OAuth 2.0 authentication
 *
 * Responsibilities:
 * - Generate authorization URLs for OAuth flow
 * - Exchange authorization codes for tokens
 * - Refresh access tokens using refresh tokens
 * - Store refresh tokens persistently
 * - Provide valid access tokens to API calls
 */
export class AuthManager {
    private authRenewer: NodeJS.Timeout | null = null;
    private accessToken = "";
    private refreshToken = "";
    private tokenExpiresAt = 0;

    /**
     * Initialize with existing refresh token from storage
     */
    init(refreshToken: string) {
        this.refreshToken = refreshToken;
    }

    /**
     * Check if we can connect (have a refresh token)
     */
    canConnect(): boolean {
        return !!this.refreshToken;
    }

    /**
     * Connect: Refresh the access token
     */
    async connect(): Promise<void> {
        if (!this.canConnect()) {
            throw new Error("Cannot connect YouTube integration: No refresh token available.");
        }

        logger.debug("Auth manager connecting...");
        try {
            const tokenRenewal = await this.refreshAccessToken();
            if (!tokenRenewal) {
                logger.error("Failed to refresh YouTube access token");
                throw new Error("Failed to refresh YouTube access token");
            }
        } catch (error) {
            this.disconnect();
            logger.error(`Failed to refresh YouTube token: ${error}`);
            throw error;
        }

        logger.info("Auth manager connected.");
    }

    /**
     * Disconnect: Clear tokens and cancel renewal timer
     */
    disconnect(): void {
        logger.debug("Auth manager disconnecting...");
        if (this.authRenewer) {
            clearTimeout(this.authRenewer);
            this.authRenewer = null;
        }
        this.accessToken = "";
        logger.info("Auth manager disconnected.");
    }

    /**
     * Get a valid access token (refresh if needed)
     */
    async getAccessToken(): Promise<string> {
        if (!this.accessToken) {
            if (this.refreshToken) {
                await this.refreshAccessTokenReal();
            } else {
                integration.sendCriticalErrorNotification(
                    `YouTube refresh token is missing. You need to re-authorize in Settings > Integrations > ${IntegrationConstants.INTEGRATION_NAME}.`
                );
                return "";
            }
        }

        if (this.accessToken && this.tokenExpiresAt > Date.now()) {
            return this.accessToken;
        }

        if (this.accessToken) {
            logger.warn("getAccessToken(): Access token expired and has not yet been renewed");
            return "";
        }

        // If we reach this point, token is not available
        logger.error("getAccessToken(): Access token was never generated");
        return "";
    }

    /**
     * Get the authorization URL for OAuth flow
     *
     * This redirects the user to Google's OAuth consent screen
     */
    getAuthorizationUrl(): string {
        const settings = integration.getSettings();
        if (!settings.googleApp.clientId) {
            throw new Error("YouTube OAuth client ID is not configured in settings.");
        }

        const redirectUri = this.getRedirectUri();

        const oauth2Client = new OAuth2Client(
            settings.googleApp.clientId,
            settings.googleApp.clientSecret,
            redirectUri
        );

        const authUrl = oauth2Client.generateAuthUrl({
            // eslint-disable-next-line camelcase
            access_type: 'offline',
            scope: [...IntegrationConstants.YOUTUBE_SCOPES],
            prompt: 'consent' // Force consent to get refresh token
        });

        logger.debug(`Generated YouTube authorization URL: ${authUrl}`);
        return authUrl;
    }

    /**
     * Get the redirect URI for OAuth callbacks
     */
    private getRedirectUri(): string {
        // Firebot HTTP server endpoint
        return `http://localhost:7472/integrations/${IntegrationConstants.INTEGRATION_ID}/auth/callback`;
    }

    /**
     * Handle the OAuth callback from Google
     *
     * Exchange the authorization code for tokens
     */
    async handleAuthCallback(req: any, res: any): Promise<void> {
        const { code } = req.query;
        if (!code) {
            logger.error("Missing 'code' in OAuth callback.");
            res.status(400).send("Missing 'code' in callback.");
            return;
        }

        logger.info("handleAuthCallback received authorization code");

        const settings = integration.getSettings();
        const redirectUri = this.getRedirectUri();

        const oauth2Client = new OAuth2Client(
            settings.googleApp.clientId,
            settings.googleApp.clientSecret,
            redirectUri
        );

        try {
            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code);

            if (!tokens.refresh_token) {
                logger.error("No refresh token received from Google. User may have previously authorized.");
                res.status(400).send(
                    `<p>Error: No refresh token received.</p><p>This can happen if you previously authorized this app. Try <a href="${this.getAuthorizationUrl()}">authorizing again</a> in an incognito window.</p>`
                );
                return;
            }

            // Store tokens
            this.accessToken = tokens.access_token || "";
            this.refreshToken = tokens.refresh_token;
            this.tokenExpiresAt = tokens.expiry_date || Date.now() + 3600000; // Default 1 hour

            // Save refresh token to storage
            integration.saveIntegrationTokenData({ refreshToken: this.refreshToken });
            logger.info(`YouTube access token obtained. Valid until: ${new Date(this.tokenExpiresAt).toISOString()}`);

            // Reconnect integration with new tokens
            integration.disconnect();
            integration.connect();

            logger.info("YouTube integration authorized successfully!");
            res.status(200).send(
                `<p>YouTube integration authorized! You can close this tab.</p><p>(Be sure to save the integration settings in Firebot if you have that window open.)</p>`
            );
        } catch (error: any) {
            logger.error(`Failed to exchange code for tokens: ${error.message}`);
            res.status(500).send(`<p>Failed to exchange code for tokens: ${error.message}</p>`);
        }
    }

    /**
     * Handle the /link/streamer endpoint
     *
     * Redirects user to Google OAuth consent screen
     */
    async handleLinkCallback(req: any, res: any): Promise<void> {
        try {
            const authUrl = this.getAuthorizationUrl();
            logger.debug(`Redirecting user to authorization URL: ${authUrl}`);
            res.redirect(authUrl);
        } catch (error: any) {
            logger.error(`Error handling link callback: ${error.message}`);
            res.status(500).send(`Error handling link callback: ${error.message}`);
        }
    }

    /**
     * Refresh the access token (wrapper with auto-renewal scheduling)
     */
    private async refreshAccessToken(): Promise<boolean> {
        try {
            await this.refreshAccessTokenReal();
            // Schedule next renewal 5 minutes before expiration
            this.scheduleNextTokenRenewal(this.tokenExpiresAt - Date.now() - 300000);
            return true;
        } catch (error: any) {
            logger.error(`Error refreshing access token: ${error.message}`);

            if (!this.refreshToken) {
                logger.error("Refresh token is missing. Disconnecting integration.");
                this.disconnect();
                integration.sendCriticalErrorNotification(
                    `You need to authorize YouTube in Settings > Integrations > ${IntegrationConstants.INTEGRATION_NAME}.`
                );
            } else {
                // Try again in 10 seconds if there's an error
                this.scheduleNextTokenRenewal(10000);
            }
        }
        return false;
    }

    /**
     * Refresh the access token (actual implementation)
     */
    private async refreshAccessTokenReal(): Promise<void> {
        const settings = integration.getSettings();

        const oauth2Client = new OAuth2Client(
            settings.googleApp.clientId,
            settings.googleApp.clientSecret,
            this.getRedirectUri()
        );

        oauth2Client.setCredentials({
            // eslint-disable-next-line camelcase
            refresh_token: this.refreshToken
        });

        try {
            const { credentials } = await oauth2Client.refreshAccessToken();

            this.accessToken = credentials.access_token || "";
            // Google may return a new refresh token
            if (credentials.refresh_token) {
                this.refreshToken = credentials.refresh_token;
            }
            this.tokenExpiresAt = credentials.expiry_date || Date.now() + 3600000; // Default 1 hour

            logger.info(`YouTube access token refreshed. Valid until: ${new Date(this.tokenExpiresAt).toISOString()}`);
        } catch (error: any) {
            // Check if refresh token is invalid
            if (error.message?.includes('invalid_grant') || error.code === 401) {
                integration.sendCriticalErrorNotification(
                    `YouTube refresh token is invalid. Please re-authorize in Settings > Integrations > ${IntegrationConstants.INTEGRATION_NAME}.`
                );
                this.refreshToken = "";
                logger.error("YouTube refresh token is invalid. Please re-authorize.");
                return;
            }

            logger.error(`Error refreshing access token: ${error.message}`);
            throw error;
        } finally {
            // Always save the refresh token (may have been updated)
            integration.saveIntegrationTokenData({ refreshToken: this.refreshToken });
        }
    }

    /**
     * Schedule the next token renewal
     */
    private scheduleNextTokenRenewal(delay: number): void {
        if (this.authRenewer) {
            clearTimeout(this.authRenewer);
        }
        this.authRenewer = setTimeout(async () => {
            try {
                await this.refreshAccessToken();
            } catch (error: any) {
                logger.error(`Uncaught error in scheduled token renewal: ${error.message}`);
            }
        }, delay);
        logger.debug(`Next auth token renewal scheduled at ${new Date(Date.now() + delay).toISOString()}.`);
    }

    /**
     * Revoke the refresh token (unlink account)
     */
    async revokeToken(): Promise<void> {
        if (!this.refreshToken) {
            logger.warn("No refresh token to revoke");
            return;
        }

        const settings = integration.getSettings();

        const oauth2Client = new OAuth2Client(
            settings.googleApp.clientId,
            settings.googleApp.clientSecret,
            this.getRedirectUri()
        );

        try {
            await oauth2Client.revokeToken(this.refreshToken);
            logger.info("YouTube refresh token revoked successfully");
        } catch (error: any) {
            logger.error(`Failed to revoke YouTube token: ${error.message}`);
            // Continue anyway to clear local token
        }

        this.refreshToken = "";
        this.accessToken = "";
        integration.saveIntegrationTokenData({ refreshToken: "" });
    }
}
