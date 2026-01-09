# YouTube Quota Management

## Why YouTube is Different

YouTube uses a fundamentally different approach to communicate with applications like Firebot than platforms like Twitch and Kick. Understanding this difference is key to managing quota limits effectively.

### The Car Trip Analogy

Imagine you're on a car trip with your kids in the back seat:

**Twitch and Kick (Webhooks/WebSockets):** The kids say "Tell me when we get there" at the start of the trip. The parent says "OK" and drives. When they arrive at the destination, the parent turns around and says "We're here!" The kids only spoke once at the beginning, and the parent notified them when something changed.

**YouTube (Polling):** The kids have to repeatedly ask "Are we there yet?" over and over throughout the entire trip. The parent answers "No" each time. After a few dozen requests, the parent gets frustrated and says "No, and you can't ask me again for the rest of the day."

This is exactly how these platforms work with chat messages:

- **Twitch and Kick** tell Firebot when a new chat message arrives. Firebot opens a connection and waits to be notified.
- **YouTube** requires Firebot to repeatedly ask "Are there any new messages?" YouTube responds with either new messages or "No new messages." After too many requests, YouTube stops responding until the next day.

### Impact on Chat Messages

Because YouTube requires polling instead of push notifications:

- **Twitch and Kick:** Messages appear in Firebot instantly as they're sent.
- **YouTube:** You may choose to wait between requests to avoid exhausting your quota. Messages may be delayed by several seconds or even minutes depending on how long you want between your polling requests.

The longer you space out your requests, the more your quota will last throughout the day, but the longer the delay before messages appear in Firebot.

## Understanding YouTube's Quota System

YouTube provides each application with a daily quota of API request units. Think of this like a daily allowance of "question tickets" you can spend.

### Daily Quota Reset

Quotas reset at **midnight Pacific Time** each day. This timing is controlled by YouTube and cannot be changed.

Once you exhaust your daily quota, you must wait until midnight Pacific Time for it to reset.

### Default Quota Limit

Most YouTube API applications start with a default quota of **10,000 units per day**. This is what you'll have unless you've requested an increase from YouTube.

### Quota Costs per Operation

Different operations consume different amounts of quota:

| Operation | Quota Cost | What It Does |
| --------- | ---------- | ------------ |
| Check for new chat messages | 5 units | Polls for new messages in chat (will wait up to 10 seconds) |
| Send a chat message | 20 units per chunk | Sends one message to YouTube chat (messages over 200 characters are automatically split into multiple chunks) |
| Check if stream is live | 1 unit | Checks current broadcast status |

The most quota-intensive operation is **checking for new chat messages** because it happens repeatedly throughout your stream.

### How the Plugin Calculates Delays

The plugin automatically calculates how long to wait between chat message checks based on:

1. **Daily Quota:** How many units you have per day (default: 10,000)
2. **Maximum Stream Hours:** Your longest expected stream duration per day (default: 8 hours)
3. **Safety Buffer:** The plugin uses only 80% of your quota for chat polling, reserving 20% for other operations

Each streamList request can wait up to 10 seconds for new messages. Any messages that arrive during the streamList request are processed immediately. The plugin adds extra delay after each request to avoid exhausting your quota during your expected stream duration.

**Example calculation with default settings:**

```text
Daily quota: 10,000 units
Safety buffer (80%): 8,000 units available for chat polling
Cost per check: 5 units
Maximum checks per day: 8,000 ÷ 5 = 1,600 checks
Maximum stream hours: 8 hours (28,800 seconds)
StreamList wait time per check: 10 seconds
Time already spent inside checks: 1,600 × 10 = 16,000 seconds
Remaining time between checks: 28,800 - 16,000 = 12,800 seconds
Delay between checks: 12,800 ÷ (1,600 - 1) = 8.005 seconds
```

The streamList call waits up to 10 seconds. If the message comes in during the streamList call, it will show up almost immediately. When the streamList call completes, the plugin waits about 8 seconds before the next call. If a message comes in during this delay, the message will not show up until the next streamList call. This means chat messages may take up to about 8 seconds to appear in Firebot.

