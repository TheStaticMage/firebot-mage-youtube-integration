import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";

export const youtubePreviousApplicationIdVariable: ReplaceVariable = {
    definition: {
        handle: "youtubePreviousApplicationId",
        description: "The ID of the previous active YouTube application (from Automatic Failover event)",
        triggers: {
            event: ["mage-youtube-integration:quota-failover"]
        },
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger: Trigger) => {
        return trigger.metadata.eventData?.previousApplicationId ?? "";
    }
};