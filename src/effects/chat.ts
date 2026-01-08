import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { logger } from "../main";

type chatEffectParams = {
    message: string;
};

export const chatEffect: Firebot.EffectType<chatEffectParams> = {
    definition: {
        id: "mage-youtube-integration:chat",
        name: "Chat (YouTube)",
        description: "Send a chat message to YouTube.",
        icon: "fad fa-comment-lines",
        categories: ["common", "chat based"],
        dependencies: ["chat"]
    },
    optionsTemplate: `
    <eos-container header="Chat As" pad-top="true">
        <div class="btn-group">
            <button
                type="button"
                class="btn btn-default dropdown-toggle"
                data-toggle="dropdown"
                aria-haspopup="true"
                aria-expanded="false"
                ng-click="hidePanel = !hidePanel">
                <span class="chatter-type">{{effect.chatter || 'Streamer'}}</span> <span class="caret"></span>
            </button>
        </div>
    </eos-container>

    <eos-container header="Message To Send" pad-top="true">
        <firebot-input
            model="effect.message"
            use-text-area="true"
            placeholder-text="Enter message"
            rows="4"
            cols="40"
            menu-position="under"
        />
        <div style="color: #fb7373;" ng-if="effect.message && effect.message.length > characterLimit">
            Long messages will be automatically split into multiple messages.
        </div>
    </eos-container>
    `,
    optionsController: ($scope, backendCommunicator: any) => {
        try {
            const characterLimit: number = backendCommunicator.fireEventSync('mage-youtube-integration:getCharacterLimit');
            if (characterLimit) {
                $scope.characterLimit = characterLimit;
            } else {
                $scope.characterLimit = 500; // fallback
                backendCommunicator.fireEventAsync("mage-youtube-integration:log", {
                    level: "warn",
                    message: "Failed to get character limit for YouTube chat effect, using fallback value"
                });
            }
        } catch (error) {
            $scope.characterLimit = 500; // fallback
            backendCommunicator.fireEventAsync("mage-youtube-integration:log", {
                level: "error",
                message: `Error loading character limit for YouTube chat effect: ${error}`
            });
        }
    },
    optionsValidator: (effect) => {
        const errors = [];
        if (effect.message == null || effect.message === "") {
            errors.push("Chat message can't be blank.");
        }
        return errors;
    },
    onTriggerEvent: async ({ effect }) => {
        // Fire and forget: don't await the API call to avoid blocking
        const restApiClient = integration.getRestApiClient();
        restApiClient.sendChatMessage(effect.message).catch((error) => {
            logger.error(`Error sending YouTube chat message in effect: ${error}`);
        });
        return true;
    }
};
