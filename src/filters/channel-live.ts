import { EventData, EventFilter, FilterEvent, FilterSettings, PresetValue } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration-singleton";
import { logger } from "../main";

export enum ComparisonType {
    IS = "is"
}

const applicableEvents: FilterEvent[] = [
    {
        eventSourceId: IntegrationConstants.INTEGRATION_ID,
        eventId: "chat-message"
    },
    {
        eventSourceId: IntegrationConstants.INTEGRATION_ID,
        eventId: "viewer-arrived"
    },
    {
        eventSourceId: IntegrationConstants.INTEGRATION_ID,
        eventId: "application-activated"
    },
    {
        eventSourceId: IntegrationConstants.INTEGRATION_ID,
        eventId: "api-error"
    }
];

export const channelLiveFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:channel-live`,
    name: "YouTube Channel is Live",
    description: "Filter by whether or not YouTube channel is live",
    events: applicableEvents,
    comparisonTypes: [
        ComparisonType.IS
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
    presetValues: () : PresetValue[] => {
        return [
            { value: "true", display: "True" },
            { value: "false", display: "False" }
        ];
    },
    predicate: async (
        filterSettings,
        _eventData: EventData
    ): Promise<boolean> => {
        const { value } = filterSettings;

        const isLive = integration.isLive();
        logger.debug(`channelLiveFilter: isLive=${isLive}, value=${value}`);

        return isLive.toString() === value;
    }
};
