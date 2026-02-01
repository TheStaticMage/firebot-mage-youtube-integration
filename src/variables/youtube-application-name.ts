import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration-singleton";

export const youtubeApplicationNameVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeApplicationName",
        description: "The name of a YouTube application (supports 'trigger', 'current', or specific UUID parameter)",
        usage: "youtubeApplicationName",
        examples: [
            {
                usage: "youtubeApplicationName",
                description: "Gets the name from trigger event, or falls back to current application"
            },
            {
                usage: "youtubeApplicationName[trigger]",
                description: "Gets the name from the trigger event metadata"
            },
            {
                usage: "youtubeApplicationName[current]",
                description: "Gets the name of the currently active application"
            },
            {
                usage: "youtubeApplicationName[12345678-1234-1234-1234-123456789012]",
                description: "Gets the name of the application with the specified UUID"
            }
        ],
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger: Trigger, param?: string) => {
        const appManager = integration.getApplicationManager();

        // Handle explicit parameter
        if (param) {
            if (param === "trigger") {
                // Return from event metadata
                return trigger.metadata.eventData?.applicationName ?? null;
            }
            if (param === "current") {
                // Return current active application name
                return appManager.getActiveApplication()?.name ?? null;
            }
            // Assume it's a UUID
            const app = appManager.getApplication(param);
            return app?.name ?? null;
        }

        // Default behavior: trigger -> current -> null
        const triggerValue = trigger.metadata.eventData?.applicationName;
        if (triggerValue) {
            return triggerValue;
        }

        return appManager.getActiveApplication()?.name ?? null;
    }
};
