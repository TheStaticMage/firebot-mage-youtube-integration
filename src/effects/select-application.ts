import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { logger } from "../main";

type selectApplicationEffectParams = {
    applicationId: string;
};

export const selectApplicationEffect: Firebot.EffectType<selectApplicationEffectParams> = {
    definition: {
        id: "mage-youtube-integration:select-application",
        name: "Select Active YouTube Application",
        description: "Change the active YouTube application.",
        icon: "fad fa-exchange-alt",
        categories: ["common"]
    },
    optionsTemplate: `
    <eos-container header="YouTube Application" pad-top="true">
        <div ng-if="hasNoApplications" class="muted" style="color: #fb7373;">
            At least one YouTube application must be configured before this effect can be used.
        </div>
        <div ng-if="!hasNoApplications">
            <dropdown-select options="applicationOptions" selected="effect.applicationId"></dropdown-select>
        </div>
    </eos-container>
    `,
    optionsController: ($scope, backendCommunicator: any) => {
        try {
            const response = backendCommunicator.fireEventSync('youTube:getApplications');
            if (response.errorMessage) {
                $scope.hasNoApplications = true;
                backendCommunicator.fireEventAsync("mage-youtube-integration:log", {
                    level: "warn",
                    message: `Failed to get applications for select application effect: ${response.errorMessage}`
                });
            } else {
                const applications = response.applications || {};
                const applicationIds = Object.keys(applications);

                if (applicationIds.length === 0) {
                    $scope.hasNoApplications = true;
                } else {
                    $scope.hasNoApplications = false;
                    const sortedIds = applicationIds.sort((a, b) => {
                        const nameA = applications[a].name.toLowerCase();
                        const nameB = applications[b].name.toLowerCase();
                        return nameA.localeCompare(nameB);
                    });
                    const options: Record<string, string> = {};
                    for (const id of sortedIds) {
                        options[id] = applications[id].name;
                    }
                    $scope.applicationOptions = options;
                }
            }
        } catch (error) {
            $scope.hasNoApplications = true;
            backendCommunicator.fireEventAsync("mage-youtube-integration:log", {
                level: "error",
                message: `Error loading applications for select application effect: ${error}`
            });
        }
    },
    optionsValidator: (effect) => {
        const errors = [];
        if (effect.applicationId == null || effect.applicationId === "") {
            errors.push("A YouTube application must be selected.");
        }
        return errors;
    },
    getDefaultLabel: (effect, backendCommunicator: any) => {
        if (!effect.applicationId) {
            backendCommunicator.fireEventAsync("mage-youtube-integration:log", {
                level: "warn",
                message: `Failed to get applications for select application default label: No application ID stored with effect`
            });
            return "???";
        }

        try {
            const response = backendCommunicator.fireEventSync('youTube:getApplications');
            if (response.errorMessage) {
                backendCommunicator.fireEventAsync("mage-youtube-integration:log", {
                    level: "warn",
                    message: `Failed to get applications for select application default label: ${response.errorMessage}`
                });
                return "???";
            }

            const applications = response.applications || {};
            const application = applications[effect.applicationId];

            if (!application) {
                backendCommunicator.fireEventAsync("mage-youtube-integration:log", {
                    level: "warn",
                    message: `Failed to get applications for select application default label: No application found with ID ${effect.applicationId}`
                });
                return "???";
            }

            return application.name;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            backendCommunicator.fireEventAsync("mage-youtube-integration:log", {
                level: "warn",
                message: `Failed to get applications for select application default label: Error retrieving application with ID ${effect.applicationId}: ${errorMessage}`
            });
            return "???";
        }
    },
    onTriggerEvent: async ({ effect }) => {
        try {
            if (!effect.applicationId) {
                logger.warn("Select application effect triggered with no application ID");
                return true;
            }

            const applicationManager = integration.getApplicationManager();
            const application = applicationManager.getApplication(effect.applicationId);

            if (!application) {
                logger.warn(`Select application effect triggered with non-existent application ID: ${effect.applicationId}`);
                return true;
            }

            const activeApplication = applicationManager.getActiveApplication();
            if (activeApplication && activeApplication.id === effect.applicationId) {
                logger.info(`Application ${application.name} is already active`);
                return true;
            }

            if (!application.refreshToken) {
                logger.warn(`Cannot activate application ${application.name}: no refresh token`);
                return true;
            }

            await applicationManager.setActiveApplication(effect.applicationId);
            logger.info(`Activated YouTube application: ${application.name}`);
            return true;
        } catch (error) {
            logger.error(`Error in select application effect: ${error}`);
            return false;
        }
    }
};
