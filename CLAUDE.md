# Firebot YouTube Integration

Integration for Firebot <https://github.com/crowbartools/firebot> to YouTube live streaming.

Instructions:

- When finished with a task, display a summary that is at most 3 sentences long.
- Do not display a detailed summary or create markdown files unless explicitly instructed to do so.

Key features:

- Authenticate to YouTube via OAuth with automatic token refreshing
- Conscious of API quotas
- Chat message retrieval targeted to consume no more than 80% of daily API request quota
- Uses streamList GRPC endpoint to reduce API quota usage
- Chat messages from YouTube show up in Firebot chat feed (dashboard)
- Chat (YouTube) effect that posts message into YouTube chat

TODO:

- Determine the actual current limit on chat message length
- Message chunking for long messages due to overly restrictive character limit
- Messages typed in Firebot chat feed are sent to YouTube chat
- Create platform independent library for Twitch, Kick, YouTube supporting chat, username standardization, etc.
- Handle commands sent via YouTube messages
- Implement streamer filter for YouTube messages
- Detect broadcast online and broadcast offline
- Set broadcast title and detect broadcast title change
- Further evaluation of capabilities exposed by YouTube API
- Visual distinction of platform in chat feed
- Indicate YouTube broadcaster in chat feed
- Do not display YouTube messages in chat feed or trigger events for messages before Firebot started
- Effects to change polling interval for YouTube messages (e.g. poll more frequently at times)
- Support multiple YouTube applications (partially implemented)
  - Create Firebot effect to change active YouTube configuration
  - Select active YouTube configuration in UI Extension
  - Firebot variable indicating active YouTube configuration
  - Option to display authorized Google account in YouTube application list (hidden by default)
- Enhanced quota management
  - Every API call records the number of quota units consumed
  - Track quota units consumed between Firebot sessions
  - Reset available quota units at 00:00 Pacific time
  - Add Firebot variables for quota units used, quota units remaining
  - Add Firebot event for YouTube quota threshold reached (e.g. trigger event when quota use first exceeds 80%)
  - Documentation for quota management
    - Explanation of YouTube quotas like:
      - <https://github.com/ThioJoe/YT-Spammer-Purge/wiki/Understanding-YouTube-API-Quota-Limits>
      - <https://www.getphyllo.com/post/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota>
    - Explanation of why Kick and Twitch don't have this problem (they have webhooks and EventSub not polling)
- Bot account support
- Reply functionality (if YouTube API adds support)
- Retry logic on sending chat messages for transient failures
- Rate limiting to prevent quota exhaustion

Tech: TypeScript, Jest

Learnings:

- Default daily YouTube API request quota is 10000
- Message length limit for chat messages is 200 characters
- streamList endpoint returns after 10 seconds if no chat messages
- Each call to streamList endpoint counts as 5 API requests
- streamList endpoint is relatively new so lack of example usage in open source projects does NOT imply it should be avoided

Conventions:

- TypeScript: camelCase, PascalCase classes, satisfies eslint rules defined in package
- "YouTube": Capitalize as "YouTube" (or "youTube" in variable names or functions starting with "youTube")
- Logging: Provide observability via logger.debug
- Documentation: In Markdown, placed in `docs` directory, referenced from `README.md`, satisfies markdownlint
- Build: Code and GRPC proto consolidated to one file with webpack (webpack file loaded by Firebot as startup script)
- User ID: UserIDs from youtube are 'y' plus the given YouTube user ID
- User name: Usernames from youtube are the given YouTube username plus '@youtube'
- Files under `src/generated` are generated and must never be written by AI coding agents
- Import the YouTube API as: `import { youtube_v3 as youtubeV3 } from "@googleapis/youtube";`
- No emojis in log messages or code comments
- Emojis are acceptable in documentation but must use GitHub markdown emojis (e.g. `:white_check_mark:`)
- No emdashes anywhere (code, comments, or documentation)
- Do not leave comments that only indicate something was removed
- Use comments to explain "why" or as headers before sections of code but do not leave obvious comments that describe short and straightforward implementation
- If something is being removed, remove it completely. Do not worry about backward compatibility or deprecation unless specifically instructed.

Tests:

- Unit tests: Use jest, put in `__tests__` subdirectory under where the functions under test reside
- Test only the `onTriggerEvent` method of effects

Things to check:

- `IntegrationDefinition` in `src/integration.ts` should align with `IntegrationParameters` in `src/integration-singleton.ts`
- Run `npm run build:dev` after each significant iteration to verify compilation

Notes:

- Reference similar implementation for Kick.com streaming service in `../firebot-mage-kick-integration`
