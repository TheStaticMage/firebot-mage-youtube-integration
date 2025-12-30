import { firebot, logger } from "../main";
import { youTubeApplicationsExtension } from "./youtube";

export function registerUIExtensions(): void {
    const { uiExtensionManager } = firebot.modules;
    if (!uiExtensionManager) {
        logger.error("UIExtensionManager is not available. Cannot register UI extensions.");
        return;
    }
    uiExtensionManager.registerUIExtension(youTubeApplicationsExtension);
    logger.debug("UI Extensions registered successfully.");
}
