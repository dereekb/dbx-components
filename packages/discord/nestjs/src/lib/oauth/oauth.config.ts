import { type DiscordOAuthClientId, type DiscordOAuthClientSecret, type DiscordOAuthConfig, type DiscordOAuthFactoryConfig } from '@dereekb/discord';
import { type ConfigService } from '@nestjs/config';

export const DISCORD_SERVICE_NAME = 'discord';
export const DISCORD_CLIENT_ID_CONFIG_KEY = 'DISCORD_CLIENT_ID';
export const DISCORD_CLIENT_SECRET_CONFIG_KEY = 'DISCORD_CLIENT_SECRET';

/**
 * The environment-facing shape of the Discord OAuth client credentials.
 *
 * Both values are optional here, mirroring the `DISCORD_*` variables they are read from, so a missing
 * variable is reported by {@link DiscordOAuthServiceConfig.assertValidConfig} rather than surfacing as
 * `undefined` further down.
 */
export interface DiscordOAuthServiceApiConfig {
  readonly clientId?: DiscordOAuthClientId;
  readonly clientSecret?: DiscordOAuthClientSecret;
}

/**
 * Configuration for the {@link DiscordOAuthApi}.
 *
 * Carries no server-level token or access-token cache, unlike `CalcomOAuthServiceConfig`: Discord has
 * no api-key alternative to the client-credentials pair, and the app acting as *itself* against
 * Discord authenticates with a bot token through `DiscordServiceConfig` and discord.js instead. This
 * config only ever describes the OAuth client that performs the per-user authorization-code handoff.
 */
export abstract class DiscordOAuthServiceConfig {
  readonly discordOAuth!: DiscordOAuthServiceApiConfig;
  /**
   * Optional configuration for the Discord OAuth client the api builds — a custom fetch handler or
   * error logger.
   */
  readonly factoryConfig?: DiscordOAuthFactoryConfig;

  static assertValidConfig(config: DiscordOAuthServiceConfig) {
    const { discordOAuth } = config;

    if (!discordOAuth) {
      throw new Error('DiscordOAuthServiceConfig.discordOAuth is required');
    } else if (!discordOAuth.clientId) {
      throw new Error(`DiscordOAuthServiceConfig requires a Discord OAuth client id (${DISCORD_CLIENT_ID_CONFIG_KEY}).`);
    } else if (!discordOAuth.clientSecret) {
      throw new Error(`DiscordOAuthServiceConfig requires a Discord OAuth client secret (${DISCORD_CLIENT_SECRET_CONFIG_KEY}).`);
    }
  }

  /**
   * Narrows the environment-facing config to the fully-populated {@link DiscordOAuthConfig} the core
   * factory requires, asserting both credentials are present.
   *
   * @param config - The service configuration to read.
   * @returns The validated OAuth client configuration.
   * @throws {Error} When either client credential is missing.
   */
  static assertedDiscordOAuthConfig(config: DiscordOAuthServiceConfig): DiscordOAuthConfig {
    DiscordOAuthServiceConfig.assertValidConfig(config);
    const { clientId, clientSecret } = config.discordOAuth;
    return { clientId: clientId as DiscordOAuthClientId, clientSecret: clientSecret as DiscordOAuthClientSecret };
  }
}

/**
 * Factory function that creates a {@link DiscordOAuthServiceConfig} from NestJS ConfigService
 * environment variables.
 *
 * Fails at startup rather than at the consent screen: a missing client id otherwise composes an
 * authorize URL carrying `client_id=undefined`, and a missing secret fails the exchange only after the
 * user has already consented.
 *
 * @param configService - The NestJS ConfigService instance.
 * @returns A validated DiscordOAuthServiceConfig.
 * @throws {Error} When either client credential is missing.
 */
export function discordOAuthServiceConfigFactory(configService: ConfigService): DiscordOAuthServiceConfig {
  const clientId = configService.get<string>(DISCORD_CLIENT_ID_CONFIG_KEY);
  const clientSecret = configService.get<string>(DISCORD_CLIENT_SECRET_CONFIG_KEY);

  const config: DiscordOAuthServiceConfig = {
    discordOAuth: {
      clientId: clientId || undefined,
      clientSecret: clientSecret || undefined
    }
  };

  DiscordOAuthServiceConfig.assertValidConfig(config);
  return config;
}
