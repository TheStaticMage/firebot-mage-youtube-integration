import { FirebotChatMessage } from "@crowbartools/firebot-custom-scripts-types/types/chat";
import { CommandDefinition, UserCommand } from "@crowbartools/firebot-custom-scripts-types/types/modules/command-manager";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { firebot, logger } from "../main";

interface TriggerWithArgs {
    trigger: string;
    args?: string[];
}

interface CommandMatch {
    command: CommandDefinition | null;
    matchedTrigger?: string;
}

const escapeRegExp = (str: string) => {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"); // eslint-disable-line no-useless-escape
};

export class CommandHandler {
    private _handledMessageIds: string[] = [];
    private commandRunner: CommandRunner;

    constructor() {
        this.commandRunner = new CommandRunner();
    }

    private buildCommandRegexStr(trigger: string, scanWholeMessage: boolean): string {
        const escapedTrigger = escapeRegExp(trigger);
        if (scanWholeMessage) {
            return `(?:^|\\s)${escapedTrigger}(?!-)(?:\\b|$|(?=\\s))`;
        }
        return `^${escapedTrigger}(?!-)(?:\\b|$|(?=\\s))`;
    }

    private testForTrigger(message: string, trigger: string, scanWholeMessage: boolean, triggerIsRegex: boolean): boolean {
        message = message.toLowerCase();

        const normalizedTrigger = trigger.toLowerCase();
        const commandRegexStr = triggerIsRegex
            ? trigger
            : this.buildCommandRegexStr(normalizedTrigger, scanWholeMessage);

        const regex = new RegExp(commandRegexStr, "gi");

        return regex.test(message);
    }

    private checkForCommand(rawMessage: string): CommandMatch {
        if (rawMessage == null || rawMessage.length < 1) {
            return { command: null };
        }

        const { commandManager } = firebot.modules;
        const allCommands = commandManager.getAllActiveCommands();

        for (const command of allCommands) {
            if (this.testForTrigger(
                rawMessage,
                command.trigger,
                command.scanWholeMessage || false,
                command.triggerIsRegex || false
            )
            ) {
                return { command, matchedTrigger: command.trigger };
            }

            if (!command.triggerIsRegex && command.aliases != null && Array.isArray(command.aliases)) {
                for (const alias of command.aliases) {
                    if (this.testForTrigger(
                        rawMessage,
                        alias,
                        command.scanWholeMessage || false,
                        false
                    )) {
                        return { command, matchedTrigger: alias };
                    }
                }
            }
        }
        return { command: null };
    }

    private updateCommandCount(command: CommandDefinition): void {
        command.count = (command.count ?? 0) + 1;

        const { commandManager } = firebot.modules;
        commandManager.saveCustomCommand(command);

        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("command-count-update", {
            commandId: command.id,
            count: command.count
        });
    }

