/**
 * YouTube Error Message replace variable
 *
 * Returns the full error message for the API call that failed
 * This variable is marked as sensitive
 */

import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger, TriggersObject } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from "../constants";

const triggers: TriggersObject = {};
triggers["event"] = [
    `${IntegrationConstants.INTEGRATION_ID}:api-error`
];
triggers["manual"] = true;

export const youtubeErrorMessageVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeErrorMessage",
        description: "The full error message for the API call that just failed (sensitive data)",
        usage: "youtubeErrorMessage",
        examples: [
            {
                usage: "youtubeErrorMessage",
                description: "Gets the full error message text. Only available during YouTube API Error events."
            }
        ],
        triggers: triggers,
        categories: ["common"],
        possibleDataOutput: ["text"],
        sensitive: true
    },
    evaluator: (trigger: Trigger) => {
        const errorMessage = trigger.metadata.eventData?.errorMessage;
        if (errorMessage !== undefined) {
            return errorMessage as string;
        }
        return "";
    }
};
