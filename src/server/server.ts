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
                const { message, chatter } = req.body;
                if (!message) {
                    res.status(400).json({ success: false, error: "Missing message" });
                    return;
                }
                if (chatter !== "Streamer") {
                    res.status(400).json({ success: false, error: "Invalid chatter value" });
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

                if (!youtubeIntegration.connected) {
                    logger.error("send-chat-message: Integration not connected");
                    res.status(503).json({ success: false, error: "Integration not connected" });
                    return;
                }

                const restApiClient = youtubeIntegration.getRestApiClient();
                const success = await restApiClient.sendChatMessage(message);
                if (success) {
                    res.json({ success: true });
                } else {
                    res.status(500).json({ success: false, error: "Failed to send message" });
                }
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
