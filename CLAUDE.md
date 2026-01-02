# Firebot YouTube Integration

Integration for Firebot <https://github.com/crowbartools/firebot> to YouTube live streaming.

Instructions:

- When finished with a task, display a summary that is at most 3 sentences long.
- Do not display a detailed summary or create markdown files unless explicitly instructed to do so.
- Update this CLAUDE.md file when:
  - Implementing significant new features or architectural changes
  - Discovering new patterns, insights, or learnings about the codebase
  - Completing major phases or milestones
  - Establishing new testing patterns or coverage strategies
  - Finding optimizations or improvements to existing approaches
  - Clarifying ambiguities in existing conventions or practices

Key features:

- Authenticate to YouTube via OAuth with automatic token refreshing
- Support multiple YouTube applications with per-application OAuth and token management
- Conscious of API quotas with per-application quota settings
- Chat message retrieval targeted to consume no more than 80% of daily API request quota
- Uses streamList GRPC endpoint to reduce API quota usage
- Chat messages from YouTube show up in Firebot chat feed (dashboard)
- Chat (YouTube) effect that posts message into YouTube chat
- Real-time status indicators for application ready state and token expiration
- Application Activated event triggered when active application changes with type-safe enum causes
- Variables exposing application metadata: applicationId, applicationName, activationCause, integrationConnected
- Fully compatible with firebot-mage-platform-lib for platform detection and version standardization

TODO:

- Message chunking for long messages due to overly restrictive 200 character limit
- Messages typed in Firebot chat feed are sent to YouTube chat
- Implement streamer filter for YouTube messages
- Detect broadcast online and broadcast offline
- Set broadcast title and detect broadcast title change
- Further evaluation of capabilities exposed by YouTube API
- Indicate YouTube broadcaster in chat feed
- Effects to change polling interval for YouTube messages (e.g. poll more frequently at times)
- Documentation for quota management
  - Explanation of YouTube quotas like:
    - <https://github.com/ThioJoe/YT-Spammer-Purge/wiki/Understanding-YouTube-API-Quota-Limits>
    - <https://www.getphyllo.com/post/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota>
  - Explanation of why Kick and Twitch don't have this problem (they have webhooks and EventSub not polling)
- Bot account support
- Reply functionality (if YouTube API adds support)
- Retry logic on sending chat messages for transient failures
- Rate limiting to prevent quota exhaustion
- Add filters to commands

Tech: TypeScript, Jest, firebot-mage-platform-lib

Learnings:

- Default daily YouTube API request quota is 10000
- Message length limit for chat messages is 200 characters
- streamList endpoint returns after 10 seconds if no chat messages
- Each call to streamList endpoint counts as 5 API requests
- streamList endpoint is relatively new so lack of example usage in open source projects does NOT imply it should be avoided
- Multi-application architecture improves maintainability by isolating per-app state and operations
- Automatic background token refresh (every ~50 minutes) prevents authentication failures during operation
- Ready status calculation requires both refresh token presence AND successful OAuth/refresh
- Per-application credential storage enables seamless switching without re-authorization
- Single QuotaManager instance manages quota tracking for all applications (per-app data in Map)
- Debounced writes (5 second delay) reduce file I/O overhead and eliminate concurrent write concerns
- Pacific Time timezone handling requires timezone-aware library (luxon) to account for DST transitions
- Constructor injection of dependencies across manager classes requires careful wiring review to avoid breaking existing factory patterns
- Corrupt quota data files should not crash the integration; fallback to empty state with logging
- Manager classes must NOT depend on `firebot` or `logger` in constructors; initialize these globals in main.ts `run()` first
- Manager classes that need `firebot` or `logger` should defer access to explicit `initialize()` methods called after `firebot`/`logger` are set
- Pattern: Constructor only initializes empty state; `async initialize()` method loads persisted data and accesses globals; call during integration startup
- Enum-based constants for event causes improve type safety and prevent string literal typos
- Variables support optional arguments for flexible data retrieval (e.g., $youtubeApplicationName[uuid])
- Variable examples in definition help users understand usage patterns (examples array with usage and description)
- ApplicationManager detects active application changes and notifies integration to switch polling via dynamic require to avoid circular dependencies; only triggers when integration is connected and application ID actually changed
- Polling interval display uses QuotaManager.getPollingIntervalDisplayText() to format: "Polling interval: Xs" for overridden delays, "Polling interval: Auto (Xs)" for calculated delays
- Connect phase refreshes tokens for ALL authorized applications during step 2b, ensuring UI shows consistent token expiration times across active and non-active applications before notifying the UI
- Chat history replay on initial connection prevented via client-side timestamp filtering; connection timestamp stored when startChatStreaming() is called, and messages with publishedAt before this timestamp are filtered during processing
- Timestamp-based filtering is the only viable approach for skipping old messages because streamList GRPC endpoint does not support timestamp filtering parameters; only pageToken pagination and client-side publishedAt comparison available
- Platform-lib integration enables cross-platform features: YouTube events include metadata.eventSource.id and metadata.platform fields for platform detection
- Platform-lib HTTP operation handlers registered during connect() and unregistered during disconnect() at integration URIs /mage-youtube-integration/operations/send-chat-message (POST) and /mage-youtube-integration/operations/get-user-display-name (GET)
- YouTube user transformation (y prefix for IDs, @youtube suffix for usernames) is compatible with platform-lib conventions
- Platform-lib compatibility check runs on startup; warns if platform-lib not installed or incompatible version
- Integration connect now performs a platform-lib ping check using the Firebot web server port before proceeding

