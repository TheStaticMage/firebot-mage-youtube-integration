import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration-singleton";

export const youtubeApplicationNameVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeApplicationName",
        description: "The name of the active YouTube application, or the application with the given UUID if provided",
        usage: "youtubeApplicationName",
        examples: [
            {
                usage: "youtubeApplicationName",
                description: "Gets the name of the currently active YouTube application."
            },
            {
                usage: "youtubeApplicationName[12345678-1234-1234-1234-123456789012]",
                description: "Gets the name of the YouTube application with the specified UUID."
            }
        ],
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger: Trigger, applicationId?: string) => {
        const applicationManager = integration.getApplicationManager();

        if (applicationId) {
            const app = applicationManager.getApplication(applicationId);
            return app?.name ?? "";
        }

        if (trigger.metadata.eventData?.applicationName) {
            return trigger.metadata.eventData.applicationName;
        }

        return applicationManager.getActiveApplication()?.name ?? "";
    }
};
