import { SendChatMessageRequest } from "@thestaticmage/mage-platform-lib-client";
import { IntegrationConstants } from "../constants";
import { YouTubeIntegration } from "../integration-singleton";
import { firebot, logger } from "../main";

export function registerRoutes(youtubeIntegration: YouTubeIntegration) {
    const { httpServer } = firebot.modules;

    httpServer.registerCustomRoute(
        IntegrationConstants.INTEGRATION_URI,
        "operations/send-chat-message",
        "POST",
        async (req, res) => {
            try {
                const { frontendCommunicator } = firebot.modules;
                const { message, chatter, replyId, offlineSendMode } = req.body as SendChatMessageRequest;
                if (!message) {
                    res.status(400).json({ success: false, error: "Missing message" });
                    return;
                }
                if (chatter && chatter !== "Streamer" && chatter !== "Bot") {
                    res.status(400).json({ success: false, error: "Invalid chatter value" });
                    return;
                }
                if (replyId) {
                    logger.debug("send-chat-message: replyId is not supported and will be ignored");
                }

                if (!youtubeIntegration.connected) {
                    logger.error("send-chat-message: Integration not connected");
                    res.status(503).json({ success: false, error: "Integration not connected" });
                    return;
                }

                const applicationsStorage = youtubeIntegration.getApplicationsStorage();
                if (!applicationsStorage.activeApplicationId) {
                    logger.error("send-chat-message: No active application");
                    res.status(503).json({ success: false, error: "No active application" });
                    return;
                }

                const activeApplication = applicationsStorage.applications[applicationsStorage.activeApplicationId];
                if (!activeApplication) {
                    logger.error("send-chat-message: Active application not found");
                    res.status(503).json({ success: false, error: "Active application not found" });
                    return;
                }

                const resolvedOfflineSendMode = offlineSendMode ?? "send-anyway";
                const sendGatedResponse = (reason: string) => {
                    logger.debug(`send-chat-message: message blocked (${reason})`);
                    if (resolvedOfflineSendMode === "chat-feed-only") {
                        frontendCommunicator.send("chatUpdate", {
                            fbEvent: "ChatAlert",
                            message: `[Not sent (YouTube): ${reason}] ${message}`,
                            icon: "fad fa-exclamation-triangle"
                        });
                    }
                    res.json({ success: false, error: reason });
                };

                if (resolvedOfflineSendMode !== "send-anyway") {
                    try {
                        const isLive = youtubeIntegration.isLive();
                        if (!isLive) {
                            if (resolvedOfflineSendMode === "chat-feed-only" || resolvedOfflineSendMode === "do-not-send") {
                                sendGatedResponse("Stream offline");
                                return;
                            }
                        }
                    } catch (error) {
                        logger.error(`send-chat-message: live status check failed: ${error}`);
                        sendGatedResponse("Status check failed");
                        return;
                    }
                }

                const restApiClient = youtubeIntegration.getRestApiClient();
                // Fire and forget: don't await the API call to avoid blocking
                restApiClient.sendChatMessage(message).then((success) => {
                    if (!success) {
                        logger.warn("YouTube chat message send returned false");
                    }
                }).catch((error) => {
                    logger.error(`Error sending YouTube chat message in server API: ${error}`);
                });
                res.json({ success: true });
            } catch (error) {
                logger.error(`send-chat-message operation failed: ${error}`);
                res.status(500).json({ success: false, error: String(error) });
            }
        }
    );

    httpServer.registerCustomRoute(
        IntegrationConstants.INTEGRATION_URI,
        "operations/get-user-display-name",
        "GET",
        async (req, res) => {
            try {
                const username = req.query.username;
                if (!username || typeof username !== "string") {
                    res.status(400).json({ displayName: null, error: "Missing or invalid username query parameter" });
                    return;
                }

                const displayName = username.replace(/@youtube$/, "");
                res.json({ displayName });
            } catch (error) {
                logger.error(`get-user-display-name operation failed: ${error}`);
                res.status(500).json({ displayName: null, error: String(error) });
            }
        }
    );

    logger.debug("Platform-lib REST API operation handlers registered successfully.");
}

export function unregisterRoutes() {
    const { httpServer } = firebot.modules;

    httpServer.unregisterCustomRoute(
        IntegrationConstants.INTEGRATION_URI,
        "operations/send-chat-message",
        "POST"
    );

    httpServer.unregisterCustomRoute(
        IntegrationConstants.INTEGRATION_URI,
        "operations/get-user-display-name",
        "GET"
    );

    logger.debug("Platform-lib REST API operation handlers unregistered successfully.");
}
