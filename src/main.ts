import { Firebot, RunRequest } from '@crowbartools/firebot-custom-scripts-types';
import { Logger } from '@crowbartools/firebot-custom-scripts-types/types/modules/logger';
import { checkPlatformLibCompatibility } from '@thestaticmage/mage-platform-lib-client';
import { IntegrationConstants } from './constants';
import { definition, integration } from './integration';

export let firebot: RunRequest<any>;
export let logger: LogWrapper;

export const scriptVersion = '0.0.3';

const script: Firebot.CustomScript = {
    getScriptManifest: () => {
        return {
            name: 'YouTube Integration',
            description: 'Integration with certain events for the YouTube platform.',
            author: 'The Static Mage',
            version: scriptVersion,
            startupOnly: true,
            firebotVersion: '5'
        };
    },
    getDefaultParameters: () => {
        return {};
    },
    run: async (runRequest: RunRequest<any>) => {
        firebot = runRequest;
        logger = new LogWrapper(runRequest.modules.logger);
        logger.info(`Mage YouTube Integration v${scriptVersion} initializing...`);

        const platformLibCheck = await checkPlatformLibCompatibility(
            runRequest,
            IntegrationConstants.INTEGRATION_NAME,
            IntegrationConstants.PLATFORM_LIB_VERSION_CONSTRAINT,
            logger
        );

        if (platformLibCheck.success) {
            logger.info("Platform library is compatible");
        } else {
            logger.warn(`Platform library compatibility check: ${platformLibCheck.errorMessage || "Unknown error"}`);
        }

        const { integrationManager } = runRequest.modules;
        integrationManager.registerIntegration({ definition, integration });
        logger.info(`Registered integration: ${IntegrationConstants.INTEGRATION_NAME}`);
    }
};

export default script;

class LogWrapper {
    private _logger: Logger;

    constructor(inLogger: Logger) {
        this._logger = inLogger;
    }

    info(message: string) {
        this._logger.info(`[${IntegrationConstants.INTEGRATION_ID}] ${message}`);
    }

    error(message: string) {
        this._logger.error(`[${IntegrationConstants.INTEGRATION_ID}] ${message}`);
    }

    debug(message: string) {
        this._logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] ${message}`);
    }

    warn(message: string) {
        this._logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] ${message}`);
    }
}
