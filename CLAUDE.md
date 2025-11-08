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

TODO:

- YouTube chat messages appear in Firebot chat feed
- Messages typed in Firebot chat feed are sent to YouTube chat
- Create platform independent library for Twitch, Kick, YouTube supporting chat, username standardization, etc.
- Handle commands sent via YouTube messages
- Implement streamer filter for YouTube messages
- Detect broadcast online and broadcast offline
- Set broadcast title and detect broadcast title change
- Further evaluation of capabilities exposed by YouTube API

Tech: TypeScript, Jest

Learnings:

- Default daily YouTube API request quota is 10000
- streamList endpoint returns after 10 seconds if no chat messages
- Each call to streamList endpoint counts as 5 API requests
- streamList endpoint is relatively new so lack of example usage in open source projects does NOT imply it should be avoided

Conventions:

- TypeScript: camelCase, PascalCase classes, satisfies eslint rules defined in package
- "YouTube": Capitalize as "YouTube" (or "youTube" in variable names or functions starting with "youTube")
- Unit tests: Use jest, put in `__tests__` subdirectory under where the functions under test reside
- Logging: Provide observability via logger.debug
- Documentation: In Markdown, placed in `docs` directory, referenced from `README.md`, satisfies markdownlint
- Build: Code and GRPC proto consolidated to one file with webpack (webpack file loaded by Firebot as startup script)
- User ID: UserIDs from youtube are 'y' plus the given YouTube user ID
- User name: Usernames from youtube are the given YouTube username plus '@youtube'

Things to check:

- `IntegrationDefinition` in `src/integration.ts` should align with `IntegrationParameters` in `src/integration-singleton.ts`

Notes:

- Reference similar implementation for Kick.com streaming service in `../firebot-mage-kick-integration`
