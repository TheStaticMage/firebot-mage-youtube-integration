import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration-singleton";

export const youtubeLiveChatIdVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeLiveChatId",
        description: "The current YouTube live chat ID when a stream is live",
        categories: ["common"],
        possibleDataOutput: ["text"],
        examples: [
            {
                usage: "youtubeLiveChatId",
                description: "Returns the live chat ID (e.g., 'KjQqz1AmIbw.1234567890123456')"
            }
        ]
    },
    evaluator: (_trigger: Trigger) => {
        return integration.getCurrentLiveChatId() ?? "";
    }
};
