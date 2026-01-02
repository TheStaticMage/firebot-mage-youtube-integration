/**
 * YouTube Error Category replace variable
 *
 * Returns the categorized error type for the API call that failed
 */

import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger, TriggersObject } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from "../constants";

const triggers: TriggersObject = {};
triggers["event"] = [
    `${IntegrationConstants.INTEGRATION_ID}:api-error`
];
triggers["manual"] = true;

export const youtubeErrorCategoryVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeErrorCategory",
        description: "The categorized error type for the API call that just failed",
        usage: "youtubeErrorCategory",
        examples: [
            {
                usage: "youtubeErrorCategory",
                description: "Gets the error category (e.g., 'Unauthenticated', 'QuotaExceeded', 'NetworkError'). Only available during YouTube API Error events."
            }
        ],
        triggers: triggers,
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger: Trigger) => {
        const errorCategory = trigger.metadata.eventData?.errorCategory;
        if (errorCategory !== undefined) {
            return errorCategory as string;
        }
        return "";
    }
};