    async handleChatMessage(firebotChatMessage: FirebotChatMessage): Promise<boolean> {
        logger.debug("Checking for command in message...");

        // Username of the person that sent the command.
        const commandSender = firebotChatMessage.username;

        // Check to see if handled message array contains the id of this message already.
        // If it does, that means that one of the logged in accounts has already handled the message.
        if (this._handledMessageIds.includes(firebotChatMessage.id)) {
            // We can remove the handled id now, to keep the array small.
            this._handledMessageIds = this._handledMessageIds.filter(id => id !== firebotChatMessage.id);
            return false;
        }
        // throw the message id into the array. This prevents command processing from happening twice.
        this._handledMessageIds.push(firebotChatMessage.id);

        logger.debug("Combining message segments...");
        const rawMessage = firebotChatMessage.rawText;

        // search for and return command if found
        logger.debug("Searching for command...");
        const { command, matchedTrigger } = this.checkForCommand(rawMessage);

        // command wasn't found
        if (command == null) {
            return false;
        }

        const { streamer } = firebot.firebot.accounts;

        // check if chat came from the streamer and if we should ignore it.
        if (command.ignoreStreamer && firebotChatMessage.username === streamer.username) {
            logger.debug("Message came from streamer and this command is set to ignore it");
            return false;
        }

        // YouTube does not support whispers or bot accounts, so those checks are omitted

        // build usercommand object
        const userCmd = this.commandRunner.buildUserCommand(command, rawMessage, commandSender, firebotChatMessage.roles);
        const triggeredSubcmd = userCmd.triggeredSubcmd;

        // update trigger with the one we matched
        if (matchedTrigger == null) {
            userCmd.isInvalidSubcommandTrigger = true;
        } else {
            userCmd.trigger = matchedTrigger;
        }

        // command is disabled
        if (triggeredSubcmd && triggeredSubcmd.active === false) {
            logger.debug("This Command is disabled");
            return false;
        }

        if (userCmd.isInvalidSubcommandTrigger === true) {
            // Send message to chat?
            return false;
        }

        // YouTube API does not support message deletion yet
        // Placeholder for potential future implementation: auto-delete trigger

        // check if command meets min args requirement
        const minArgs = triggeredSubcmd ? triggeredSubcmd.minArgs || 0 : command.minArgs || 0;
        if (userCmd.args.length < minArgs) {
            // const usage = triggeredSubcmd ? triggeredSubcmd.usage : command.usage;
            // Send message to chat?
            return false;
        }

        // Cooldown manager is not currently exposed from Firebot to custom scripts.

        // Check if command passes all restrictions
        let restrictionData = command.restrictionData;
        let restrictionsAreInherited = false;
        if (triggeredSubcmd) {
            const subCommandHasRestrictions = triggeredSubcmd.restrictionData && triggeredSubcmd.restrictionData.restrictions
                && triggeredSubcmd.restrictionData.restrictions.length > 0;

            if (subCommandHasRestrictions) {
                restrictionData = triggeredSubcmd.restrictionData;
            } else {
                // subcommand has no restrictions, inherit from base command
                restrictionData = command.restrictionData;
                restrictionsAreInherited = true;
            }
        } else {
            restrictionData = command.restrictionData;
        }

        if (restrictionData) {
            logger.debug("Command has restrictions...checking them.");
            const triggerData: Trigger = {
                type: "command",
                metadata: {
                    username: commandSender,
                    userId: firebotChatMessage.userId,
                    userDisplayName: firebotChatMessage.userDisplayName,
                    userTwitchRoles: firebotChatMessage.roles,
                    command: command,
                    userCommand: userCmd,
                    chatMessage: firebotChatMessage
                }
            };
            try {
                const { restrictionManager } = firebot.modules;
                await restrictionManager.runRestrictionPredicates(triggerData, restrictionData, restrictionsAreInherited);
                logger.debug("Restrictions passed!");
            } catch (restrictionReason) {
                let reason;
                if (Array.isArray(restrictionReason)) {
                    reason = restrictionReason.join(", ");
                } else {
                    reason = restrictionReason;
                }

                logger.debug(`${commandSender} could not use command '${command.trigger}' because: ${reason}`);
                return false;
            }
        }

        // If command is not on cooldown AND it passes restrictions, then we can run it. Store the cooldown.
        // commandCooldownManager.cooldownCommand(command, triggeredSubcmd, commandSender);

        // update the count for the command
        if (command.type === "custom") {
            logger.debug("Updating command count.");
            this.updateCommandCount(command);
        }

        this.commandRunner.fireCommand(command, userCmd, firebotChatMessage, commandSender, false);
        return true;
    }
}

export class CommandRunner {
    private parseCommandTriggerAndArgs(trigger: string, rawMessage: string, scanWholeMessage = false, treatQuotedTextAsSingleArg = false): TriggerWithArgs {
        let args: string[] = [];
        if (rawMessage != null) {
            let rawArgs: string[] = [];

            if (treatQuotedTextAsSingleArg) {
                // Get args
                const quotedArgRegExp = /"([^"]+)"|(\S+)/g;
                rawArgs = rawMessage.match(quotedArgRegExp) ?? [];

                // Strip surrounding quotes from quoted args
                rawArgs = rawArgs.map(rawArg => rawArg.replace(/^"(.+)"$/, '$1'));
            } else {
                rawArgs = rawMessage.split(" ");
            }

