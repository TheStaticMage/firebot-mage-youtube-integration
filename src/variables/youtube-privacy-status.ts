import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration-singleton";

export const youtubePrivacyStatusVariable: ReplaceVariable = {
    definition: {
        handle: "youtubePrivacyStatus",
        description: "The privacy status of the current YouTube live broadcast",
        categories: ["common"],
        possibleDataOutput: ["text"],
        examples: [
            {
                usage: "youtubePrivacyStatus",
                description: "Returns 'public', 'private', 'unlisted', or empty string if unknown"
            }
        ]
    },
    evaluator: (_trigger: Trigger) => {
        return integration.getCurrentBroadcastPrivacyStatus() ?? "";
    }
};
