import {
    AngularJsComponent,
    AngularJsFactory,
    AngularJsPage,
    UIExtension
} from "@crowbartools/firebot-custom-scripts-types/types/modules/ui-extension-manager";
import { YouTubeOAuthApplication } from "../types";

function youTubeApplicationsServiceFunction(backendCommunicator: any): any {
    const service: any = {};

    service.getApplications = (): any => {
        const response = backendCommunicator.fireEventSync("youTube:getApplications", {});
        return response;
    };

    service.getActiveApplication = (): any => {
        return backendCommunicator.fireEventSync("youTube:getActiveApplication", {});
    };

    service.getApplicationDetails = (applicationId: string): any => {
        return backendCommunicator.fireEventSync("youTube:getApplicationDetails", { applicationId });
    };

    service.setActiveApplication = async (applicationId: string | null): Promise<any> => {
        return backendCommunicator.fireEventAsync("youTube:setActiveApplication", { applicationId });
    };

    service.saveApplication = async (applicationId: string, application: any): Promise<any> => {
        // Only send serializable fields through IPC
        const data = {
            id: application.id,
            name: application.name.trim(),
            clientId: application.clientId.trim(),
            clientSecret: application.clientSecret.trim(),
            quotaSettings: {
                dailyQuota: application.quotaSettings.dailyQuota,
                maxStreamHours: application.quotaSettings.maxStreamHours,
                overridePollingDelay: application.quotaSettings.overridePollingDelay,
                customPollingDelaySeconds: application.quotaSettings.customPollingDelaySeconds
            }
        };
        const response = await backendCommunicator.fireEventAsync("youTube:saveApplication", { applicationId, application: data });
        return response;
    };

    service.deleteApplication = async (applicationId: string): Promise<any> => {
        const response = await backendCommunicator.fireEventAsync("youTube:deleteApplication", { applicationId });
        return response;
    };

    service.deauthorizeApplication = async (applicationId: string): Promise<any> => {
        const response = await backendCommunicator.fireEventAsync("youTube:deauthorizeApplication", { applicationId });
        return response;
    };

    service.refreshApplicationStates = async (): Promise<any> => {
        return backendCommunicator.fireEventAsync("youTube:refreshApplicationStates", {});
    };

    service.getIntegrationStatus = (): any => {
        return backendCommunicator.fireEventSync("youTube:getIntegrationStatus", {});
    };

    service.connectIntegration = async (): Promise<any> => {
        return backendCommunicator.fireEventAsync("youTube:connectIntegration", {});
    };

    return service;
}

const youTubeApplicationsService: AngularJsFactory = {
    name: "youTubeApplicationsService",
    function: (backendCommunicator: any) => youTubeApplicationsServiceFunction(backendCommunicator)
};

const youTubeAddOrEditApplication: AngularJsComponent = {
    name: "youTubeAddOrEditApplication",
    bindings: {
        applicationId: "<",
        applicationName: "=",
        clientId: "=",
        clientSecret: "=",
        dailyQuota: "=",
        maxStreamHours: "=",
        overridePollingDelay: "=",
        customPollingDelaySeconds: "=",
        saveButton: "&",
        cancelButton: "&"
    },
    template: `
        <div id="youTubeAddOrEditApplication" class="modal-content" style="width:600px; min-height:unset; padding:5px 0; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="modal-header" style="text-align: center; width: 100%;">
                <h3 class="modal-title" ng-if="$ctrl.applicationId !== ''">Edit YouTube Application</h3>
                <h3 class="modal-title" ng-if="$ctrl.applicationId === ''">Add New YouTube Application</h3>
            </div>
            <div class="modal-body" style="width: 100%; max-height: 70vh; overflow-y: auto;">
                <div class="form-group">
                    <firebot-input input-title="Application Name" model="$ctrl.applicationName" required disable-variables="true" tooltip="A friendly name for this YouTube OAuth application." />
                </div>
                <div class="form-group">
                    <firebot-input input-title="Client ID" model="$ctrl.clientId" required disable-variables="true" tooltip="The OAuth Client ID from your Google Cloud Console." />
                </div>
                <div class="form-group">
                    <firebot-input input-title="Client Secret" model="$ctrl.clientSecret" required disable-variables="true" tooltip="The OAuth Client Secret from your Google Cloud Console." />
                </div>
                <div style="border-top: 1px solid #ccc; margin: 15px 0; padding-top: 15px;">
                    <h4>Quota Settings</h4>
                </div>
                <div class="form-group">
                    <firebot-input input-title="Daily Quota" model="$ctrl.dailyQuota" data-type="number" required disable-variables="true" tooltip="Your YouTube Data API daily quota limit. Default is 10,000 units per day." />
                </div>
                <div class="form-group">
                    <firebot-input input-title="Maximum Stream Hours" model="$ctrl.maxStreamHours" data-type="number" required disable-variables="true" tooltip="The maximum number of hours you expect to stream per day. Used to calculate polling delay." />
                </div>
                <div class="form-group">
                    <firebot-checkbox label="Override Polling Delay" model="$ctrl.overridePollingDelay" tooltip="Enable this to manually specify the delay between chat API calls instead of using the calculated value." />
                </div>
                <div class="form-group" ng-if="$ctrl.overridePollingDelay">
                    <firebot-input input-title="Custom Polling Delay (seconds)" model="$ctrl.customPollingDelaySeconds" data-type="number" required disable-variables="true" tooltip="The delay in seconds between chat API calls." />
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; width: 100%; margin-top: 20px;">
                    <button class="btn btn-default" ng-click="$ctrl.cancelButton()">Cancel</button>
                    <button class="btn btn-primary" ng-click="$ctrl.saveButton()">Save</button>
                </div>
            </div>
        </div>
    `,
    controller: () => {
        // No additional logic needed in the controller
    }
};

