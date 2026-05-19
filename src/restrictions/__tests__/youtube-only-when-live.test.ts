import { integration } from "../../integration-singleton";
import { youtubeOnlyWhenLiveRestriction } from "../youtube-only-when-live";

jest.mock("../../integration-singleton", () => ({
    integration: {
        isLive: jest.fn(() => false)
    }
}));

describe("youtubeOnlyWhenLiveRestriction", () => {
    it("should pass when stream is live", async () => {
        (integration.isLive as jest.Mock).mockReturnValue(true);

        const result = await youtubeOnlyWhenLiveRestriction.predicate({} as any, undefined);
        expect(result).toBe(true);
    });

    it("should reject when stream is not live", async () => {
        (integration.isLive as jest.Mock).mockReturnValue(false);

        await expect(youtubeOnlyWhenLiveRestriction.predicate({} as any, undefined)).rejects.toBe("YouTube stream is not live.");
    });
});
