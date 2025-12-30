# Configuration

## Setting Up Google OAuth 2.0 Application and Credentials (for YouTube API)

To use the YouTube Data API v3 with OAuth 2.0 authentication, you must create a Google Cloud project, enable the API, and obtain OAuth credentials. This is a one-time setup.

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
2. Click the **Get started** button.
3. Fill in the following fields:

    - **App name**: `YouTubeChatBot`
    - **User support email**: your email address

    Then click **Next**.
4. For **Audience** select **External**. Then click **Next**.
5. For **Contact Information** enter your email address. Then click **Next**.
6. Check the box to acknowledge the user data policy. Then click **Continue**.
7. Click the **Create** button.

### Step 5: Configure the OAuth Client

1. In the left sidebar, click **Clients**.
2. Click **Create client**.
3. For **Application type**, choose **Desktop app**.
4. Enter a name, such as `YouTubeChatBot Firebot Integration`.
5. Click **Create**.
6. A dialog will appear with your **Client ID** and **Client Secret**. You will need to copy these into Firebot later and they won't be shown again, so either:
    - Copy these to a text document
    - Click the "Download JSON" link to download these to a file

**Note:** If you don't copy the client secret or download the file, you'll need to delete the client and create another one. Google will not show the secret again after initial creation.

### Step 6: Authorize Users

1. In the left sidebar, click  **Audience**.
2. Under **Test users** click **+ Add users**.
3. Enter your email address(es). Click **Save** when done.

### Step 7: Select Data Access Scope

1. In the left sidebar, click **Data Access**.
2. Click **Add or remove scopes**.
3. Find `.../auth/youtube.force-ssl`. (It's easiest to type "youtube" in the filter and then click on this choice.)
4. Check the box next to `.../auth/youtube.force-ssl` and then click **Update** to save.
5. Make sure that `.../auth/youtube.force-ssl` appears under "Your sensitive scopes."
6. Click the **Save** button to save these settings.

## Authorizing Firebot to your OAuth Application

### Step 1: Add Application to Firebot

1. Open Firebot and find the **YouTube** item in the left panel.
2. Find the "YouTube OAuth Applications" section.
3. Click **Add New Application** (or to edit an existing application, click the **Edit** button next to it).
4. Fill out the form with the following settings:

    - **Application Name** can be whatever you want. This is only used within Firebot.
    - **Client ID** must match the client ID from [Configure the OAuth Client](#step-5-configure-the-oauth-client)
    - **Client Secret** must match the client secret from [Configure the OAuth Client](#step-5-configure-the-oauth-client)

    If you did not copy the client ID and secret but you instead downloaded them as a file, you can examine that file to retrieve `client_id` and `client_secret`.

    If you did not download these as a file either, then you'll need to re-create them.

5. Leave the other settings at their defaults for now.
6. Click **Save**.

### Step 2: Authorize Streamer Account

1. Open Firebot and find the **YouTube** item in the left panel.
2. Find the "YouTube OAuth Applications" section.
3. Click the **Authorize** button next to your application. (If you need to re-authorize, click **Deauthorize** first, and then you will be able to click **Authorize**.)
4. Click **Copy URL** in the pop-up dialog.
5. Paste the URL into your web browser.
6. Select your Google account associated with your YouTube channel. (Log in to Google if necessary.)
7. You now reach the "Google hasn’t verified this app" screen. Click **Continue**. (This is a normal message, because you have not submitted your OAuth application to Google for review. You're going to be the only one using it.)
8. You are now presented with one or more screens confirming authorizations and/or permissions. Grant any requested permissions and click **Continue** as needed to advance.
9. Upon reaching the confirmation screen, return to Firebot. You should see that the application is now authorized.

:bulb: You can re-authenticate at any time by repeating these steps.
