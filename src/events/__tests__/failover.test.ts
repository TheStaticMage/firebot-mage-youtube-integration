import { YouTubeFailoverEvent, triggerQuotaFailover } from "../failover";
import { IntegrationConstants } from "../../constants";
import { firebot } from "../../main";

// Mock the logger and firebot modules
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

describe("triggerQuotaFailover", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should trigger the quota-failover event with correct event ID", () => {
        const eventData: YouTubeFailoverEvent = {
            previousApplicationId: "prev-app-123",
            applicationId: "new-app-456",
            applicationName: "New App",
            quotaConsumed: 2500,
            quotaLimit: 10000,
            threshold: 95
        };

        triggerQuotaFailover(eventData);

        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            "quota-failover",
            eventData as unknown as Record<string, unknown>
        );
    });

    it("should handle event data with missing optional fields", () => {
        const eventData: YouTubeFailoverEvent = {
            previousApplicationId: "prev-app-123",
            applicationId: "new-app-456",
            applicationName: "New App",
            quotaConsumed: 2500,
            quotaLimit: 10000,
            threshold: 95
        };

        triggerQuotaFailover(eventData);

        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            "quota-failover",
            eventData as unknown as Record<string, unknown>
        );
    });
});
