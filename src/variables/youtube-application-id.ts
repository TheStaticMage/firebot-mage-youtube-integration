import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration-singleton";

export const youtubeApplicationIdVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeApplicationId",
        description: "The UUID of the active YouTube application",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger: Trigger) => {
        if (trigger.metadata.eventData?.applicationId) {
            return trigger.metadata.eventData.applicationId;
        }
        return integration.getApplicationManager().getActiveApplication()?.id ?? "";
    }
};
