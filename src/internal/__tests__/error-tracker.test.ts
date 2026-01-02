import { ErrorTracker } from "../error-tracker";
import { ErrorCategory, ApiCallType } from "../error-constants";

describe("ErrorTracker", () => {
    let errorTracker: ErrorTracker;

    beforeEach(() => {
        errorTracker = new ErrorTracker();
    });

    describe("recordError", () => {
        it("should increment failure count on error", () => {
            const metadata1 = errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, new Error("Test error"));
            expect(metadata1.consecutiveFailures).toBe(1);

            const metadata2 = errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, new Error("Test error"));
            expect(metadata2.consecutiveFailures).toBe(2);
        });

        it("should categorize UNAUTHENTICATED errors", () => {
            const error = new Error("16 UNAUTHENTICATED: Request had invalid authentication credentials.");
            const metadata = errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, error);
            expect(metadata.errorCategory).toBe(ErrorCategory.UNAUTHENTICATED);
        });

        it("should categorize QUOTA_EXCEEDED errors", () => {
            const error = new Error("8 RESOURCE_EXHAUSTED: Quota exceeded");
            const metadata = errorTracker.recordError(ApiCallType.STREAM_CHAT_MESSAGES, error);
            expect(metadata.errorCategory).toBe(ErrorCategory.QUOTA_EXCEEDED);
        });

        it("should categorize PERMISSION_DENIED errors", () => {
            const error = new Error("7 PERMISSION_DENIED: Permission denied");
            const metadata = errorTracker.recordError(ApiCallType.GET_LIVE_BROADCASTS, error);
            expect(metadata.errorCategory).toBe(ErrorCategory.PERMISSION_DENIED);
        });

        it("should categorize NOT_FOUND errors", () => {
            const error = new Error("5 NOT_FOUND: Not found");
            const metadata = errorTracker.recordError(ApiCallType.GET_LIVE_BROADCASTS, error);
            expect(metadata.errorCategory).toBe(ErrorCategory.NOT_FOUND);
        });

        it("should categorize NETWORK_ERROR errors", () => {
            const error = new Error("ECONNREFUSED: Connection refused");
            const metadata = errorTracker.recordError(ApiCallType.STREAM_CHAT_MESSAGES, error);
            expect(metadata.errorCategory).toBe(ErrorCategory.NETWORK_ERROR);
        });

        it("should categorize unknown errors as UNKNOWN", () => {
            const error = new Error("Some other error");
            const metadata = errorTracker.recordError(ApiCallType.REFRESH_TOKEN, error);
            expect(metadata.errorCategory).toBe(ErrorCategory.UNKNOWN);
        });

        it("should return error message in metadata", () => {
            const errorMessage = "Test error message";
            const error = new Error(errorMessage);
            const metadata = errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, error);
            expect(metadata.errorMessage).toBe(errorMessage);
        });

        it("should return API call type in metadata", () => {
            const error = new Error("Test error");
            const metadata = errorTracker.recordError(ApiCallType.GET_LIVE_BROADCASTS, error);
            expect(metadata.apiCall).toBe(ApiCallType.GET_LIVE_BROADCASTS);
        });
    });

    describe("recordSuccess", () => {
        it("should reset failure counter to 0", () => {
            errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, new Error("Error 1"));
            errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, new Error("Error 2"));
            errorTracker.recordSuccess(ApiCallType.SEND_CHAT_MESSAGE);
            expect(errorTracker.getConsecutiveFailures(ApiCallType.SEND_CHAT_MESSAGE)).toBe(0);
        });

        it("should not affect other API call types", () => {
            errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, new Error("Error 1"));
            errorTracker.recordError(ApiCallType.GET_LIVE_BROADCASTS, new Error("Error 1"));
            errorTracker.recordSuccess(ApiCallType.SEND_CHAT_MESSAGE);

            expect(errorTracker.getConsecutiveFailures(ApiCallType.SEND_CHAT_MESSAGE)).toBe(0);
            expect(errorTracker.getConsecutiveFailures(ApiCallType.GET_LIVE_BROADCASTS)).toBe(1);
        });
    });

    describe("getConsecutiveFailures", () => {
        it("should return 0 for new API call types", () => {
            expect(errorTracker.getConsecutiveFailures(ApiCallType.SEND_CHAT_MESSAGE)).toBe(0);
        });

        it("should return current failure count", () => {
            errorTracker.recordError(ApiCallType.STREAM_CHAT_MESSAGES, new Error("Error 1"));
            errorTracker.recordError(ApiCallType.STREAM_CHAT_MESSAGES, new Error("Error 2"));
            errorTracker.recordError(ApiCallType.STREAM_CHAT_MESSAGES, new Error("Error 3"));
            expect(errorTracker.getConsecutiveFailures(ApiCallType.STREAM_CHAT_MESSAGES)).toBe(3);
        });
    });

    describe("error categorization edge cases", () => {
        it("should handle error objects with code property", () => {
            const error = { code: 16, message: "Some error" };
            const metadata = errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, error);
            expect(metadata.errorCategory).toBe(ErrorCategory.UNAUTHENTICATED);
        });

        it("should handle error objects with status property", () => {
            const error = { status: 401, message: "Unauthorized" };
            const metadata = errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, error);
            expect(metadata.errorCategory).toBe(ErrorCategory.UNAUTHENTICATED);
        });

        it("should handle string errors", () => {
            const metadata = errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, "Invalid request error");
            expect(metadata.errorCategory).toBe(ErrorCategory.INVALID_REQUEST);
            expect(metadata.errorMessage).toBe("Invalid request error");
        });

        it("should handle timeout errors", () => {
            const error = new Error("Request timeout after 30000ms");
            const metadata = errorTracker.recordError(ApiCallType.STREAM_CHAT_MESSAGES, error);
            expect(metadata.errorCategory).toBe(ErrorCategory.NETWORK_ERROR);
        });

        it("should be case-insensitive for error categorization", () => {
            const error = new Error("UNAUTHENTICATED: Something happened");
            const metadata = errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, error);
            expect(metadata.errorCategory).toBe(ErrorCategory.UNAUTHENTICATED);
        });
    });

    describe("per-API-call-type tracking", () => {
        it("should track failures independently per API call type", () => {
            errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, new Error("Error"));
            errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, new Error("Error"));

            errorTracker.recordError(ApiCallType.GET_LIVE_BROADCASTS, new Error("Error"));

            expect(errorTracker.getConsecutiveFailures(ApiCallType.SEND_CHAT_MESSAGE)).toBe(2);
            expect(errorTracker.getConsecutiveFailures(ApiCallType.GET_LIVE_BROADCASTS)).toBe(1);
            expect(errorTracker.getConsecutiveFailures(ApiCallType.STREAM_CHAT_MESSAGES)).toBe(0);
            expect(errorTracker.getConsecutiveFailures(ApiCallType.REFRESH_TOKEN)).toBe(0);
        });

        it("should reset only the specified API call type", () => {
            errorTracker.recordError(ApiCallType.SEND_CHAT_MESSAGE, new Error("Error"));
            errorTracker.recordError(ApiCallType.GET_LIVE_BROADCASTS, new Error("Error"));
            errorTracker.recordError(ApiCallType.STREAM_CHAT_MESSAGES, new Error("Error"));

            errorTracker.recordSuccess(ApiCallType.GET_LIVE_BROADCASTS);

            expect(errorTracker.getConsecutiveFailures(ApiCallType.SEND_CHAT_MESSAGE)).toBe(1);
            expect(errorTracker.getConsecutiveFailures(ApiCallType.GET_LIVE_BROADCASTS)).toBe(0);
            expect(errorTracker.getConsecutiveFailures(ApiCallType.STREAM_CHAT_MESSAGES)).toBe(1);
        });
    });
});
