# Installation

## Disclaimer and Warning

**ALL DATA STRUCTURES AND EVENTS IN THIS INTEGRATION -- EVEN THOSE THAT SEEM TO MAP CLEANLY -- ARE TOTAL HACKS. ALL EVENTS ARE IMPLEMENTED ... HACKILY. THIS INTEGRATION CONTAINS FORWARD-INCOMPATIBLE WORKAROUNDS AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE.**

**THIS IS NOT ASSOCIATED WITH FIREBOT AND IS NOT ENDORSED OR SUPPORTED BY THEIR DEVELOPERS OR ANYONE ELSE.**

## Setting Up Google OAuth 2.0 Credentials (for YouTube API)

To use the YouTube Data API v3 with OAuth 2.0 authentication, you must create a Google Cloud project, enable the API, and obtain OAuth credentials. Follow these steps:

### Step 1: Go to the Google Cloud Console

- Visit [https://console.cloud.google.com/](https://console.cloud.google.com/) and sign in with your Google account.

### Step 2: Create a New Project

1. Click the **project selector** at the top of the page.
2. Click **New Project**.
3. Enter a project name, such as `YouTubeChatBot`.
4. Click **Create**.

### Step 3: Enable the YouTube Data API v3

1. With your project selected, go to the [APIs & Services Dashboard](https://console.cloud.google.com/apis/dashboard).
2. Click **+ ENABLE APIS AND SERVICES** at the top.
3. Search for **YouTube Data API v3**.
4. Click on **YouTube Data API v3** in the results.
5. Click **Enable**.

### Step 4: Configure the OAuth Consent Screen

1. In the left sidebar, click **OAuth consent screen**.
2. Choose **External** and click **Create**.
3. Fill in the following fields:

    - **App name**: `YouTubeChatBot`
    - **User support email**: your email address
    - **Developer contact information**: your email address

4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes**.

    - Add the following scope:

      ```text
      https://www.googleapis.com/auth/youtube.force-ssl
      ```

    - Click **Update** and then **Save and Continue**.

6. Under **Test users**, add the email addresses of any Google accounts you want to use for testing.
7. Click **Save and Continue** until the process is complete.

### Step 5: Create OAuth 2.0 Credentials

1. In the left sidebar, click **Credentials**.
2. Click **+ CREATE CREDENTIALS** and select **OAuth client ID**.
3. For **Application type**, choose **Desktop app** (or **Web application** if appropriate).
4. Enter a name, such as `YouTubeChatBot Desktop`.
5. Click **Create**.
6. A dialog will appear with your **Client ID** and **Client Secret**.
7. Click **Download JSON** to save the credentials file (e.g., `client_secret_1234567890.json`).

### Step 6: Enter Your Credentials in Firebot

1. Open Firebot and go to **Settings > Integrations > MageYouTubeIntegration**.
2. In the **Google Application Settings** section, enter your **Client ID** and **Client Secret** from the Google Cloud Console.
3. Enter your **YouTube Channel ID** only if your Google account manages more than one YouTube channel. For most users, this can be left blank. (It does not hurt to enter it even if you only have one channel.)
4. Click **Save** to store your credentials in Firebot.

### Tips

- For more information, see the [Google Cloud OAuth 2.0 documentation](https://developers.google.com/identity/protocols/oauth2).
- Only add trusted accounts as test users during development.
- Never share your client ID or client secret.

## Installation: Integration

1. From the latest [Release](https://github.com/TheStaticMage/firebot-mage-youtube-integration/releases), download `firebot-mage-youtube-integration-<version>.js` into your Firebot scripts directory

    (File &gt; Open Data Folder, then select the "scripts" directory)

    :warning: Be sure you download the file from the releases page, not the source code of the GitHub repository!

2. Enable custom scripts in Firebot (Settings &gt; Scripts) if you have not already done so.

3. Go to Settings &gt; Scripts &gt; Manage Startup Scripts &gt; Add New Script and add the `firebot-mage-youtube-integration-<version>.js` script.

    :bulb: For now, it is suggested to leave the script settings at their defaults. You can always come back to change these later.

4. Restart Firebot. (The script will _not_ be loaded until you actually restart Firebot.)

## Configuration: Integration

1. Navigate to Settings &gt; Integrations and look for the integration entitled **MageYouTubeIntegration**.

2. Click the **Configure** button next to MageYouTubeIntegration.

3. Configure the settings as follows:

    - **Google Application Settings**

      - **Client ID**: Enter the Client ID you obtained from the Google Cloud Console.
      - **Client Secret**: Enter the Client Secret you obtained from the Google Cloud Console.
      - **YouTube Channel ID**: Only required if your Google account manages more than one YouTube channel. For most users, this can be left blank. (It does not hurt to enter it even if you only have one channel.)

    - **Accounts**

      - **Authorize Streamer Account**: Use this option to authorize the Google account that will be used for YouTube access. Follow the on-screen instructions to complete the OAuth flow.

    - **Chat Settings**

      - **Chat Feed**: If checked (default), YouTube chat messages will be added to the Firebot chat feed, shown when you click on DASHBOARD in Firebot. This does not forward messages to Twitch or any on-screen overlay.

    - **Trigger Twitch Events**

      - **Chat Message**: If checked, a YouTube chat message will also trigger the corresponding Twitch event in Firebot. Use with caution if you have overlapping logic for both platforms.

    - **Logging Settings**

      - **Log Chat Pushes**: If checked, all chat pushes received from YouTube will be logged to the Firebot log. Useful for debugging.
      - **Log API Calls and Responses**: If checked, all API calls and responses to/from YouTube will be logged to the Firebot log. Useful for debugging.

    - **Advanced Settings**

      - **Suppress Chat Feed Notifications**: If checked, chat feed notifications from the YouTube integration will be suppressed. You will not be informed of connection issues or errors unless you monitor the Firebot log files.

4. Click **Save** when you're done. (Save your settings before you proceed to the authentication steps.)

## Authentication of Streamer

You will authenticate your Google (YouTube) account using your browser. This uses OAuth 2.0, so your Google password is never shared with Firebot.

1. In Firebot, go to **Settings > Integrations > MageYouTubeIntegration** and click **Configure**.
2. In the **Accounts** section, click the button or link to **Authorize Streamer Account**.
3. A browser window will open and prompt you to log in to your Google account (if you are not already logged in).
4. Review the requested permissions and click **Allow** to grant access to the YouTube Data API.
5. After successful authorization, you will see a confirmation message. You can close the browser tab.

If you need to manually start the authentication process, you can also open the following link in your browser:

[`http://localhost:7472/integrations/firebot-mage-youtube-integration/link/streamer`](http://localhost:7472/integrations/firebot-mage-youtube-integration/link/streamer)

:bulb: You can re-authenticate at any time by repeating these steps. The authorization link is always available in the integration settings.
