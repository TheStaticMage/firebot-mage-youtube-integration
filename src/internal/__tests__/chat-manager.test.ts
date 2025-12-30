/* eslint-disable @typescript-eslint/unbound-method */
import { YouTubeMessageTypes } from '../../constants';
import { LiveChatMessage } from '../../generated/proto/stream_list';
import { firebot } from '../../main';
import { SAMPLE_YOUTUBE_TEXT_MESSAGE } from '../../types/sample-payloads';
import { ChatManager } from '../chat-manager';
import { QuotaManager } from '../quota-manager';

// Mock the firebot modules
jest.mock('../../main', () => ({
    firebot: {
        modules: {
            eventManager: {
                triggerEvent: jest.fn()
            },
            frontendCommunicator: {
                send: jest.fn(() => true) // Arrow function returns a value to avoid lint errors
            }
        }
    }
}));

// Mock command handler
jest.mock('../command', () => ({
    commandHandler: {
        handleChatMessage: jest.fn(() => Promise.resolve(false)) // Mock returns false (not a command)
    }
}));

// Mock logger
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
};

// Mock quota manager
const mockQuotaManager = {
    calculateDelay: jest.fn(() => 10), // Return 10 seconds as default delay
    isQuotaExceededError: jest.fn(() => false)
} as unknown as QuotaManager;

// Mock integration
const mockIntegration = {
    isChatFeedEnabled: jest.fn(() => true),
    getApplicationsStorage: jest.fn(() => ({
        applications: {
            'test-app-id': {
                id: 'test-app-id',
                name: 'Test App',
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                refreshToken: 'test-refresh-token',
                quotaSettings: {
                    dailyQuota: 10000,
                    maxStreamHours: 8,
                    overridePollingDelay: false,
                    customPollingDelaySeconds: -1
                },
                ready: true,
                status: 'Ready'
            }
        },
        activeApplicationId: 'test-app-id'
    }))
} as any;

// Mock client factory
const mockClientFactory = jest.fn(() => ({}));