## Quota Longevity Examples

How long will your quota last during a stream? Here are some realistic scenarios:

### Scenario 1: Streaming with Default Settings (10,000 quota)

- Stream duration: 4 hours
- Chat messages sent: 50 messages during stream

**Quota breakdown:**

- Checks per hour: 3600 seconds / 10 seconds per check = 360 checks per hour
- Chat polling: 4 hours × 360 checks/hour × 5 units = 7,200 units
- Sending messages: 50 messages × 20 units = 1,000 units
- Other operations: ~200 units
- **Total used: ~8,400 units** (84% of quota)
- Quota lasts: Entire stream with buffer remaining

### Scenario 2: Longer Stream with Default Settings (10,000 quota)

- Stream duration: 8 hours
- Polling delay: ~8 seconds (auto-calculated)
- Chat messages sent: 100 messages during stream

**Quota breakdown:**

- Checks per hour: 3600 seconds / (10 sec per check + 8 sec delay) = 200 checks per hour
- Chat polling: 8 hours × 200 checks/hour × 5 units = 8,000 units
- Sending messages: 100 messages × 20 units = 2,000 units
- Other operations: ~200 units
- **Total used: ~10,200 units** (102% of quota)
- Quota lasts: ~7 hours 45 minutes before exhaustion

### Scenario 3: Longer Stream than Expected (10,000 quota)

- Stream duration (configured): 8 hours
- Stream duration (actual): 4 hours
- Chat messages sent: 150 messages during stream

**Quota breakdown:**

- Checks per hour: 3600 seconds / 10 seconds per check = 360 checks per hour
- Chat polling: 8 hours × 360 checks/hour × 5 units = 14,400 units
- Sending messages: 150 messages × 20 units = 3,000 units
- Other operations: ~200 units
- **Total used: ~17,600 units** (176% of quota)
- Quota was exhausted just over half way through the stream

### Scenario 4: After Quota Increase (50,000 quota)

- Stream duration: 12 hours
- Chat messages sent: 200 messages during stream

**Quota breakdown:**

- Checks per hour: 3600 seconds / (10 sec per check) = 360 checks per hour
- Chat polling: 12 hours × 360 checks/hour × 5 units = 21,600 units
- Sending messages: 200 messages × 20 units = 4,000 units
- Other operations: ~200 units
- **Total used: ~25,800 units** (52% of quota)
- Quota lasts: Entire stream comfortably

## Working Around Quota Limits

If you're running out of quota during streams, here are your options:

### Option 1: Adjust Polling Delay Settings

The plugin allows you to configure two quota-related settings for each application:

**Maximum Stream Hours:** Tell the plugin how long your typical stream lasts. The plugin will space out checks to ensure quota lasts the full duration. Note that if your stream runs over, you may run out of quota before your stream ends.

**Override Polling Delay:** Manually set the extra seconds to wait after each chat message check. Use this if the automatic calculation doesn't fit your needs:

- Shorter delays (0-9 seconds after each poll): More responsive chat but consumes quota faster
- Longer delays (10+ seconds after each poll): Quota lasts longer but chat messages are noticeably delayed

To configure these settings, open the YouTube Integration settings in Firebot and edit your application's quota settings.

### Option 2: Request a Quota Increase from YouTube

YouTube allows developers to request higher quota limits, but approval is **not guaranteed** and requires justification.

**Important considerations:**

- YouTube expects commercial applications or those serving many users
- Personal streaming setups may not qualify for increases
- The request process can take days or weeks
- You must explain why 10,000 units per day is insufficient

**How to request an increase:**

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your YouTube API project
3. Navigate to APIs & Services > YouTube Data API v3 > Quotas
4. Click "Request quota increase"
5. Provide detailed justification for your request

**What to include in your request:**

- Your typical stream duration and frequency
- Number of concurrent viewers (impacts chat message volume)
- Why current quota is insufficient for your use case
- Any unique requirements or special circumstances

Even if you don't get the full amount you request, YouTube may grant a partial increase.

### Option 3: Configure Multiple Applications

