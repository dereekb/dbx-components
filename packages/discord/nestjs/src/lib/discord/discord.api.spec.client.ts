import { Events, type TextChannel, ChannelType } from 'discord.js';
import { DiscordApi } from './discord.api';
import { type DiscordServiceConfig } from './discord.config';

/**
 * Shared, process-singleton Discord test client.
 *
 * Integration spec files import {@link getSharedDiscordTestClient} so that at most one
 * `client.login()` call occurs per vitest worker process, regardless of how many spec
 * files participate. This keeps the bot's daily gateway-session quota intact during
 * normal development.
 */
export interface SharedDiscordTestClient {
  readonly discordApi: DiscordApi;
  readonly testChannelId: string;
}

let cachedPromise: Promise<SharedDiscordTestClient> | undefined;
let cleanupRegistered = false;

/**
 * Returns the shared logged-in test client, creating it on first call and reusing it
 * on subsequent calls within the same process.
 *
 * @returns The cached {@link SharedDiscordTestClient}.
 */
export function getSharedDiscordTestClient(): Promise<SharedDiscordTestClient> {
  if (!cachedPromise) {
    cachedPromise = createSharedDiscordTestClient();
    registerCleanupOnce();
  }

  return cachedPromise;
}

function registerCleanupOnce(): void {
  if (cleanupRegistered) {
    return;
  }

  cleanupRegistered = true;
  process.once('beforeExit', () => {
    // Fire-and-forget destroy; the process is exiting and we cannot block on it.
    cachedPromise?.then(({ discordApi }) => discordApi.client.destroy()).catch(() => undefined);
  });
}

async function createSharedDiscordTestClient(): Promise<SharedDiscordTestClient> {
  const botToken = process.env['DISCORD_BOT_TOKEN'] as string;

  const config: DiscordServiceConfig = {
    discord: {
      botToken,
      autoLogin: false
    }
  };

  const discordApi = new DiscordApi(config);
  await discordApi.client.login(botToken);
  await waitForClientReady(discordApi);

  const testChannelId = await resolveTestChannelId(discordApi);

  return { discordApi, testChannelId };
}

function waitForClientReady(discordApi: DiscordApi): Promise<void> {
  return new Promise<void>((resolve) => {
    if (discordApi.client.isReady()) {
      resolve();
    } else {
      discordApi.client.once(Events.ClientReady, () => resolve());
    }
  });
}

async function resolveTestChannelId(discordApi: DiscordApi): Promise<string> {
  const envChannelId = process.env['DISCORD_TEST_CHANNEL_ID'];

  let result: string;

  if (envChannelId) {
    result = envChannelId;
  } else {
    const guild = discordApi.client.guilds.cache.first();

    if (!guild) {
      throw new Error('Bot is not in any guilds. Invite the bot to a server first (see SETUP.md).');
    }

    const channels = await guild.channels.fetch();
    const textChannel = channels.find((ch): ch is TextChannel => ch !== null && ch.type === ChannelType.GuildText);

    if (!textChannel) {
      throw new Error(`No text channels found in guild "${guild.name}".`);
    }

    result = textChannel.id;
  }

  return result;
}
