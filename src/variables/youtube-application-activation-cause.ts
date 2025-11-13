import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";

export const youtubeApplicationActivationCauseVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeApplicationActivationCause",
        description: "The cause of the YouTube application activation",
        triggers: {
            event: ["mage-youtube-integration:application-activated"],
            manual: true
        },
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger: Trigger) => {
        return trigger.metadata.eventData?.cause ?? "";
    }
};
