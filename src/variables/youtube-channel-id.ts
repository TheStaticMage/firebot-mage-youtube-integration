import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration-singleton";

export const youtubeChannelIdVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeChannelId",
        description: "The broadcaster's YouTube channel ID when a stream is live",
        categories: ["common"],
        possibleDataOutput: ["text"],
        examples: [
            {
                usage: "youtubeChannelId",
                description: "Returns the broadcaster's channel ID (e.g., 'UCrDkAvwXgOFDjlW9wqyYeIQ')"
            }
        ]
    },
    evaluator: (_trigger: Trigger) => {
        return integration.getCurrentChannelId() ?? "";
    }
};
