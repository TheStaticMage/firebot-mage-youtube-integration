import { EventData, EventFilter, FilterEvent, FilterSettings, PresetValue } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";
import { logger } from "../main";

export enum ComparisonType {
    IS = "is",
    IS_NOT = "is not"
}

const applicableEvents: FilterEvent[] = [
    {
        eventSourceId: IntegrationConstants.INTEGRATION_ID,
        eventId: "chat-message"
    },
    {
        eventSourceId: IntegrationConstants.INTEGRATION_ID,
        eventId: "viewer-arrived"
    }
];

export const streamerFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:streamer`,
    name: "Message from Streamer",
    description: "Checks if the user triggering the event is the YouTube channel owner (streamer).",
    events: applicableEvents,
    comparisonTypes: [
        ComparisonType.IS,
        ComparisonType.IS_NOT
    ],
    valueType: "preset",
    getSelectedValueDisplay: (filterSettings: FilterSettings): string => {
        const presetValues: PresetValue[] = [
            { value: "true", display: "True" },
            { value: "false", display: "False" }
        ];
        return presetValues.find(pv => pv.value === String(filterSettings.value))?.display ?? `??? (${String(filterSettings.value)})`;
    },
    valueIsStillValid: (): boolean => {
        return true;
    },
    presetValues(): PresetValue[] {
        return [
            { value: "true", display: "True" },
            { value: "false", display: "False" }
        ];
    },
    predicate: async (
        filterSettings,
        eventData: EventData
    ): Promise<boolean> => {
        const { comparisonType, value } = filterSettings;

        const roles = eventData.eventMeta.twitchUserRoles;

        if (!roles || !Array.isArray(roles)) {
            logger.debug(`streamerFilter: No roles found in event metadata`);
            return false;
        }

        if (roles.length === 0) {
            logger.debug(`streamerFilter: Empty roles array in event metadata`);
            return false;
        }

        const isBroadcaster = roles.includes("broadcaster");
        logger.debug(`streamerFilter: isBroadcaster=${isBroadcaster}, comparisonType=${comparisonType}, value=${value}`);

        const expectedValue = String(value) === "true";
        const result = (comparisonType === ComparisonType.IS as any)
            ? isBroadcaster === expectedValue
            : isBroadcaster !== expectedValue;

        return result;
    }
};