The plugin supports multiple YouTube applications, and each application has its own independent daily quota. You can configure multiple applications and switch between them when one runs out of quota.

**How this works:**

1. Create additional Google Cloud projects with YouTube Data API enabled
2. Configure OAuth credentials for each project
3. Add each application to the plugin
4. When quota runs out on one application, manually switch to another
5. The plugin can also automatically switch applications when quota is exhausted (if configured)

**Example setup:**

- Application 1 (Primary): 10,000 quota/day
- Application 2 (Backup): 10,000 quota/day
- Application 3 (Emergency): 10,000 quota/day
- **Total available:** 30,000 quota/day across all applications

**Limitations:**

- Switching applications requires a brief disconnection and reconnection
- You must authorize each application separately
- Managing multiple applications adds complexity
- This approach may violate the letter or the spirit of terms of service (evaluate for yourself)

For setup instructions, see the [Configuration Guide](/doc/configuration.md).

## Viewing Actual Quota Usage in the Google Console

While Google does not expose your actual quota usage via an API, it is possible to see it in the cloud console.

1. Open the [Google Cloud Console quotas page](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas).

    That is a direct link. The navigation sequence is:

    - Navigation menu (3 vertical lines at top left)
    - APIs and Services
    - Enabled APIs & services
    - YouTube Data API v3
    - Quotas & System Limits
    - Queries per day

2. Select the project corresponding to your application from the project picker at the top of the screen

3. Review the "Queries per day" value.

## Best Practices

To make the most of your daily quota:

1. **Set realistic stream duration:** Configure Maximum Stream Hours to match your longest typical stream, not your shortest.

2. **Monitor quota usage:** The plugin displays current quota usage in the settings. Check it periodically during streams.

3. **Minimize sent messages:** Each message you send costs 20 units per chunk. Long messages (over 200 characters) are automatically split into multiple chunks, with each chunk costing 20 units. Use concise messages when possible.

4. **Plan for contingencies:** If you occasionally stream longer than usual, have a backup plan (multiple applications or manual polling delay override).

5. **Test before going live:** Do a test stream to verify your quota settings work for your typical stream length.

6. **Consider your chat volume:** Even with perfect settings, you can only send a limited number of messages. Budget accordingly. Note that messages over 200 characters are automatically chunked, increasing quota costs proportionally.

## Message Chunking

YouTube has a 200-character limit for chat messages. The plugin automatically handles messages that exceed this limit by:

1. **Normalizing whitespace:** Multiple spaces, tabs, and newlines are collapsed into single spaces, which may reduce the message length enough to avoid chunking
2. **Smart splitting:** If the message still exceeds 200 characters, it's split at word boundaries to avoid cutting words in half
3. **Sequential sending:** Each chunk is sent as a separate message, with each chunk costing 20 quota units

**Example:**

- A 600-character message becomes 3 chunks
- Total quota cost: 60 units (3 × 20)
- Chunks appear as separate consecutive messages in YouTube chat

**Tips:**

- Keep messages under 200 characters when possible to minimize quota usage
- Excessive whitespace is automatically cleaned up before chunking
- If chunking occurs, all chunks are sent sequentially (no interleaving with other messages)

## Technical Details

For those interested in the technical implementation:

- Quota tracking persists across Firebot restarts
- The plugin automatically resets quota counters at midnight Pacific Time
- Quota calculations target 80% usage to leave buffer for unexpected operations
- All quota data is stored locally in your Firebot data directory
- The plugin uses gRPC and REST APIs with different quota costs per endpoint
- Quota calculations are all done locally as YouTube does not provide API access to real-time quota consumption
- Message chunking uses a 50% minimum chunk size threshold to prevent tiny fragments

## Additional Resources

- [Google's YouTube API Quota Guide](https://developers.google.com/youtube/v3/getting-started#quota)
- [Understanding YouTube API Quota Limits](https://github.com/ThioJoe/YT-Spammer-Purge/wiki/Understanding-YouTube-API-Quota-Limits)
- [YouTube API Usage Cost Calculator](https://www.getphyllo.com/post/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota)
