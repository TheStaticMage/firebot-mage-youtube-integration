/**
 * Consecutive Errors filter for YouTube API errors
 *
 * Allows filtering YouTube API Error events by the number of consecutive failures
 */

import { EventFilter } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";

export enum ComparisonType {
    EQUALS = "equals",
    GREATER_THAN = "greater than",
    LESS_THAN = "less than"
}

export const consecutiveErrorsFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:consecutive-errors`,
    name: "Consecutive Errors",
    description: "Filter YouTube API errors by the number of consecutive failures",
    events: [
        {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: "api-error"
        }
    ],
    comparisonTypes: [ComparisonType.EQUALS, ComparisonType.GREATER_THAN, ComparisonType.LESS_THAN],
    valueType: "number",
    getSelectedValueDisplay: (filterSettings) => {
        const count = filterSettings.value;
        return `${count}`;
    },
    valueIsStillValid: () => true,
    predicate: async (filterSettings, eventData): Promise<boolean> => {
        const { comparisonType, value } = filterSettings;
        const consecutiveFailures = eventData.eventMeta.consecutiveFailures as number;
        const threshold = Number(value);

        switch (comparisonType as ComparisonType) {
            case ComparisonType.EQUALS:
                return consecutiveFailures === threshold;
            case ComparisonType.GREATER_THAN:
                return consecutiveFailures > threshold;
            case ComparisonType.LESS_THAN:
                return consecutiveFailures < threshold;
            default:
                return false;
        }
    }
};
