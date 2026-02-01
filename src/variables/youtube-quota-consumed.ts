import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration-singleton";

export const youtubeQuotaConsumedVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeQuotaConsumed",
        description: "The quota units consumed (supports 'trigger', 'current', or specific UUID parameter)",
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger: Trigger, param?: string) => {
        const appManager = integration.getApplicationManager();
        const quotaManager = integration.getQuotaManager();

        // Handle explicit parameter
        if (param) {
            if (param === "trigger") {
                // Return from event metadata
                const value = trigger.metadata.eventData?.quotaConsumed;
                return value !== undefined ? value : null;
            }
            if (param === "current") {
                // Return quota for current active application
                const currentApp = appManager.getActiveApplication();
                if (!currentApp?.id) {
                    return null;
                }
                const usage = quotaManager.getQuotaUsage(currentApp.id);
                return usage?.quotaUnitsUsed ?? 0;
            }
            // Assume it's a UUID - look up quota for that application
            const usage = quotaManager.getQuotaUsage(param);
            return usage?.quotaUnitsUsed ?? 0;
        }

        // Default behavior: trigger -> current -> null
        const triggerValue = trigger.metadata.eventData?.quotaConsumed;
        if (triggerValue !== undefined) {
            return triggerValue;
        }

        // Fall back to current application
        const currentApp = appManager.getActiveApplication();
        if (!currentApp?.id) {
            return null;
        }
        const usage = quotaManager.getQuotaUsage(currentApp.id);
        return usage?.quotaUnitsUsed ?? 0;
    }
};
