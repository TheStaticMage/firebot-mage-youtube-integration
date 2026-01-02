import type { RestrictionType } from "@crowbartools/firebot-custom-scripts-types/types/restrictions";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration-singleton";

const restriction: RestrictionType<unknown> = {
    definition: {
        id: `${IntegrationConstants.INTEGRATION_ID}:only-when-live`,
        name: "YouTube: Only When Live",
        description: "Limit usage to when you are live on YouTube."
    },
    optionsTemplate: `
        <div>
            <p>Usage will be restricted to when you are live on YouTube.</p>
        </div>
    `,
    predicate: async () => {
        return new Promise((resolve, reject) => {
            if (!integration.isLive()) {
                reject("YouTube stream is not live.");
                return;
            }

            resolve(true);
        });
    }
};

export = restriction;