            if (scanWholeMessage) {
                args = rawArgs;
            } else {
                if (rawArgs.length > 0) {
                    trigger = rawArgs[0];
                    args = rawArgs.splice(1);
                }
            }
        }

        args = args.filter(a => a.trim() !== "");
        return { trigger, args };
    }

    buildUserCommand(command: CommandDefinition, rawMessage: string, sender: string, senderRoles?: string[]): UserCommand {
        const { trigger, args } = this.parseCommandTriggerAndArgs(command.trigger, rawMessage, command.scanWholeMessage, command.treatQuotedTextAsSingleArg);

        const userCmd: UserCommand = {
            trigger: trigger,
            args: args ?? [],
            commandSender: sender,
            senderRoles: senderRoles ?? [],
            isInvalidSubcommandTrigger: false
        };

        if (!command.scanWholeMessage &&
            !command.triggerIsRegex &&
            userCmd.args.length > 0 &&
            command.subCommands && command.subCommands.length > 0) {

            for (const subcmd of command.subCommands) {
                if (subcmd.active === false && command.type !== "system") {
                    continue;
                }
                if (subcmd.regex) {
                    const regex = new RegExp(`^${subcmd.arg}$`, "gi");
                    if (regex.test(userCmd.args[0])) {
                        userCmd.triggeredSubcmd = subcmd;
                        break;
                    }
                } else {
                    if (subcmd.arg.toLowerCase() === userCmd.args[0].toLowerCase()) {
                        userCmd.triggeredSubcmd = subcmd;
                        break;
                    }
                }
            }

            if (command.type !== "system" && userCmd.triggeredSubcmd == null) {
                if (command.fallbackSubcommand == null || !command.fallbackSubcommand.active) {
                    userCmd.isInvalidSubcommandTrigger = true;
                } else {
                    userCmd.triggeredSubcmd = command.fallbackSubcommand;
                }
            }

            if (userCmd.triggeredSubcmd != null) {
                userCmd.triggeredArg = userCmd.triggeredSubcmd.arg;
                userCmd.subcommandId = userCmd.triggeredSubcmd.id;
            }
        }

        return userCmd;
    }

    private async execute(command: CommandDefinition, userCommand: UserCommand, firebotChatMessage?: FirebotChatMessage, manual = false) {
        let effects = command.effects;
        if (command.subCommands && command.subCommands.length > 0 && userCommand.subcommandId != null) {
            if (userCommand.subcommandId === "fallback-subcommand" && command.fallbackSubcommand) {
                effects = command.fallbackSubcommand.effects;
            } else {
                const subcommand = command.subCommands.find(sc => sc.id === userCommand.subcommandId);
                if (subcommand) {
                    effects = subcommand.effects;
                }
            }
        }

        const trigger: Trigger = {
            type: manual ? "manual" : "command",
            metadata: {
                username: userCommand.commandSender,
                userId: firebotChatMessage?.userId,
                userDisplayName: firebotChatMessage?.userDisplayName || firebotChatMessage?.username,
                command: command,
                userCommand: userCommand,
                chatMessage: firebotChatMessage
            }
        };

        const processEffectsRequest = {
            trigger: trigger,
            effects: effects
        };

        if (firebotChatMessage != null) {
            processEffectsRequest.trigger.metadata.userId = firebotChatMessage.userId;
            processEffectsRequest.trigger.metadata.userDisplayName = firebotChatMessage.userDisplayName || firebotChatMessage.username;
        }

        logger.debug(`Executing effects for command '${command.trigger}': ${JSON.stringify(effects)}`);
        const { effectRunner } = firebot.modules;
        try {
            return await effectRunner.processEffects(processEffectsRequest);
        } catch (reason) {
            logger.error(`Error when running effects: ${reason}`);
        }
    }

    fireCommand(
        command: CommandDefinition,
        userCmd: UserCommand,
        firebotChatMessage: FirebotChatMessage,
        commandSender: string,
        isManual = false
    ): void {
        if (command == null) {
            return;
        }
        if (commandSender == null) {
            commandSender = firebot.firebot.accounts.streamer.username;
        }

        logger.info(`Checking command type... ${command.type}`);

        if (command.type === "system" && command.id) {
            logger.info("Executing system command");
            const { commandManager } = firebot.modules;
            const cmdDef = commandManager.getSystemCommandById(command.id);
            if (!cmdDef) {
                logger.warn(`System command not found: ${command.id}`);
                return;
            }

            const commandOptions: Record<string, any> = {};
            if (command.options != null) {
                for (const optionName of Object.keys(command.options)) {
                    const option = command.options[optionName];
                    if (option) {
                        commandOptions[optionName] = option.value ?? option.default;
                    }
                }
            }

            // call trigger event.
            cmdDef.onTriggerEvent({
                command: command,
                commandOptions: commandOptions,
                userCommand: userCmd,
                chatMessage: firebotChatMessage
            });
        }
        if (command.effects) {
            logger.info("Executing command effects");
            logger.debug(`Chat message: ${JSON.stringify(firebotChatMessage)}`);
            try {
                this.execute(command, userCmd, firebotChatMessage, isManual);
                logger.debug("Finished executing command effects");
            } catch (error) {
                logger.error(`Error executing command effects: ${error}`);
            }
        }
    }
}

export const commandHandler = new CommandHandler();
