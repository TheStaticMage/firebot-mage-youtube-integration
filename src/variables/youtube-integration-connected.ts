import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration-singleton";

export const youtubeIntegrationConnectedVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeIntegrationConnected",
        description: "Whether the YouTube integration is currently connected",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger: Trigger) => {
        if (trigger.metadata.eventData?.connected !== undefined) {
            return trigger.metadata.eventData.connected;
        }
        return integration.connected;
    }
};
