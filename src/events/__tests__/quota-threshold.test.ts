/**
 * Unit tests for quota threshold crossed event trigger
 */

import { IntegrationConstants } from "../../constants";
import { triggerQuotaThresholdCrossed } from "../quota-threshold";
import { firebot } from "../../main";

jest.mock("../../main", () => ({
    firebot: {
        modules: {
            eventManager: {
                triggerEvent: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn()
    }
}));

describe("Quota threshold event trigger", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("triggerQuotaThresholdCrossed", () => {
        it("should call eventManager.triggerEvent with correct parameters", () => {
            const eventData = {
                applicationId: "test-app-id",
                applicationName: "Test Application",
                quotaConsumed: 102,
                quotaLimit: 10000,
                threshold: 1
            };

            triggerQuotaThresholdCrossed(eventData);

            const mockEventManager = firebot.modules.eventManager;
            expect(mockEventManager.triggerEvent).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "quota-threshold-crossed",
                eventData
            );
        });

        it("should handle threshold 50 correctly", () => {
            const eventData = {
                applicationId: "another-app",
                applicationName: "Another Application",
                quotaConsumed: 5000,
                quotaLimit: 10000,
                threshold: 50
            };

            triggerQuotaThresholdCrossed(eventData);

            const mockEventManager = firebot.modules.eventManager;
            expect(mockEventManager.triggerEvent).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "quota-threshold-crossed",
                eventData
            );
        });

        it("should handle threshold 100 correctly", () => {
            const eventData = {
                applicationId: "high-usage-app",
                applicationName: "High Usage Application",
                quotaConsumed: 10000,
                quotaLimit: 10000,
                threshold: 100
            };

            triggerQuotaThresholdCrossed(eventData);

            const mockEventManager = firebot.modules.eventManager;
            expect(mockEventManager.triggerEvent).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "quota-threshold-crossed",
                eventData
            );
        });
    });
});
