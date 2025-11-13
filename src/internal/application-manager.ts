import { randomUUID } from "crypto";
import { firebot, logger } from "../main";
import { ApplicationStorage, QuotaSettings, YouTubeOAuthApplication } from "../types";
import { getDataFilePath } from "../util/datafile";
import {
    createApplication,
    isApplicationReady,
    updateApplicationReadyStatus,
    validateApplication
} from "./application-utils";

/**
 * ApplicationManager handles YouTube OAuth application storage and management
 *
 * Responsibilities:
 * - CRUD operations for applications
 * - Ready status management and validation
 * - Application validation (duplicate names, credentials)
 * - Active application management
 * - Persistent storage management
 */
export class ApplicationManager {
    private storage: ApplicationStorage = {
        applications: {},
        activeApplicationId: null
    };
    private dataFilePath = "";
    private initialized = false;

    /**
     * Initialize the data file path (synchronous)
     * This must be called before using the manager, typically in init()
     */
    initPath(): void {
        if (!this.dataFilePath) {
            this.dataFilePath = getDataFilePath("applications.json");
        }
    }

    /**
     * Initialize the ApplicationManager
     * Loads applications from storage and validates ready status
     */
    async initialize(): Promise<void> {
        this.initPath();
        await this.loadApplications();
        await this.validateAllApplications();
        this.initialized = true;
        logger.info(`ApplicationManager initialized with ${Object.keys(this.storage.applications).length} applications`);
    }

    /**
     * Get all applications
     * @returns Map of all applications by ID
     */
    getApplications(): Record<string, YouTubeOAuthApplication> {
        return { ...this.storage.applications };
    }

    /**
     * Get application by ID
     * @param id Application ID
     * @returns Application or null if not found
     */
    getApplication(id: string): YouTubeOAuthApplication | null {
        return this.storage.applications[id] || null;
    }

    /**
     * Get active application
     * @returns Active application or null if none is active
     */
    getActiveApplication(): YouTubeOAuthApplication | null {
        if (!this.storage.activeApplicationId) {
            return null;
        }
        return this.getApplication(this.storage.activeApplicationId);
    }

    /**
     * Get ready applications (filtered by ready status)
     * @returns Map of ready applications by ID
     */
    getReadyApplications(): Record<string, YouTubeOAuthApplication> {
        const appsMap = this.getApplications();
        const readyAppsMap: Record<string, YouTubeOAuthApplication> = {};
        for (const [id, app] of Object.entries(appsMap)) {
            if (isApplicationReady(app)) {
                readyAppsMap[id] = app;
            }
        }
        return readyAppsMap;
    }

    /**
     * Add a new application
     * @param name Application display name
     * @param clientId OAuth client ID
     * @param clientSecret OAuth client secret
     * @param quotaSettings Quota settings for the application
     * @returns Created application
     * @throws Error if validation fails
     */
    async addApplication(
        name: string,
        clientId: string,
        clientSecret: string,
        quotaSettings?: QuotaSettings
    ): Promise<YouTubeOAuthApplication> {
        // Validate input
        if (!name || !name.trim()) {
            throw new Error("Application name is required");
        }

        if (!clientId || !clientId.trim()) {
            throw new Error("Client ID is required");
        }

        if (!clientSecret || !clientSecret.trim()) {
            throw new Error("Client secret is required");
        }

        // Check for duplicate names
        // This is to avoid confusing the user
        const trimmedName = name.trim();
        const existingApp = Object.values(this.getApplications()).find(app =>
            app.name.toLowerCase() === trimmedName.toLowerCase()
        );

        if (existingApp) {
            throw new Error(`Application with name "${trimmedName}" already exists`);
        }

        // Check for duplicate client ID
        // This is because quota is per application and the calculations will be
        // incorrect if multiple applications share the same client ID
        const trimmedClientId = clientId.trim();
        const duplicateClientId = Object.values(this.getApplications()).find(app =>
            app.clientId === trimmedClientId
        );

        if (duplicateClientId) {
            throw new Error(`An application with the same client ID already exists`);
        }

        // Create new application
        const newApp = createApplication(randomUUID(), name.trim());
        newApp.clientId = clientId.trim();
        newApp.clientSecret = clientSecret.trim();

        if (quotaSettings) {
            newApp.quotaSettings = { ...quotaSettings };
        }

        // Validate the complete application
        if (!validateApplication(newApp)) {
            throw new Error("Invalid application configuration");
        }

        // Add to storage
        this.storage.applications[newApp.id] = newApp;
        await this.saveApplications();

        logger.info(`Added new YouTube application: ${newApp.name} (${newApp.id})`);
        return newApp;
    }

