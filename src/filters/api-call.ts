/**
 * API Call filter for YouTube API errors
 *
 * Allows filtering YouTube API Error events by which API endpoint failed
 */

import { EventFilter } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";

export enum ComparisonType {
    IS = "is",
    IS_NOT = "is not"
}

export const apiCallFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:api-call`,
    name: "API Call Type",
    description: "Filter YouTube API errors by which API endpoint failed",
    events: [
        {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: "api-error"
        }
    ],
    comparisonTypes: [ComparisonType.IS, ComparisonType.IS_NOT],
    valueType: "preset",
    getSelectedValueDisplay: (filterSettings) => {
        return filterSettings.value as string;
    },
    valueIsStillValid: () => true,
    presetValues: () : { value: string; display: string }[] => {
        // These need to be kept in sync with ApiCallType enum in error-constants.ts
        enum ApiCallType {
            SEND_CHAT_MESSAGE = "SendChatMessage",
            GET_LIVE_BROADCASTS = "GetLiveBroadcasts",
            STREAM_CHAT_MESSAGES = "StreamChatMessages",
            REFRESH_TOKEN = "RefreshToken"
        }

        return Object.entries(ApiCallType).map(([, value]) => ({
            value: value as string,
            display: value as string
        }));
    },
    predicate: async (filterSettings, eventData): Promise<boolean> => {
        const { comparisonType, value } = filterSettings;
        const apiCall = eventData.eventMeta.apiCall as string;
        const matches = apiCall === value;
        return (comparisonType as ComparisonType) === ComparisonType.IS ? matches : !matches;
    }
};
