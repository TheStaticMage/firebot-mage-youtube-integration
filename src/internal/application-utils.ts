import { YouTubeOAuthApplication } from "../types";

/**
 * Utility functions for YouTube OAuth application management
 */

/**
 * Calculate if an application is ready based on token validity
 *
 * @param app The YouTube OAuth application to check
 * @returns true if the application has a valid refresh token and is considered ready
 */
export function isApplicationReady(app: YouTubeOAuthApplication): boolean {
    // Application is ready if it has a refresh token
    // The actual token validity will be determined during refresh attempts
    return !!app.refreshToken && app.ready;
}

/**
 * Update application ready status based on token refresh result
 *
 * @param app The application to update
 * @param refreshSuccess Whether the token refresh was successful
 */
export function updateApplicationReadyStatus(
    app: YouTubeOAuthApplication,
    refreshSuccess: boolean
): void {
    app.ready = refreshSuccess;
}

/**
 * Generate a human-readable status message for an application
 *
 * @param app The application to generate status for
 * @returns Human-readable status string
 */
export function getApplicationStatusMessage(app: YouTubeOAuthApplication): string {
    if (!app.refreshToken) {
        return "Authorization required";
    }

    if (app.ready && app.tokenExpiresAt) {
        // Format token expiration time in YYYY-MM-DD HH:mm:ss format (24-hour)
        const expiresAt = new Date(app.tokenExpiresAt);
        const year = expiresAt.getFullYear();
        const month = String(expiresAt.getMonth() + 1).padStart(2, "0");
        const day = String(expiresAt.getDate()).padStart(2, "0");
        const hours = String(expiresAt.getHours()).padStart(2, "0");
        const minutes = String(expiresAt.getMinutes()).padStart(2, "0");
        const seconds = String(expiresAt.getSeconds()).padStart(2, "0");
        const dateTimeStr = `${year}-${month}-${day} at ${hours}:${minutes}:${seconds}`;
        return `Ready - Token expires ${dateTimeStr}`;
    }

    if (app.ready) {
        return "Ready";
    }

    if (app.refreshToken) {
        return "Awaiting connection";
    }

    return "Not ready";
}

/**
 * Validate application configuration
 *
 * @param app The application to validate
 * @returns true if the application has valid configuration
 */
export function validateApplication(app: YouTubeOAuthApplication): boolean {
    return !!(app.id &&
             app.name &&
             app.clientId &&
             app.clientSecret &&
             app.quotaSettings);
}

/**
 * Create a new YouTube OAuth application with default values
 *
 * @param id Unique identifier for the application
 * @param name Display name for the application
 * @returns New YouTube OAuth application with default settings
 */
export function createApplication(id: string, name: string): YouTubeOAuthApplication {
    return {
        id,
        name,
        clientId: "",
        clientSecret: "",
        refreshToken: "",
        quotaSettings: {
            dailyQuota: 10000,
            maxStreamHours: 8,
            overridePollingDelay: false,
            customPollingDelaySeconds: -1
        },
        ready: false
    };
}