const youTubeDeleteConfirmation: AngularJsComponent = {
    name: "youTubeDeleteConfirmation",
    bindings: {
        applicationName: "<",
        cancelButton: "&",
        deleteButton: "&"
    },
    template: `
        <div id="youTubeDeleteConfirmation" class="modal-content" style="width:600px; min-height:unset; padding:5px 0; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="modal-header" style="text-align: center; width: 100%;">
                <h3 class="modal-title">Confirm Application Deletion</h3>
            </div>
            <div class="modal-body" style="text-align: center; width: 100%;">
                <div class="form-group">
                    <p>Are you sure you want to delete the YouTube application "<strong>{{$ctrl.applicationName}}</strong>"?</p>
                    <p class="muted">This action cannot be undone. Firebot will no longer be able to use this application for YouTube streaming.</p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; width: 100%; margin-top: 20px;">
                    <button class="btn btn-default" ng-click="$ctrl.cancelButton()">Cancel</button>
                    <button class="btn btn-danger" ng-click="$ctrl.deleteButton()">Delete</button>
                </div>
            </div>
        </div>
    `,
    controller: () => {
        // No additional logic needed in the controller
    }
};

const youTubeDeauthorizeConfirmation: AngularJsComponent = {
    name: "youTubeDeauthorizeConfirmation",
    bindings: {
        applicationName: "<",
        cancelButton: "&",
        deauthorizeButton: "&"
    },
    template: `
        <div id="youTubeDeauthorizeConfirmation" class="modal-content" style="width:600px; min-height:unset; padding:5px 0; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="modal-header" style="text-align: center; width: 100%;">
                <h3 class="modal-title">Confirm Deauthorization</h3>
            </div>
            <div class="modal-body" style="text-align: center; width: 100%;">
                <div class="form-group">
                    <p>Are you sure you want to deauthorize the YouTube application "<strong>{{$ctrl.applicationName}}</strong>"?</p>
                    <p class="muted">This will revoke the authorization and remove the stored credentials. You will need to re-authorize the application to use it again.</p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; width: 100%; margin-top: 20px;">
                    <button class="btn btn-default" ng-click="$ctrl.cancelButton()">Cancel</button>
                    <button class="btn btn-warning" ng-click="$ctrl.deauthorizeButton()">Deauthorize</button>
                </div>
            </div>
        </div>
    `,
    controller: () => {
        // No additional logic needed in the controller
    }
};

