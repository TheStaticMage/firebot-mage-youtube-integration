import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { youtubeIntegrationConnectedVariable } from "../youtube-integration-connected";

jest.mock("../../integration-singleton", () => ({
    integration: {
        connected: false
    }
}));

import { integration } from "../../integration-singleton";

describe("youtubeIntegrationConnectedVariable.evaluator", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const makeTrigger = (eventData?: any): Trigger => ({
        type: "event",
        metadata: {
            username: "testuser",
            eventData
        }
    } as Trigger);

    it("returns connected status from eventData when present and true", () => {
        const trigger = makeTrigger({
            connected: true
        });

        const result = youtubeIntegrationConnectedVariable.evaluator(trigger);
        expect(result).toBe(true);
    });

    it("returns connected status from eventData when present and false", () => {
        const trigger = makeTrigger({
            connected: false
        });

        const result = youtubeIntegrationConnectedVariable.evaluator(trigger);
        expect(result).toBe(false);
    });

    it("falls back to integration.connected when eventData is missing", () => {
        const trigger = makeTrigger(undefined);
        (integration as any).connected = true;

        const result = youtubeIntegrationConnectedVariable.evaluator(trigger);
        expect(result).toBe(true);
    });

    it("falls back to integration.connected when eventData.connected is undefined", () => {
        const trigger = makeTrigger({
            applicationId: "app-id-123"
        });
        (integration as any).connected = false;

        const result = youtubeIntegrationConnectedVariable.evaluator(trigger);
        expect(result).toBe(false);
    });

    it("prefers eventData over integration.connected", () => {
        const trigger = makeTrigger({
            connected: true
        });
        (integration as any).connected = false;

        const result = youtubeIntegrationConnectedVariable.evaluator(trigger);
        expect(result).toBe(true);
    });

    it("handles eventData.connected being false even when integration is connected", () => {
        const trigger = makeTrigger({
            connected: false
        });
        (integration as any).connected = true;

        const result = youtubeIntegrationConnectedVariable.evaluator(trigger);
        expect(result).toBe(false);
    });

    it("returns integration.connected when eventData.connected is explicitly undefined", () => {
        const trigger = makeTrigger({
            connected: undefined,
            applicationId: "test-id"
        });
        (integration as any).connected = true;

        const result = youtubeIntegrationConnectedVariable.evaluator(trigger);
        expect(result).toBe(true);
    });
});