Conventions:

- TypeScript: camelCase, PascalCase classes, satisfies eslint rules defined in package
- "YouTube": Capitalize as "YouTube" (or "youTube" in variable names or functions starting with "youTube")
- Logging: Provide observability via logger.debug
- Filters: Streamer filter uses role-based detection via `twitchUserRoles` array for reliable broadcaster identification
- Documentation: In Markdown, placed in `docs` directory, referenced from `README.md`, satisfies markdownlint
- Documentation: In Markdown, placed in `doc` directory, referenced from `README.md`
- Build: Code and GRPC proto consolidated to one file with webpack (webpack file loaded by Firebot as startup script)
- User ID: UserIDs from youtube are 'y' plus the given YouTube user ID
- User name: Usernames from youtube are the given YouTube username plus '@youtube'
- Files under `src/generated` are generated and must never be written by AI coding agents
- Import the YouTube API as: `import { youtube_v3 as youtubeV3 } from "@googleapis/youtube";`
- UI extensions live in `src/ui-extensions/youtube.ts`
- Local dev helper: `scripts/build-dev-local-client.js` swaps platform-lib client to local file dependency, runs build, then restores the original dependency
- No emojis in log messages or code comments
- Emojis are acceptable in documentation but must use GitHub markdown emojis (e.g. `:white_check_mark:`)
- No emdashes anywhere (code, comments, or documentation)
- Do not leave comments that only indicate something was removed
- Use comments to explain "why" or as headers before sections of code but do not leave obvious comments that describe short and straightforward implementation
- If something is being removed, remove it completely. Do not worry about backward compatibility or deprecation unless specifically instructed.
- Events: Use enums for event-specific constants (causes, types) to ensure type safety
- Variables: Test only the evaluator method; priority order: argument → event metadata → integration state
- Variables: Include examples array in definition showing usage with and without arguments
- Command handling: YouTube integration uses the same Firebot command manager, restriction manager, and effect runner as Kick integration; command processing happens before event triggering in chat message flow; commands are still added to chat feed and trigger events (no auto-delete yet)

Tests:

- Unit tests: Use jest, put in `__tests__` subdirectory under where the functions under test reside
- Test only the `onTriggerEvent` method of effects
- Meaningful tests must call actual functions or methods defined elsewhere (not in the test file itself). A test that only constructs mock data and checks properties is meaningless.
- Only add `/* eslint-disable @typescript-eslint/unbound-method */` to unit test files if the linter actually requires it (e.g., when mocking Firebot module methods causes linter errors); do not add preemptively
- Test coverage strategy:
  - Isolated unit tests for each component (application-utils, multi-auth-manager, etc.)
  - Edge case testing for state transitions and error handling
  - Multi-application scenario tests for integration between components
  - Functional tests simulating real-world usage patterns (chat sending, stream detection, token refresh)
  - Status indicator accuracy tests to validate UI display correctness
  - Command handler tests for trigger matching, aliases, restrictions, and execution

Things to check:

- `IntegrationDefinition` in `src/integration.ts` should align with `IntegrationParameters` in `src/integration-singleton.ts`
- Run `npm run build:dev` after each significant iteration to verify compilation

Notes:

- Reference similar implementation for Kick.com streaming service in `../firebot-mage-kick-integration`
- Reference platform library in `../firebot-mage-platform-lib`
- Firebot source code is in `../Firebot`