const youTubeAuthorizeUrl: AngularJsComponent = {
    name: "youTubeAuthorizeUrl",
    bindings: {
        authUrl: "<",
        applicationName: "<",
        cancelButton: "&"
    },
    template: `
        <div id="youTubeAuthorizeUrl" class="modal-content" style="width:700px; min-height:unset; padding:5px 0; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="modal-header" style="text-align: center; width: 100%;">
                <h3 class="modal-title">Authorize {{$ctrl.applicationName}}</h3>
            </div>
            <div class="modal-body" style="width: 100%; padding: 20px;">
                <p>Follow these steps to authorize the <strong>{{$ctrl.applicationName}}</strong> application:</p>

                <ol style="line-height: 1.8;">
                    <li>Copy the URL below by clicking the "Copy URL" button</li>
                    <li>Open your web browser and paste the URL into the address bar</li>
                    <li>Sign in with your YouTube account and grant the necessary permissions</li>
                    <li>You will be redirected back to Firebot with your authorization complete</li>
                </ol>

                <div style="border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin: 20px 0;">
                    <label style="display: block; margin-bottom: 10px; font-weight: bold;">Authorization URL:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="text" class="form-control" value="{{$ctrl.authUrl}}" readonly style="flex: 1;" id="authUrlInput" />
                        <button class="btn btn-primary" onclick="document.getElementById('authUrlInput').select(); document.execCommand('copy');">
                            <i class="fas fa-copy"></i> Copy URL
                        </button>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: center; width: 100%; margin-top: 20px;">
                    <button class="btn btn-default" ng-click="$ctrl.cancelButton()">Close</button>
                </div>
            </div>
        </div>
    `,
    controller: () => {
        // No additional logic needed in the controller
    }
};

