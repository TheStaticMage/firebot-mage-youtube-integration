/**
 * Error Type filter for YouTube API errors
 *
 * Allows filtering YouTube API Error events by error category
 */

import { EventFilter } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";

export enum ComparisonType {
    IS = "is",
    IS_NOT = "is not"
}

export const errorTypeFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:error-type`,
    name: "Error Category",
    description: "Filter YouTube API errors by their category",
    events: [
        {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: "api-error"
        }
    ],
    comparisonTypes: [ComparisonType.IS, ComparisonType.IS_NOT],
    valueType: "preset",
    getSelectedValueDisplay: (filterSettings: any) => {
        return filterSettings.value as string;
    },
    valueIsStillValid: () => true,
    presetValues: () : { value: string; display: string }[] => {
        // These need to be kept in sync with ErrorCategory enum in error-constants.ts
        enum ErrorCategory {
            UNAUTHENTICATED = "Unauthenticated",
            QUOTA_EXCEEDED = "QuotaExceeded",
            PERMISSION_DENIED = "PermissionDenied",
            NOT_FOUND = "NotFound",
            INVALID_REQUEST = "InvalidRequest",
            NETWORK_ERROR = "NetworkError",
            UNKNOWN = "Unknown"
        };

        return Object.entries(ErrorCategory).map(([, value]) => ({
            value: value as string,
            display: value as string
        }));
    },
    predicate: async (filterSettings: any, eventData: any): Promise<boolean> => {
        const { comparisonType, value } = filterSettings;
        const errorCategory = eventData.eventMeta.errorCategory as string;
        const matches = errorCategory === value;
        return comparisonType === ComparisonType.IS ? matches : !matches;
    }
};
