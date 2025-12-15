**ATTENTION: THIS IS A WORK IN PROGRESS THAT HAS SHOWN PROMISE BUT IS NOT YET WORKING IN FIREBOT**

# Firebot YouTube Integration

## Disclaimer and Warning

**THIS PROJECT IS NOT ASSOCIATED WITH FIREBOT OR YOUTUBE AND IS NOT ENDORSED OR SUPPORTED BY THEIR DEVELOPERS OR ANYONE ELSE.**

**ALL DATA STRUCTURES AND EVENTS IN THIS INTEGRATION -- EVEN THOSE THAT SEEM TO MAP CLEANLY -- ARE TOTAL HACKS. ALL EVENTS ARE IMPLEMENTED ... HACKILY. THIS INTEGRATION CONTAINS FORWARD-INCOMPATIBLE WORKAROUNDS AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE.**

Use caution: this integration uses forward-incompatible workarounds and should be treated as experimental.

- Firebot is designed for a single streaming platform (Twitch), and many core assumptions and functionality are tightly coupled to this design. As a result, full compatibility with YouTube is not achievable under the current architecture.

- While I've tried to clearly separate YouTube user data from Firebot's built-in databases, there's a risk of data leakage or corruption. This could impair or disable your Firebot instance entirely. Always maintain reliable backups.

## Introduction

This [Firebot](https://firebot.app) integration provides chat feed integration, events and effects for the [YouTube.com](https://YouTube.com) streaming platform.

### Effects

_Effects are calls to the YouTube API made by Firebot as a result of event handlers, preset effect lists, quick actions, and the like._

| Effect | Supported | Notes |
| ------ | --------- | ----- |
| Chat (send message) | :white_check_mark: | |
| Select Active YouTube Application | :white_check_mark: | Change which YouTube application is active |

### Events

| Event | Supported | Notes |
| ----- | --------- | ----- |
| Chat message (incoming) | Partial | Only basic proof-of-concept information at this time. Planned for full implementation. |
| Application Activated | :white_check_mark: | Triggered when a YouTube application becomes active. Provides cause, applicationId, applicationName, and connected status. |

### Variables

_Variables can be used in Firebot to access integration data dynamically._

| Variable | Description | Example Usage |
| -------- | ----------- | ------------- |
| `$youtubeApplicationId` | UUID of the active YouTube application | `$youtubeApplicationId` |
| `$youtubeApplicationName` | Name of the active YouTube application, or specific application by UUID | `$youtubeApplicationName` or `$youtubeApplicationName[uuid]` |
| `$youtubeApplicationActivationCause` | Cause of the application activation (from Application Activated event) | `$youtubeApplicationActivationCause` |
| `$youtubeIntegrationConnected` | Whether the YouTube integration is currently connected | `$youtubeIntegrationConnected` |

### Firebot features

| Feature | Support Status | Notes |
| ------- | -------------- | ----- |
| Channel point rewards: | :x: | No YouTube equivalent |
| Commands | :white_check_mark: | Supported. Cooldowns will not work due to Firebot limitations. |
| Chat feed: Display YouTube messages | Planned | |
| Chat feed: All other context menu items | Maybe | Need to be evaluated  |
| Commands | Planned | Cooldowns will not work due to Firebot limitations |
| Currency | :x: | Firebot assumes all users are Twitch users |
| Currency: Watch time | :x: | No way to track this on YouTube |
| Viewer database | :x: | Firebot assumes all users are Twitch users |

### Limitations due to Firebot

- Firebot's viewer database uses Twitch user IDs as primary keys and assumes every user is from Twitch. This rigid design prevents many features that depend on storing information about users (e.g. currency, metadata).
- Rate limiting (cooldowns) for commands doesn't work natively. Consider using the [Firebot Rate Limiter](https://github.com/TheStaticMage/firebot-rate-limiter) if needed.
- Slash commands in the Firebot chat (e.g. `/clear`) only apply to Twitch.
- You won't be able to add a YouTube user to a custom role via the Firebot GUI, because Firebot does a Twitch lookup on whatever you type. It is, however, possible to have events add YouTube users to custom roles. You can remove YouTube users from custom roles through the GUI.

## Installation

This integration is experimental and aimed at users comfortable with technical setup. I will reconsider broader release and support once Firebot evolves for cleaner multi-platform support.

[Installation instructions](/doc/installation.md) are available if you're feeling adventurous.

[Upgrading instructions](/doc/upgrading.md) are available if you felt adventurous in the past and are still feeling adventurous.

## Support

**Again: This project is not associated with or supported by Firebot or YouTube.**

There is no official support available. Using this may jeopardize Firebot's stability or future upgrades. Always maintain reliable backups.

## Contributions

Contributions are welcome via [Pull Requests](https://github.com/TheStaticMage/firebot-mage-youtube-integration/pulls). I _strongly suggest_ that you contact me before making significant changes, because I'd feel really bad if you spent a lot of time working on something that is not consistent with my vision for the project. Please refer to the [Contribution Guidelines](/.github/contributing.md) for specifics.

Join our Discord community in [The Static Family](https://discord.gg/3tacKgB74n) and head to the `#firebot-mage-youtube-integration` channel to discuss.

## License

This project is released under the [GNU General Public License version 3](/LICENSE).

Some code in this project is based on (or copied from) [Firebot](https://github.com/crowbartools/firebot), which is licensed under the GNU GPL 3 as well. Since the source code is distributed here and links back to Firebot, this project complies with the license.
