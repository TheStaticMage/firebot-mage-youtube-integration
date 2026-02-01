import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration-singleton";

export const youtubeApplicationIdVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeApplicationId",
        description: "The UUID of a YouTube application (supports 'trigger', 'current', or no parameter for trigger -> current fallback)",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger: Trigger, param?: string) => {
        const appManager = integration.getApplicationManager();

        // Handle explicit parameter
        if (param) {
            if (param === "trigger") {
                // Return from event metadata
                return trigger.metadata.eventData?.applicationId ?? null;
            }
            if (param === "current") {
                // Return current active application ID
                return appManager.getActiveApplication()?.id ?? null;
            }
            // Unknown parameter - return null
            return null;
        }

        // Default behavior: trigger -> current -> null
        const triggerValue = trigger.metadata.eventData?.applicationId;
        if (triggerValue) {
            return triggerValue;
        }

        return appManager.getActiveApplication()?.id ?? null;
    }
};
