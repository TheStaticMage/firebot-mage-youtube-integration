/**
 * Error tracking service for YouTube API integration
 *
 * Tracks consecutive failures per API call type and categorizes errors
 * to provide detailed error information for events and filtering.
 */

import { ErrorCategory, ApiCallType } from "./error-constants";

/**
 * Metadata about a tracked error
 */
interface ErrorMetadata {
    apiCall: ApiCallType;
    errorCategory: ErrorCategory;
    errorMessage: string;
    consecutiveFailures: number;
}

/**
 * Tracks consecutive errors and provides error categorization
 *
 * Maintains a counter of consecutive failures per API call type,
 * resets on success, and categorizes errors based on their content.
 */
export class ErrorTracker {
    private consecutiveFailuresMap = new Map<ApiCallType, number>();

    constructor() {
        // Initialize all API call types with 0 failures
        Object.values(ApiCallType).forEach((apiCall) => {
            this.consecutiveFailuresMap.set(apiCall, 0);
        });
    }

    /**
     * Record an error and return metadata for event triggering
     *
     * @param apiCall The type of API call that failed
     * @param error The error object/message
     * @returns Metadata object to pass to event trigger
     */
    recordError(apiCall: ApiCallType, error: any): ErrorMetadata {
        const currentCount = this.consecutiveFailuresMap.get(apiCall) ?? 0;
        const newCount = currentCount + 1;
        this.consecutiveFailuresMap.set(apiCall, newCount);

        const errorMessage = this.extractErrorMessage(error);
        const errorCategory = this.categorizeError(error, errorMessage);

        return {
            apiCall,
            errorCategory,
            errorMessage,
            consecutiveFailures: newCount
        };
    }

    /**
     * Record a successful API call and reset failure counter
     *
     * @param apiCall The type of API call that succeeded
     */
    recordSuccess(apiCall: ApiCallType): void {
        this.consecutiveFailuresMap.set(apiCall, 0);
    }

    /**
     * Get current consecutive failure count for an API call type
     *
     * @param apiCall The type of API call
     * @returns Number of consecutive failures
     */
    getConsecutiveFailures(apiCall: ApiCallType): number {
        return this.consecutiveFailuresMap.get(apiCall) ?? 0;
    }

    /**
     * Extract a readable error message from an error object
     *
     * Handles various error formats (Error objects, gRPC errors, etc.)
     *
     * @param error The error to extract message from
     * @returns The error message string
     */
    private extractErrorMessage(error: any): string {
        if (typeof error === "string") {
            return error;
        }

        if (error instanceof Error) {
            return error.message;
        }

        if (error?.details) {
            return error.details;
        }

        if (error?.message) {
            return error.message;
        }

        return JSON.stringify(error);
    }

    /**
     * Categorize an error based on error code or message content
     *
     * Matches known error patterns to categorize errors flexibly.
     * Defaults to UNKNOWN if no pattern matches.
     *
     * @param error The error object
     * @param errorMessage The error message string
     * @returns The categorized ErrorCategory
     */
    private categorizeError(error: any, errorMessage: string): ErrorCategory {
        const message = errorMessage.toLowerCase();

        // Check for UNAUTHENTICATED
        if (
            message.includes("unauthenticated") ||
            message.includes("invalid authentication") ||
            message.includes("access token") ||
            error?.code === 16 ||
            error?.status === 401 ||
            error?.response?.status === 401
        ) {
            return ErrorCategory.UNAUTHENTICATED;
        }

        // Check for QUOTA_EXCEEDED
        if (
            message.includes("quota") ||
            message.includes("rate limit") ||
            error?.code === 8 ||
            error?.status === 429 ||
            error?.response?.status === 429
        ) {
            return ErrorCategory.QUOTA_EXCEEDED;
        }

        // Check for PERMISSION_DENIED
        if (
            message.includes("permission") ||
            message.includes("forbidden") ||
            error?.code === 7 ||
            error?.status === 403 ||
            error?.response?.status === 403
        ) {
            return ErrorCategory.PERMISSION_DENIED;
        }

        // Check for NOT_FOUND
        if (
            message.includes("not found") ||
            message.includes("does not exist") ||
            error?.code === 5 ||
            error?.status === 404 ||
            error?.response?.status === 404
        ) {
            return ErrorCategory.NOT_FOUND;
        }

        // Check for INVALID_REQUEST
        if (
            message.includes("invalid") ||
            message.includes("malformed") ||
            error?.code === 3 ||
            error?.status === 400 ||
            error?.response?.status === 400
        ) {
            return ErrorCategory.INVALID_REQUEST;
        }

        // Check for NETWORK_ERROR
        if (
            message.includes("timeout") ||
            message.includes("econnrefused") ||
            message.includes("enotfound") ||
            message.includes("network") ||
            error?.code === 14
        ) {
            return ErrorCategory.NETWORK_ERROR;
        }

        return ErrorCategory.UNKNOWN;
    }
}