    /**
     * Update an existing application
     * @param id Application ID
     * @param updates Partial application updates
     * @returns Updated application
     * @throws Error if application not found or validation fails
     */
    async updateApplication(id: string, updates: Partial<YouTubeOAuthApplication>): Promise<YouTubeOAuthApplication> {
        const existingApp = this.getApplication(id);
        if (!existingApp) {
            throw new Error(`Application with ID "${id}" not found`);
        }

        // Check for duplicate names if name is being updated
        if (updates.name && updates.name !== existingApp.name) {
            const trimmedName = updates.name.trim();
            const duplicateApp = Object.values(this.getApplications()).find(app =>
                app.id !== id && app.name.toLowerCase() === trimmedName.toLowerCase()
            );

            if (duplicateApp) {
                throw new Error(`Application with name "${trimmedName}" already exists`);
            }
        }

        // Apply updates
        const updatedApp: YouTubeOAuthApplication = {
            ...existingApp,
            ...updates
        };

        // Trim string fields
        if (updates.name) {
            updatedApp.name = updates.name.trim();
        }
        if (updates.clientId) {
            updatedApp.clientId = updates.clientId.trim();
        }
        if (updates.clientSecret) {
            updatedApp.clientSecret = updates.clientSecret.trim();
        }

        // Check for duplicate client ID if credentials are being updated
        if (updates.clientId) {
            const clientIdToCheck = updatedApp.clientId;
            const duplicateClientId = Object.values(this.getApplications()).find(app =>
                app.id !== id && app.clientId === clientIdToCheck
            );

            if (duplicateClientId) {
                throw new Error(`An application with the same client ID already exists`);
            }
        }

        // Validate the updated application
        if (!validateApplication(updatedApp)) {
            throw new Error("Invalid application configuration");
        }

        // Update storage
        this.storage.applications[id] = updatedApp;
        await this.saveApplications();

        logger.info(`Updated YouTube application: ${updatedApp.name} (${updatedApp.id})`);
        return updatedApp;
    }

    /**
     * Remove an application
     * @param id Application ID to remove
     * @throws Error if application not found
     */
    async removeApplication(id: string): Promise<void> {
        const app = this.getApplication(id);
        if (!app) {
            throw new Error(`Application with ID "${id}" not found`);
        }

        // Clear active application if this was the active one
        if (this.storage.activeApplicationId === id) {
            this.storage.activeApplicationId = null;
            logger.info(`Cleared active application (removed app ${app.name})`);
        }

        // Remove from storage
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: removedApp, ...remainingApps } = this.storage.applications;
        this.storage.applications = remainingApps;
        await this.saveApplications();

