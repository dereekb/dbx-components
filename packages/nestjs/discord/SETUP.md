# @dereekb/nestjs/discord Setup

## Step 1: Create a Discord Application & Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name, and create it
3. Navigate to **Bot** in the left sidebar
4. Under **Privileged Gateway Intents**, enable:
   - **Message Content Intent** — required to read message content
   - **Server Members Intent** — optional, only if you need member lists
5. Click **Reset Token** and copy the token. This is your `DISCORD_BOT_TOKEN`.
   - You can only see the token once. If you lose it, reset it again.
6. On the **General Information** page, copy the **Public Key**. This is your `DISCORD_PUBLIC_KEY`.
7. On the **General Information** page, copy the **Application ID**. You'll need this to generate the invite URL.

## Step 2: Invite the Bot to Your Server

The bot must be added to a Discord server (guild) before it can read or send messages.

1. Go to **OAuth2** in the left sidebar
2. Under **OAuth2 URL Generator**, check these scopes:
   - `bot`
   - `applications.commands` (if you plan to use slash commands)
3. Under **Bot Permissions** that appears below, check:
   - **Send Messages**
   - **Read Message History**
   - **View Channels**
   - (Add others as needed for your use case)
4. Copy the generated URL at the bottom
5. Open the URL in your browser
6. Select the server you want to add the bot to, and click **Authorize**

If you don't have a server, create one first in the Discord app (click the **+** button in the server list).

## Step 3: Get a Channel ID for Testing

You need a channel ID to send test messages.

1. In Discord, go to **User Settings > Advanced** and enable **Developer Mode**
2. Right-click on any text channel in your server
3. Click **Copy Channel ID**

This gives you a snowflake ID string like `"1234567890123456789"`.

## Step 4: Set Environment Variables

Add these to your `.env` or `.env.local` file:

```env
DISCORD_BOT_TOKEN=your-bot-token-here
DISCORD_PUBLIC_KEY=your-public-key-hex-here
DISCORD_TEST_CHANNEL_ID=your-test-channel-id-here
```

## Step 5: Run the Tests

The unit tests don't require a real bot token — they test the Ed25519 verifier, handler dispatch, config validation, and utility functions using mocks and real crypto.

```bash
pnpm nx test nestjs-discord
```

## Step 6: Integration Testing (Manual)

To test the bot connects and can send/receive messages, you can write a quick integration test or script:

```typescript
import { DiscordApi } from '@dereekb/nestjs/discord';
import { DiscordServiceConfig } from '@dereekb/nestjs/discord';

// Create config
const config: DiscordServiceConfig = {
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN!,
    autoLogin: false // we'll login manually
  }
};

// Create API and login
const api = new DiscordApi(config);
await api.client.login(config.discord.botToken);

// Send a test message (replace with your channel ID)
await api.sendMessage('YOUR_CHANNEL_ID', 'Hello from the bot!');

// Listen for messages
api.onMessage((message) => {
  if (!message.author.bot) {
    console.log(`${message.author.tag}: ${message.content}`);
  }
});
```

## Environment Variables Reference

| Variable | Required By | Description |
|---|---|---|
| `DISCORD_BOT_TOKEN` | `DiscordModule` | Bot token from Developer Portal > Bot > Reset Token |
| `DISCORD_PUBLIC_KEY` | `DiscordWebhookModule` | Public key from Developer Portal > General Information |
| `DISCORD_TEST_CHANNEL_ID` | Integration tests | Channel ID for send/receive tests (see Step 3) |

## Module Usage

```typescript
// Bot only (read/send messages via gateway)
import { DiscordModule } from '@dereekb/nestjs/discord';

@Module({
  imports: [DiscordModule]
})
export class AppModule {}

// Webhook only (receive interaction webhooks, no bot token needed)
import { DiscordWebhookModule } from '@dereekb/nestjs/discord';

@Module({
  imports: [DiscordWebhookModule]
})
export class AppModule extends AppModuleWithWebhooksEnabled {}

// Both
@Module({
  imports: [DiscordModule, DiscordWebhookModule]
})
export class AppModule extends AppModuleWithWebhooksEnabled {}
```

## Webhook Endpoint Setup (Optional)

If using `DiscordWebhookModule` to receive interaction webhooks (slash commands, buttons, etc.):

1. Your server must be publicly accessible (use ngrok for local development)
2. In the Developer Portal, go to **General Information**
3. Set **Interactions Endpoint URL** to `https://your-domain.com/webhook/discord`
4. Discord will send a `PING` verification request when you save — your server must be running
5. The `DiscordWebhookController` handles this automatically at `POST /webhook/discord`
