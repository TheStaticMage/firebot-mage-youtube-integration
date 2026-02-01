import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration-singleton";

export const youtubeQuotaLimitVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeQuotaLimit",
        description: "The daily quota limit (supports 'trigger', 'current', or specific UUID parameter)",
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger: Trigger, param?: string) => {
        const appManager = integration.getApplicationManager();

        // Helper function to get dailyQuota from application
        const getDailyQuota = (app: any): number | null => {
            const dailyQuota = app?.quotaSettings?.dailyQuota;
            return dailyQuota !== undefined ? dailyQuota : null;
        };

        // Handle explicit parameter
        if (param) {
            if (param === "trigger") {
                // Return from event metadata
                const value = trigger.metadata.eventData?.quotaLimit;
                return value !== undefined ? value : null;
            }
            if (param === "current") {
                // Return dailyQuota for current active application
                const currentApp = appManager.getActiveApplication();
                if (!currentApp) {
                    return null;
                }
                return getDailyQuota(currentApp);
            }
            // Assume it's a UUID - look up that application
            const app = appManager.getApplication(param);
            return app ? getDailyQuota(app) : null;
        }

        // Default behavior: trigger -> current -> null
        const triggerValue = trigger.metadata.eventData?.quotaLimit;
        if (triggerValue !== undefined) {
            return triggerValue;
        }

        // Fall back to current application
        const currentApp = appManager.getActiveApplication();
        return currentApp ? getDailyQuota(currentApp) : null;
    }
};
