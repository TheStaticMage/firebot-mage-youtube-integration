import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration-singleton";

export const youtubeVideoIdVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeVideoId",
        description: "The current YouTube video/broadcast ID when a stream is live",
        categories: ["common"],
        possibleDataOutput: ["text"],
        examples: [
            {
                usage: "youtubeVideoId",
                description: "Returns the current video ID (e.g., 'KjQqz1AmIbw')"
            }
        ]
    },
    evaluator: (_trigger: Trigger) => {
        return integration.getCurrentBroadcastId() ?? "";
    }
};
