/* eslint-disable @typescript-eslint/unbound-method */
import { CommandHandler, CommandRunner } from '../command';
import { firebot } from "../../main";

// Mock firebot modules
jest.mock("../../main", () => ({
    firebot: {
        firebot: {
            accounts: {
                streamer: {
                    username: "teststreamer"
                }
            }
        },
        modules: {
            commandManager: {
                getAllActiveCommands: jest.fn(),
                saveCustomCommand: jest.fn(),
                getSystemCommandById: jest.fn()
            },
            restrictionManager: {
                runRestrictionPredicates: jest.fn()
            },
            effectRunner: {
                processEffects: jest.fn()
            },
            frontendCommunicator: {
                send: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

const createMockChatMessage = (overrides?: any) => ({
    id: "msg1",
    username: "testuser",
    userDisplayName: "TestUser",
    userId: "user123",
    rawText: "!test",
    roles: [],
    whisper: false,
    badges: {},
    parts: [],
    action: false,
    tagged: false,
    isSharedChatMessage: false,
    ...overrides
});

const createMockCommand = (overrides?: any) => ({
    id: "test-cmd",
    type: "custom",
    trigger: "!test",
    name: "Test Command",
    effects: { list: [] },
    subCommands: [],
    fallbackSubcommand: undefined,
    triggerIsRegex: false,
    scanWholeMessage: false,
    aliases: [],
    count: 0,
    active: true,
    description: "Test command",
    ...overrides
});

describe("CommandHandler", () => {
    let commandHandler: CommandHandler;
    let mockGetAllActiveCommands: jest.Mock;
    let mockSaveCustomCommand: jest.Mock;
    let mockRunRestrictionPredicates: jest.Mock;
    let mockProcessEffects: jest.Mock;
    let mockFrontendCommunicatorSend: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        commandHandler = new CommandHandler();

        mockGetAllActiveCommands = (firebot.modules.commandManager.getAllActiveCommands as unknown as jest.Mock);
        mockSaveCustomCommand = (firebot.modules.commandManager.saveCustomCommand as unknown as jest.Mock);
        mockRunRestrictionPredicates = (firebot.modules.restrictionManager.runRestrictionPredicates as unknown as jest.Mock);
        mockProcessEffects = (firebot.modules.effectRunner.processEffects as unknown as jest.Mock);
        mockFrontendCommunicatorSend = (firebot.modules.frontendCommunicator.send as unknown as jest.Mock);
    });

    describe("Basic Command Triggering", () => {
        it("should detect and handle a basic command trigger", async () => {
            const mockCommand = createMockCommand();
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);
            mockProcessEffects.mockResolvedValue({});

            const chatMessage = createMockChatMessage();

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(true);
            expect(mockSaveCustomCommand).toHaveBeenCalledWith(expect.objectContaining({ id: "test-cmd" }));
        });

        it("should not handle messages without command triggers", async () => {
            mockGetAllActiveCommands.mockReturnValue([]);
            const chatMessage = createMockChatMessage();

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(false);
        });

        it("should handle case-insensitive triggers", async () => {
            const mockCommand = createMockCommand();
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);
            mockProcessEffects.mockResolvedValue({});

            const chatMessage = createMockChatMessage({ rawText: "!TEST" });

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(true);
        });
    });

    describe("Alias Matching", () => {
        it("should match command aliases", async () => {
            const mockCommand = createMockCommand({ aliases: ["!t", "!testing"] });
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);
            mockProcessEffects.mockResolvedValue({});

            const chatMessage = createMockChatMessage({ rawText: "!t some args" });

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(true);
        });
    });

    describe("Minimum Arguments", () => {
        it("should reject commands with insufficient arguments", async () => {
            const mockCommand = createMockCommand({ trigger: "!greet", minArgs: 1 });
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);

            const chatMessage = createMockChatMessage({ rawText: "!greet" });

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(false);
        });

        it("should accept commands with sufficient arguments", async () => {
            const mockCommand = createMockCommand({ trigger: "!greet", minArgs: 1 });
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);
            mockProcessEffects.mockResolvedValue({});

            const chatMessage = createMockChatMessage({ rawText: "!greet John" });

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(true);
        });
    });

    describe("Streamer Ignore", () => {
        it("should ignore command from streamer if ignoreStreamer is set", async () => {
            const mockCommand = createMockCommand({ ignoreStreamer: true });
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);

            const chatMessage = createMockChatMessage({ username: "teststreamer" });

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(false);
        });

        it("should allow command from streamer if ignoreStreaker is not set", async () => {
            const mockCommand = createMockCommand();
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);
            mockProcessEffects.mockResolvedValue({});

            const chatMessage = createMockChatMessage({ username: "teststreamer" });

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(true);
        });
    });

    describe("Restrictions", () => {
        it("should check restrictions before allowing command", async () => {
            const mockCommand = createMockCommand({
                restrictionData: {
                    restrictions: [{ type: "roles", roles: ["moderator"] }]
                }
            });
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);
            mockRunRestrictionPredicates.mockRejectedValue("User is not a moderator");

            const chatMessage = createMockChatMessage();

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(false);
            expect(mockRunRestrictionPredicates).toHaveBeenCalled();
        });

        it("should allow command when restrictions pass", async () => {
            const mockCommand = createMockCommand({
                restrictionData: {
                    restrictions: [{ type: "roles", roles: ["moderator"] }]
                }
            });
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);
            mockRunRestrictionPredicates.mockResolvedValue(undefined);
            mockProcessEffects.mockResolvedValue({});

            const chatMessage = createMockChatMessage({ roles: ["moderator"] });

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(true);
        });
    });

    describe("Message ID Deduplication", () => {
        it("should not process same message ID twice", async () => {
            const mockCommand = createMockCommand();
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);
            mockProcessEffects.mockResolvedValue({});

            const chatMessage = createMockChatMessage({ id: "duplicate-msg" });

            let result = await commandHandler.handleChatMessage(chatMessage);
            expect(result).toBe(true);

            result = await commandHandler.handleChatMessage(chatMessage);
            expect(result).toBe(false);
        });
    });

    describe("Command Count Updates", () => {
        it("should increment command count for custom commands", async () => {
            const mockCommand = createMockCommand({ count: 5 });
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);
            mockProcessEffects.mockResolvedValue({});

            const chatMessage = createMockChatMessage();

            await commandHandler.handleChatMessage(chatMessage);

            expect(mockSaveCustomCommand).toHaveBeenCalledWith(expect.objectContaining({ count: 6 }));
            expect(mockFrontendCommunicatorSend).toHaveBeenCalledWith("command-count-update", expect.any(Object));
        });
    });

    describe("Disabled Commands", () => {
        it("should not execute disabled subcommands", async () => {
            const mockCommand = createMockCommand({
                subCommands: [
                    {
                        id: "sub1",
                        arg: "sub",
                        effects: { list: [] },
                        active: false
                    }
                ]
            });
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);

            const chatMessage = createMockChatMessage({ rawText: "!test sub" });

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(false);
        });
    });

    describe("Scan Whole Message", () => {
        it("should find command trigger anywhere in message when scanWholeMessage is true", async () => {
            const mockCommand = createMockCommand({ scanWholeMessage: true });
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);
            mockProcessEffects.mockResolvedValue({});

            const chatMessage = createMockChatMessage({ rawText: "Hey everyone check this out !test command" });

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(true);
        });

        it("should only find command trigger at start when scanWholeMessage is false", async () => {
            const mockCommand = createMockCommand({ scanWholeMessage: false });
            mockGetAllActiveCommands.mockReturnValue([mockCommand]);

            const chatMessage = createMockChatMessage({ rawText: "Hey everyone check !test command" });

            const result = await commandHandler.handleChatMessage(chatMessage);

            expect(result).toBe(false);
        });
    });
});

describe("CommandRunner", () => {
    let commandRunner: CommandRunner;

    beforeEach(() => {
        jest.clearAllMocks();
        commandRunner = new CommandRunner();
    });

    describe("buildUserCommand", () => {
        it("should parse command trigger and arguments", () => {
            const mockCommand = createMockCommand();

            const userCmd = commandRunner.buildUserCommand(
                mockCommand,
                "!test arg1 arg2",
                "testuser",
                ["moderator"]
            );

            expect(userCmd.trigger).toBe("!test");
            expect(userCmd.args).toEqual(["arg1", "arg2"]);
            expect(userCmd.commandSender).toBe("testuser");
            expect(userCmd.senderRoles).toEqual(["moderator"]);
        });

        it("should handle quoted arguments", () => {
            const mockCommand = createMockCommand({
                trigger: "!echo",
                treatQuotedTextAsSingleArg: true
            });

            const userCmd = commandRunner.buildUserCommand(
                mockCommand,
                '!echo "hello world" "another arg"',
                "testuser"
            );

            expect(userCmd.args).toEqual(["hello world", "another arg"]);
        });
    });
});
