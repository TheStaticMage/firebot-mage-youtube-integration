/**
 * Unit tests for stream event triggers
 */

import { IntegrationConstants } from "../../constants";
import { triggerStreamOffline, triggerStreamOnline } from "../stream";
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

describe("Stream event triggers", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("triggerStreamOnline", () => {
        it("should call eventManager.triggerEvent with correct parameters", () => {
            triggerStreamOnline();

            const mockEventManager = firebot.modules.eventManager;
            expect(mockEventManager.triggerEvent).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "stream-online",
                {}
            );
        });
    });

    describe("triggerStreamOffline", () => {
        it("should call eventManager.triggerEvent with correct parameters", () => {
            triggerStreamOffline();

            const mockEventManager = firebot.modules.eventManager;
            expect(mockEventManager.triggerEvent).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "stream-offline",
                {}
            );
        });
    });
});
