import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { Trigger, TriggersObject } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from "../constants";

const triggers: TriggersObject = {};
triggers["event"] = [
    `${IntegrationConstants.INTEGRATION_ID}:quota-threshold-crossed`,
    `${IntegrationConstants.INTEGRATION_ID}:quota-failover`
];
triggers["manual"] = true;

export const youtubeQuotaThresholdVariable: ReplaceVariable = {
    definition: {
        handle: "youtubeQuotaThreshold",
        description: "The quota percentage threshold that was crossed (1-100)",
        categories: ["common"],
        possibleDataOutput: ["number"],
        triggers
    },
    evaluator: (trigger: Trigger) => {
        if (trigger.metadata.eventData?.threshold !== undefined) {
            return trigger.metadata.eventData.threshold;
        }
        return null;
    }
};