        logger.info(`Removed YouTube application: ${app.name} (${id})`);
    }

    /**
     * Set active application
     * @param id Application ID to set as active
     * @throws Error if application not found or not ready
     */
    async setActiveApplication(id: string): Promise<void> {
        const app = this.getApplication(id);
        if (!app) {
            throw new Error(`Application with ID "${id}" not found`);
        }

        // Allow setting active if app has a refresh token (it will be refreshed on connect)
        // Only require ready status if we're actually trying to use it immediately
        if (!app.refreshToken) {
            throw new Error(`Application "${app.name}" is not authorized. Please authorize it first.`);
        }

        const previousActiveId = this.storage.activeApplicationId;
        this.storage.activeApplicationId = id;
        await this.saveApplications();

        logger.info(`Set active application: ${app.name} (${id})${previousActiveId ? ` (previously: ${previousActiveId})` : ""}`);
    }

    /**
     * Clear active application
     */
    async clearActiveApplication(): Promise<void> {
        if (this.storage.activeApplicationId) {
            const activeApp = this.getActiveApplication();
            logger.info(`Cleared active application: ${activeApp?.name} (${this.storage.activeApplicationId})`);
            this.storage.activeApplicationId = null;
            await this.saveApplications();
        }
    }


    /**
     * Update application ready status
     * @param id Application ID
     * @param ready Ready status
     * @param status Optional status message
     */
    async updateApplicationReadyStatus(id: string, ready: boolean, status?: string): Promise<void> {
        const app = this.getApplication(id);
        if (!app) {
            logger.warn(`Attempted to update ready status for non-existent application: ${id}`);
            return;
        }

        updateApplicationReadyStatus(app, ready);
        this.storage.applications[id] = app;
        await this.saveApplications();

        // Clear active application if it became not ready
        if (this.storage.activeApplicationId === id && !ready) {
            this.storage.activeApplicationId = null;
            await this.saveApplications();
            logger.warn(`Cleared active application ${app.name} because it is no longer ready`);
        }

        logger.debug(`Updated ready status for ${app.name}: ${ready}${status ? ` - ${status}` : ""}`);

        // Notify UI of status change
        this.notifyApplicationStatusChange(id, app);
    }

    /**
     * Mark all applications as not ready
     * Called when integration disconnects
     */
    async markAllApplicationsNotReady(): Promise<void> {
        let changed = false;
        for (const app of Object.values(this.storage.applications)) {
            if (app.ready) {
                updateApplicationReadyStatus(app, false);
                this.storage.applications[app.id] = app;
                changed = true;
                logger.debug(`Marked application "${app.name}" as not ready`);
            }
        }

        if (changed) {
            await this.saveApplications();
        }
    }

    /**
     * Validate all applications and update ready status
     * Ready status is determined by authorization (presence of refresh token), not integration connection
     */
    async validateAllApplications(): Promise<void> {
        for (const app of Object.values(this.getApplications())) {
            // Ready status is determined by whether the application is authorized (has refresh token)
            // This persists across sessions and integration connections
            if (!app.refreshToken) {
                updateApplicationReadyStatus(app, false);
                logger.debug(`Application "${app.name}" is not ready: no refresh token`);
            } else {
                updateApplicationReadyStatus(app, true);
                logger.debug(`Application "${app.name}" is ready: authorized with refresh token`);
            }

            this.storage.applications[app.id] = app;
        }

        // Clear tokenExpiresAt on startup - it will be recomputed after token refresh
        for (const app of Object.values(this.storage.applications)) {
            app.tokenExpiresAt = undefined;
        }

        await this.saveApplications();
    }

    /**
     * Get application storage (for external access)
     * @returns Complete application storage
     */
    getStorage(): ApplicationStorage {
        return { ...this.storage };
    }

    /**
     * Load applications from file
     */
    private async loadApplications(): Promise<void> {
        try {
            const { fs } = firebot.modules;

            if (!fs.existsSync(this.dataFilePath)) {
                logger.debug("No applications data file found, starting with empty storage");
                this.storage = {
                    applications: {},
                    activeApplicationId: null
                };
                return;
            }

            try {
                const data = fs.readFileSync(this.dataFilePath, "utf8");
                const parsed = JSON.parse(data) as ApplicationStorage;

                // Validate loaded data
                if (!parsed.applications || typeof parsed.applications !== "object") {
                    throw new Error("Invalid applications data format");
                }

                this.storage = {
                    applications: parsed.applications || {},
                    activeApplicationId: parsed.activeApplicationId || null
                };

                logger.debug(`Loaded ${Object.keys(this.storage.applications).length} applications from storage`);
            } catch (error: any) {
                logger.error(`Failed to load applications data: ${error.message}`);
                this.storage = {
                    applications: {},
                    activeApplicationId: null
                };
            }
        } catch (error: any) {
            logger.error(`Failed to load applications data: ${error.message}`);
            this.storage = {
                applications: {},
                activeApplicationId: null
            };
        }
    }

    /**
     * Save applications to file
     */
    private async saveApplications(): Promise<void> {
        try {
            const { fs } = firebot.modules;

            // Create a clean copy for storage (exclude transient state)
            const storageToSave: ApplicationStorage = {
                applications: {},
                activeApplicationId: this.storage.activeApplicationId
            };

            // Copy applications without transient state (ready status is computed, not persisted)
            for (const [id, app] of Object.entries(this.storage.applications)) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { ready, ...appWithoutReady } = app;
                storageToSave.applications[id] = {
                    ...appWithoutReady,
                    ready: false // Placeholder for compatibility - will be recomputed on load
                } as YouTubeOAuthApplication;
            }

            logger.debug(`Saving ${Object.keys(storageToSave.applications).length} applications to storage "${this.dataFilePath}"`);
            fs.writeFileSync(this.dataFilePath, JSON.stringify(storageToSave, null, 2));
            logger.debug("Applications data saved successfully");
        } catch (error: any) {
            logger.error(`Failed to save applications data: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get statistics about applications
     * @returns Application statistics
     */
    getStatistics(): {
        total: number;
        ready: number;
        notReady: number;
        hasActive: boolean;
    } {
        const apps = Object.values(this.getApplications());
        const readyApps = apps.filter(app => isApplicationReady(app));

        return {
            total: apps.length,
            ready: readyApps.length,
            notReady: apps.length - readyApps.length,
            hasActive: !!this.storage.activeApplicationId
        };
    }

    /**
     * Notify integration about application status change
     */
    private notifyApplicationStatusChange(id: string, app: YouTubeOAuthApplication): void {
        try {
            const { integration } = require("../integration-singleton");
            if (integration && integration.notifyApplicationStatusChange) {
                integration.notifyApplicationStatusChange(id, app);
            }
        } catch (error: any) {
            logger.error(`Failed to notify application status change: ${error.message}`);
        }
    }
}
