
# Upgrading the YouTube Integration

## Versioning Philosophy

- A **patch release** changes the last number (e.g. `0.0.3` -> `0.0.4`). These releases may fix bugs or add features, but your existing setup should continue to work just fine. _You may review the upgrade notes for any specific information, e.g. to take advantage of new features._

- A **minor release** changes the middle number (e.g. `0.0.4` -> `0.1.0`). These releases typically make some kind of considerable (but generally backward-compatible) change, in addition to possibly fixing bugs or adding features. Your existing setup should continue to work just fine, provided that you have stuck to the documented features, only modified things that we explicitly broke out for customization, and are not doing anything that we have deprecated. We may also announce that we plan to deprecate something, which doesn't break anything yet, but warns you to switch to the recommended way of doing things at some point before it does break things. You should review the upgrade notes below when upgrading to a minor version to check for breaking changes and newly deprecated items.

- A **major release** changes the first number (e.g. `0.1.5` -> `1.0.0`). Since version 1.0 typically implies stability and production-readiness, and that is highly unlikely ever to happen with this project, I do not intend to release version 1.0 or higher of this project, unless this somehow becomes an officially supported plugin for Firebot version 6.

## General Upgrade Procedure

1. Review the upgrade notes below, especially if you are upgrading more than just a patch release.

2. From the latest [Release](https://github.com/TheStaticMage/firebot-mage-youtube-integration/releases), download: `firebot-mage-youtube-integration-<version>.js` into your Firebot scripts directory

    (File > Open Data Folder, then select the "scripts" directory)

    :warning: Be sure you download the file from the releases page, not the source code of the GitHub repository!

3. In Firebot, go to **Settings > Scripts > Manage Startup Scripts** and click the **Edit** button next to MageYouTubeIntegration. Select the new version of the script from the dropdown. (If necessary, click the refresh icon to update the directory contents.)

4. Restart Firebot. (The new version of the script will _not_ be loaded until you actually restart Firebot.)

    :bulb: You may optionally remove older versions of the script from the scripts directory once you have installed new ones.

5. After upgrading, review your integration settings under **Settings > Integrations > MageYouTubeIntegration**. If the upgrade includes new configuration options, you may need to update your Google OAuth credentials or re-authorize your Google account.

## Upgrade Notes

(None yet)