describe('ChatManager handleMessage', () => {
    let chatManager: ChatManager;

    beforeEach(() => {
        jest.clearAllMocks();

        chatManager = new ChatManager(
            mockLogger,
            mockQuotaManager,
            mockClientFactory,
            mockIntegration
        );
    });

    it('should process a text message and trigger event with correct metadata', async () => {
        // Arrange
        const sampleMessage = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            }
        } as unknown as LiveChatMessage;

        const expectedMetadata = {
            eventSource: {
                id: 'mage-youtube-integration'
            },
            platform: 'youtube',
            username: 'John Viewer@youtube',
            userId: 'yUCrDkAvwXgOFDjlW9wqyYeIQ',
            userDisplayName: 'John Viewer',
            twitchUserRoles: [],
            messageText: 'Great stream!',
            messageId: 'MTU0ODEyMzQ1NjczODk2NzUzNDQ.CtHSEg',
            chatMessage: expect.any(Object)
        };

        // Act - Access private method using bracket notation for testing
        await (chatManager as any).handleMessage(sampleMessage);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            'mage-youtube-integration',
            'chat-message',
            expectedMetadata as unknown as Record<string, unknown>
        );

        // Verify chat feed message was sent
        expect(firebot.modules.frontendCommunicator.send).toHaveBeenCalledWith(
            'twitch:chat:message',
            expect.any(Object)
        );

        // Verify logging
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('[YouTube Chat] John Viewer@youtube: Great stream!')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('User roles:')
        );
    });

    it('should not process non-text messages', async () => {
        // Arrange
        const nonTextMessage = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                type: YouTubeMessageTypes.SUPER_CHAT_EVENT
            }
        } as unknown as LiveChatMessage;

        // Act
        await (chatManager as any).handleMessage(nonTextMessage);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).not.toHaveBeenCalled();
        expect(firebot.modules.frontendCommunicator.send).not.toHaveBeenCalled();
    });

    it('should not process messages with empty text', async () => {
        // Arrange
        const emptyMessage = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT,
                displayMessage: '',
                textMessageDetails: {
                    messageText: ''
                }
            }
        } as unknown as LiveChatMessage;

        // Act
        await (chatManager as any).handleMessage(emptyMessage);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).not.toHaveBeenCalled();
        expect(firebot.modules.frontendCommunicator.send).not.toHaveBeenCalled();
    });

    it('should handle moderator role correctly', async () => {
        // Arrange
        const moderatorMessage = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            },
            authorDetails: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.authorDetails,
                isChatModerator: true
            }
        } as unknown as LiveChatMessage;

        const expectedRoles = ['mod'];

        // Act
        await (chatManager as any).handleMessage(moderatorMessage);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            'mage-youtube-integration',
            'chat-message',
            expect.objectContaining({
                twitchUserRoles: expectedRoles
            }) as unknown as Record<string, unknown>
        );
    });

    it('should handle sponsor role correctly', async () => {
        // Arrange
        const sponsorMessage = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            },
            authorDetails: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.authorDetails,
                isChatSponsor: true
            }
        } as unknown as LiveChatMessage;

        const expectedRoles = ['sub', 'tier1'];

        // Act
        await (chatManager as any).handleMessage(sponsorMessage);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            'mage-youtube-integration',
            'chat-message',
            expect.objectContaining({
                twitchUserRoles: expectedRoles
            }) as unknown as Record<string, unknown>
        );
    });

    it('should handle broadcaster role correctly', async () => {
        // Arrange
        const broadcasterMessage = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            },
            authorDetails: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.authorDetails,
                isChatOwner: true
            }
        } as unknown as LiveChatMessage;

        const expectedRoles = ['broadcaster'];

        // Act
        await (chatManager as any).handleMessage(broadcasterMessage);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            'mage-youtube-integration',
            'chat-message',
            expect.objectContaining({
                twitchUserRoles: expectedRoles
            }) as unknown as Record<string, unknown>
        );
    });

    it('should handle multiple roles correctly', async () => {
        // Arrange
        const multiRoleMessage = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            },
            authorDetails: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.authorDetails,
                isChatOwner: true,
                isChatModerator: true,
                isChatSponsor: true
            }
        } as unknown as LiveChatMessage;

        const expectedRoles = ['broadcaster', 'mod', 'sub', 'tier1'];

        // Act
        await (chatManager as any).handleMessage(multiRoleMessage);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            'mage-youtube-integration',
            'chat-message',
            expect.objectContaining({
                twitchUserRoles: expect.arrayContaining(expectedRoles)
            }) as unknown as Record<string, unknown>
        );
    });

    it('should not send to chat feed when chat feed is disabled', async () => {
        // Arrange
        mockIntegration.isChatFeedEnabled.mockReturnValue(false);
        const sampleMessage = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            },
            authorDetails: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.authorDetails
            }
        } as unknown as LiveChatMessage;

        // Act
        await (chatManager as any).handleMessage(sampleMessage);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalled();
        expect(firebot.modules.frontendCommunicator.send).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
        // Arrange
        const sampleMessage = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            },
            authorDetails: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.authorDetails
            }
        } as unknown as LiveChatMessage;

        // Mock eventManager to throw an error
        (firebot.modules.eventManager.triggerEvent as jest.Mock).mockImplementationOnce(() => {
            throw new Error('Test error');
        });

        // Act
        await (chatManager as any).handleMessage(sampleMessage);

        // Assert
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error handling message:')
        );
    });

    it('should use displayMessage when available', async () => {
        // Arrange
        const messageWithDisplay = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                displayMessage: 'Display message content',
                textMessageDetails: {
                    messageText: 'Different text content'
                },
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            },
            authorDetails: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.authorDetails
            }
        } as unknown as LiveChatMessage;

        // Act
        await (chatManager as any).handleMessage(messageWithDisplay);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            'mage-youtube-integration',
            'chat-message',
            expect.objectContaining({
                messageText: 'Display message content',
                chatMessage: expect.objectContaining({ rawText: 'Display message content' })
            }) as unknown as Record<string, unknown>
        );
    });

    it('should fallback to textMessageDetails when displayMessage is not available', async () => {
        // Arrange
        const messageWithoutDisplay = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                displayMessage: undefined,
                textMessageDetails: {
                    messageText: 'Fallback message content'
                },
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            },
            authorDetails: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.authorDetails
            }
        } as unknown as LiveChatMessage;

        // Act
        await (chatManager as any).handleMessage(messageWithoutDisplay);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            'mage-youtube-integration',
            'chat-message',
            expect.objectContaining({
                messageText: 'Fallback message content',
                chatMessage: expect.objectContaining({ rawText: 'Fallback message content' })
            }) as unknown as Record<string, unknown>
        );
    });

    it('should filter out messages posted before the connection timestamp', async () => {
        // Arrange
        const now = new Date();
        const messageBeforeConnection = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                publishedAt: new Date(now.getTime() - 60000).toISOString(), // 60 seconds before
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            }
        } as unknown as LiveChatMessage;

        // Set connection timestamp to now
        (chatManager as any).connectionTimestamp = now;

        // Act
        await (chatManager as any).handleMessage(messageBeforeConnection);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).not.toHaveBeenCalled();
        expect(firebot.modules.frontendCommunicator.send).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Filtered message posted before connection')
        );
    });

    it('should process messages posted after the connection timestamp', async () => {
        // Arrange
        jest.clearAllMocks();
        mockIntegration.isChatFeedEnabled.mockReturnValue(true);
        const now = new Date();
        const messageAfterConnection = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                publishedAt: new Date(now.getTime() + 5000).toISOString(), // 5 seconds after
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            }
        } as unknown as LiveChatMessage;

        // Set connection timestamp to now
        (chatManager as any).connectionTimestamp = now;

        // Act
        await (chatManager as any).handleMessage(messageAfterConnection);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalled();
        expect(firebot.modules.frontendCommunicator.send).toHaveBeenCalled();
    });

    it('should process messages when connection timestamp is not set', async () => {
        // Arrange
        jest.clearAllMocks();
        mockIntegration.isChatFeedEnabled.mockReturnValue(true);
        const sampleMessage = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                publishedAt: new Date().toISOString(),
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            }
        } as unknown as LiveChatMessage;

        // Ensure connection timestamp is null (not set)
        (chatManager as any).connectionTimestamp = null;

        // Act
        await (chatManager as any).handleMessage(sampleMessage);

        // Assert
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalled();
        expect(firebot.modules.frontendCommunicator.send).toHaveBeenCalled();
    });

    it('should process messages without publishedAt timestamp', async () => {
        // Arrange
        jest.clearAllMocks();
        mockIntegration.isChatFeedEnabled.mockReturnValue(true);
        const messageWithoutTimestamp = {
            ...SAMPLE_YOUTUBE_TEXT_MESSAGE,
            snippet: {
                ...SAMPLE_YOUTUBE_TEXT_MESSAGE.snippet,
                publishedAt: undefined,
                type: YouTubeMessageTypes.TEXT_MESSAGE_EVENT
            }
        } as unknown as LiveChatMessage;

        // Set connection timestamp
        (chatManager as any).connectionTimestamp = new Date();

        // Act
        await (chatManager as any).handleMessage(messageWithoutTimestamp);

        // Assert - should process (fail-safe behavior)
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalled();
        expect(firebot.modules.frontendCommunicator.send).toHaveBeenCalled();
    });
});
