/**
 * YouTube Error Consecutive Failures replace variable
 *
 * Returns the number of consecutive failures for the API call that failed
 */

import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger, TriggersObject } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from "../constants";

const triggers: TriggersObject = {};
triggers["event"] = [
    `${IntegrationConstants.INTEGRATION_ID}:api-error`
];
triggers["manual"] = true;

export const youtubeErrorConsecutiveFailuresVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeErrorConsecutiveFailures",
        description: "The number of consecutive failures for the API call that just failed",
        usage: "youtubeErrorConsecutiveFailures",
        examples: [
            {
                usage: "youtubeErrorConsecutiveFailures",
                description: "Gets the number of consecutive failures for the API endpoint that just failed. Only available during YouTube API Error events."
            }
        ],
        triggers: triggers,
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger: Trigger) => {
        const consecutiveFailures = trigger.metadata.eventData?.consecutiveFailures;
        if (consecutiveFailures !== undefined) {
            return consecutiveFailures;
        }
        return 0;
    }
};