const youTubeApplicationsPage: AngularJsPage = {
    id: "youTubeApplicationsPage",
    name: "YouTube Applications",
    icon: "fa-youtube",
    type: "angularjs",
    template: `
        <div class="modal-body">
            <eos-container header="YouTube OAuth Applications">
                <p class="help-text">Manage multiple YouTube OAuth applications. You can add different Google accounts or applications and switch between them.</p>

                <div ng-if="applications.length === 0" style="text-align: center; padding: 30px; color: #999;">
                    <p>No applications configured yet.</p>
                    <p>Click "Add New Application" to get started.</p>
                </div>

                <div class="list-group" style="margin-bottom: 0;" ng-if="applications.length > 0">
                    <div class="list-group-item flex-row-center jspacebetween" ng-repeat="app in applications track by app.id" style="position: relative; border: 2px solid {{ app.id === activeApplicationId ? '#52c41a' : (app.id === pendingActiveApplicationId ? '#faad14' : 'transparent') }}; border-style: {{ app.id === activeApplicationId ? 'solid' : (app.id === pendingActiveApplicationId ? 'dashed' : 'solid') }}; transition: border-color 0.3s;">
                        <div style="flex: 1;">
                            <h4 class="list-group-item-heading">
                                {{app.name}}
                                <span ng-if="app.id === activeApplicationId" style="background: #52c41a; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px; margin-left: 10px;">ACTIVE</span>
                                <span ng-if="app.id === pendingActiveApplicationId && app.id !== activeApplicationId" style="background: #faad14; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px; margin-left: 10px;">PENDING ACTIVE</span>
                            </h4>
                            <p class="list-group-item-text muted" style="margin-bottom: 5px;">
                                <span ng-if="app.ready" style="color: #52c41a;">
                                    <i class="fas fa-check-circle"></i> Ready
                                </span>
                                <span ng-if="!app.ready" style="color: #ff7875;">
                                    <i class="fas fa-times-circle"></i> Not Ready
                                </span>
                                <span style="margin-left: 15px;">Quota: {{app.quotaUnitsUsed || 0}}/{{app.quotaSettings.dailyQuota}}</span>
                                <span style="margin-left: 15px;">Stream Hours: {{app.quotaSettings.maxStreamHours}}</span>
                            </p>
                            <p class="list-group-item-text muted" ng-if="app.status">
                                {{app.status}}
                            </p>
                        </div>
                        <div style="font-size:14px; display: flex; gap: 10px; align-items: center;">
                            <button class="btn btn-sm" ng-class="{'btn-success': app.id !== activeApplicationId && app.id !== pendingActiveApplicationId, 'btn-default': app.id === activeApplicationId || app.id === pendingActiveApplicationId}" ng-click="setActiveButton(app.id)" ng-disabled="!app.ready || app.id === activeApplicationId || app.id === pendingActiveApplicationId">
                                <span ng-if="app.id === activeApplicationId">Active</span>
                                <span ng-if="app.id === pendingActiveApplicationId && app.id !== activeApplicationId">Pending</span>
                                <span ng-if="app.id !== activeApplicationId && app.id !== pendingActiveApplicationId">Activate</span>
                            </button>
                            <button class="btn btn-sm btn-default" ng-click="authorizeButton(app.id)" ng-disabled="app.hasRefreshToken">Authorize</button>
                            <button class="btn btn-sm btn-default" ng-click="deauthorizeButton(app.id)" ng-disabled="!app.hasRefreshToken">Deauthorize</button>
                            <button class="btn btn-sm btn-default" ng-click="editButton(app.id)">Edit</button>
                            <span uib-tooltip="Delete Application" tooltip-append-to-body="true" class="clickable" style="color:red;" ng-click="deleteButton(app.id)">
                                <i class="fas fa-trash-alt"></i>
                            </span>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button type="button" class="btn btn-primary" ng-click="addButton()">Add New Application</button>
                    <button type="button" class="btn btn-default" ng-click="refreshButton()">Refresh Status</button>
                    <button type="button" class="btn btn-success" ng-click="connectIntegration()" ng-if="!integrationConnected() && hasAnyAuthorizedApplication()">Connect Integration</button>
                </div>
            </eos-container>
        </div>

        <div class="modal-body" ng-if="displayDeleteConfirmation">
            <you-tube-delete-confirmation
                application-name="applicationName"
                delete-button="deleteConfirm(applicationId)"
                cancel-button="cancelButton()" />
        </div>

        <div class="modal-body" ng-if="displayDeauthorizeConfirmation">
            <you-tube-deauthorize-confirmation
                application-name="applicationName"
                deauthorize-button="deauthorizeConfirm(deauthorizeApplicationId)"
                cancel-button="cancelButton()" />
        </div>

        <div class="modal-body" ng-if="displayAddOrEditApplication">
            <you-tube-add-or-edit-application
                application-id="applicationId"
                application-name="applicationName"
                client-id="clientId"
                client-secret="clientSecret"
                daily-quota="dailyQuota"
                max-stream-hours="maxStreamHours"
                override-polling-delay="overridePollingDelay"
                custom-polling-delay-seconds="customPollingDelaySeconds"
                save-button="saveButton(applicationId, applicationName, clientId, clientSecret, dailyQuota, maxStreamHours, overridePollingDelay, customPollingDelaySeconds)"
                cancel-button="cancelButton()" />
        </div>

        <div class="modal-body" ng-if="displayAuthorizeUrl">
            <you-tube-authorize-url
                auth-url="authUrl"
                application-name="authorizeApplicationName"
                cancel-button="cancelButton()" />
        </div>
    `,
    controller: ($scope: any, backendCommunicator: any, youTubeApplicationsService: any, ngToast: any) => {
        $scope.applications = [];
        $scope.activeApplicationId = null;
        $scope.pendingActiveApplicationId = null;
        $scope.applicationId = "";
        $scope.applicationName = "";
        $scope.clientId = "";
        $scope.clientSecret = "";
        $scope.dailyQuota = 10000;
        $scope.maxStreamHours = 8;
        $scope.overridePollingDelay = false;
        $scope.customPollingDelaySeconds = -1;
        $scope.displayDeleteConfirmation = false;
        $scope.displayDeauthorizeConfirmation = false;
        $scope.displayAddOrEditApplication = false;
        $scope.displayAuthorizeUrl = false;
        $scope.authUrl = "";
        $scope.authorizeApplicationName = "";
        $scope.deauthorizeApplicationId = "";

        $scope.loadApplications = () => {
            const response = youTubeApplicationsService.getApplications();
            if (response.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error loading applications: ${response.errorMessage}`
                });
                return;
            }

            const activeResponse = youTubeApplicationsService.getActiveApplication();
            $scope.activeApplicationId = activeResponse.activeApplicationId || null;
            $scope.pendingActiveApplicationId = activeResponse.pendingActiveApplicationId || null;

            const apps = Object.entries(response.applications || {})
                .map(([id, app]: [string, any]) => ({
                    ...(app),
                    id
                }));
            $scope.applications = apps;
        };

        $scope.integrationConnected = () => {
            const status = youTubeApplicationsService.getIntegrationStatus();
            if (status.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error getting integration status: ${status.errorMessage}`
                });
                return;
            }
            return status.connected;
        };

        $scope.hasAnyAuthorizedApplication = () => {
            const haaa = $scope.applications.some((app: any) => app.hasRefreshToken);
            return haaa;
        };

        $scope.connectIntegration = async () => {
            try {
                const response = await youTubeApplicationsService.connectIntegration();
                if (response.errorMessage) {
                    ngToast.create({
                        className: 'danger',
                        content: `Error connecting integration: ${response.errorMessage}`
                    });
                    return;
                }
                ngToast.create({
                    className: 'success',
                    content: 'Integration connected successfully'
                });
                $scope.loadApplications();
            } catch (error: any) {
                ngToast.create({
                    className: 'danger',
                    content: `Error connecting integration: ${error.message}`
                });
            }
        };

        $scope.addButton = () => {
            $scope.applicationId = "";
            $scope.applicationName = "";
            $scope.clientId = "";
            $scope.clientSecret = "";
            $scope.dailyQuota = 10000;
            $scope.maxStreamHours = 8;
            $scope.overridePollingDelay = false;
            $scope.customPollingDelaySeconds = -1;
            $scope.cancelButton();
            $scope.displayAddOrEditApplication = true;
        };

        $scope.editButton = (applicationId: string) => {
            const app = $scope.applications.find((a: any) => a.id === applicationId);
            if (!app) {
                ngToast.create({
                    className: 'danger',
                    content: "Error: Application not found"
                });
                return;
            }

            // Fetch full application details including credentials
            const details = youTubeApplicationsService.getApplicationDetails(applicationId);
            if (details.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error loading application details: ${details.errorMessage}`
                });
                return;
            }

            $scope.applicationId = details.id;
            $scope.applicationName = details.name;
            $scope.clientId = details.clientId;
            $scope.clientSecret = details.clientSecret;
            $scope.dailyQuota = details.quotaSettings.dailyQuota;
            $scope.maxStreamHours = details.quotaSettings.maxStreamHours;
            $scope.overridePollingDelay = details.quotaSettings.overridePollingDelay;
            $scope.customPollingDelaySeconds = details.quotaSettings.customPollingDelaySeconds;
            $scope.cancelButton();
            $scope.displayAddOrEditApplication = true;
        };

        $scope.deleteButton = (applicationId: string) => {
            $scope.cancelButton();
            $scope.applicationId = applicationId;
            $scope.applicationName = $scope.applications.find((a: any) => a.id === applicationId)?.name || "Unknown";
            $scope.displayDeleteConfirmation = true;
        };

        $scope.deleteConfirm = async (applicationId: string) => {
            $scope.cancelButton();

            const response = await youTubeApplicationsService.deleteApplication(applicationId);
            if (response.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error deleting application: ${response.errorMessage}`
                });
                return;
            }

            ngToast.create({
                className: 'success',
                content: `Application "${$scope.applicationName}" deleted successfully.`
            });

            $scope.loadApplications();
        };

        $scope.setActiveButton = async (applicationId: string) => {
            const response = await youTubeApplicationsService.setActiveApplication(applicationId);
            if (response.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error setting active application: ${response.errorMessage}`
                });
                return;
            }

            ngToast.create({
                className: 'success',
                content: `Active application updated.`
            });

            $scope.loadApplications();
        };

        $scope.authorizeButton = (applicationId: string) => {
            const app = $scope.applications.find((a: any) => a.id === applicationId);
            if (!app) {
                ngToast.create({
                    className: 'danger',
                    content: "Error: Application not found"
                });
                return;
            }

            $scope.cancelButton();
            $scope.authUrl = `http://localhost:7472/integrations/mage-youtube-integration/link/${applicationId}/streamer`;
            $scope.authorizeApplicationName = app.name;
            $scope.displayAuthorizeUrl = true;

            // Set up polling to detect when authorization is complete
            const pollInterval = setInterval(() => {
                const applicationsResponse = youTubeApplicationsService.getApplications();
                if (applicationsResponse && applicationsResponse.applications) {
                    const authorizedApp = applicationsResponse.applications[applicationId];
                    if (authorizedApp && authorizedApp.ready) {
                        // Authorization is complete, refresh the app list and close modal
                        clearInterval(pollInterval);
                        $scope.cancelButton();
                        $scope.loadApplications();

                        ngToast.create({
                            className: 'success',
                            content: `Application "${app.name}" authorized successfully!`
                        });
                    }
                }
            }, 1000); // Poll every 1 second

            // Stop polling after 10 minutes
            setTimeout(() => {
                clearInterval(pollInterval);
            }, 10 * 60 * 1000);
        };

        $scope.deauthorizeButton = (applicationId: string) => {
            const app = $scope.applications.find((a: any) => a.id === applicationId);
            if (!app) {
                ngToast.create({
                    className: 'danger',
                    content: "Error: Application not found"
                });
                return;
            }

            $scope.cancelButton();
            $scope.applicationName = app.name;
            $scope.deauthorizeApplicationId = applicationId;
            $scope.displayDeauthorizeConfirmation = true;
        };

        $scope.deauthorizeConfirm = async (applicationId: string) => {
            const app = $scope.applications.find((a: any) => a.id === applicationId);

            const response = await youTubeApplicationsService.deauthorizeApplication(applicationId);
            if (response.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error deauthorizing application: ${response.errorMessage}`
                });
                return;
            }

            ngToast.create({
                className: 'success',
                content: `Application "${app?.name}" deauthorized.`
            });

            $scope.displayDeauthorizeConfirmation = false;
            $scope.loadApplications();
        };

        $scope.refreshButton = async () => {
            const response = await youTubeApplicationsService.refreshApplicationStates();
            if (response.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error refreshing application states: ${response.errorMessage}`
                });
                return;
            }

            ngToast.create({
                className: 'success',
                content: `Application states refreshed.`
            });

            $scope.loadApplications();
        };

        $scope.saveButton = async (applicationIdIn: string, applicationName: string, clientId: string, clientSecret: string, dailyQuota: number, maxStreamHours: number, overridePollingDelay: boolean, customPollingDelaySeconds: number) => {
            const applicationId = applicationIdIn || crypto.randomUUID();

            const application: YouTubeOAuthApplication = {
                id: applicationId,
                name: applicationName,
                clientId: clientId,
                clientSecret: clientSecret,
                refreshToken: "", // Will be filled in during OAuth flow
                quotaSettings: {
                    dailyQuota: dailyQuota,
                    maxStreamHours: maxStreamHours,
                    overridePollingDelay: overridePollingDelay,
                    customPollingDelaySeconds: customPollingDelaySeconds
                },
                ready: false
            };

            const response = await youTubeApplicationsService.saveApplication(applicationId, application);
            if (response.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error saving application: ${response.errorMessage}`
                });
                return;
            }

            ngToast.create({
                className: 'success',
                content: `Application "${applicationName}" saved successfully.`
            });

            $scope.loadApplications();
            $scope.displayAddOrEditApplication = false;
        };

        $scope.cancelButton = () => {
            $scope.displayDeleteConfirmation = false;
            $scope.displayDeauthorizeConfirmation = false;
            $scope.displayAddOrEditApplication = false;
            $scope.displayAuthorizeUrl = false;
        };

        $scope.loadApplications();

        // Set up periodic refresh of quota numbers (every 5 seconds)
        let refreshInterval: any = null;
        const startAutoRefresh = () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
            refreshInterval = setInterval(() => {
                $scope.loadApplications();
            }, 5000);
        };

        const stopAutoRefresh = () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
        };

        // Start auto-refresh when controller initializes
        startAutoRefresh();

        // Stop auto-refresh when the scope is destroyed
        $scope.$on('$destroy', () => {
            stopAutoRefresh();
        });

        backendCommunicator.on("youTube:applicationsUpdated", () => {
            $scope.$applyAsync(() => {
                $scope.loadApplications();
            });
        });

        // Listen for connection state changes
        backendCommunicator.on("connected", (_integrationId: string) => {
            // YouTube integration connected
            $scope.$applyAsync(() => {
                $scope.loadApplications();
            });
        });

        backendCommunicator.on("disconnected", (_integrationId: string) => {
            // YouTube integration disconnected
            $scope.$applyAsync(() => {
                $scope.loadApplications();
            });
        });

        // Listen for application status changes
        backendCommunicator.on("youTube:applicationStatusChanged", (data: any) => {
            // Reload applications to reflect status changes
            $scope.$applyAsync(() => {
                $scope.loadApplications();

                // Optionally show a toast notification
                if (data.ready) {
                    ngToast.create({
                        className: 'success',
                        content: `Application "${data.name}" is now ready.`
                    });
                } else {
                    ngToast.create({
                        className: 'warning',
                        content: `Application "${data.name}" is no longer ready: ${data.status}`
                    });
                }
            });
        });
    }
};

export const youTubeApplicationsExtension: UIExtension = {
    id: "youTubeApplicationsExtension",
    pages: [youTubeApplicationsPage],
    providers: {
        components: [youTubeAddOrEditApplication, youTubeAuthorizeUrl, youTubeDeleteConfirmation, youTubeDeauthorizeConfirmation],
        factories: [youTubeApplicationsService]
    }
};
