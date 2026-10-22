import { type TrelloOAuthClientId, type TrelloOAuthClientSecret, type TrelloOAuthConfig, type TrelloOAuthFactoryConfig } from '@dereekb/trello';
import { type ConfigService } from '@nestjs/config';

export const TRELLO_OAUTH_CLIENT_ID_CONFIG_KEY = 'TRELLO_OAUTH_CLIENT_ID';
export const TRELLO_OAUTH_CLIENT_SECRET_CONFIG_KEY = 'TRELLO_OAUTH_CLIENT_SECRET';

/**
 * The environment-facing shape of the Trello OAuth 2.0 client credentials.
 *
 * Both values are optional here, mirroring the `TRELLO_OAUTH_*` variables they are read from, so a
 * missing variable is reported by {@link TrelloOAuthServiceConfig.assertValidConfig} rather than
 * surfacing as `undefined` further down.
 */
export interface TrelloOAuthServiceApiConfig {
  readonly clientId?: TrelloOAuthClientId;
  readonly clientSecret?: TrelloOAuthClientSecret;
}

/**
 * Configuration for the {@link TrelloOAuthApi}.
 *
 * Describes only the OAuth 2.0 client that performs the per-member authorization-code handoff. The
 * app acting against Trello with a member's token goes through `TrelloApi` in a bearer mode instead.
 */
export abstract class TrelloOAuthServiceConfig {
  readonly trelloOAuth!: TrelloOAuthServiceApiConfig;
  /**
   * Optional configuration for the Trello OAuth client the api builds — a custom fetch handler or error
   * logger.
   */
  readonly factoryConfig?: TrelloOAuthFactoryConfig;

  static assertValidConfig(config: TrelloOAuthServiceConfig) {
    const { trelloOAuth } = config;

    if (!trelloOAuth) {
      throw new Error('TrelloOAuthServiceConfig.trelloOAuth is required');
    } else if (!trelloOAuth.clientId) {
      throw new Error(`TrelloOAuthServiceConfig requires a Trello OAuth client id (${TRELLO_OAUTH_CLIENT_ID_CONFIG_KEY}).`);
    } else if (!trelloOAuth.clientSecret) {
      throw new Error(`TrelloOAuthServiceConfig requires a Trello OAuth client secret (${TRELLO_OAUTH_CLIENT_SECRET_CONFIG_KEY}).`);
    }
  }

  /**
   * Narrows the environment-facing config to the fully-populated {@link TrelloOAuthConfig} the core
   * factory requires, asserting both credentials are present.
   *
   * @param config - The service configuration to read.
   * @returns The validated OAuth client configuration.
   * @throws {Error} When either client credential is missing.
   */
  static assertedTrelloOAuthConfig(config: TrelloOAuthServiceConfig): TrelloOAuthConfig {
    TrelloOAuthServiceConfig.assertValidConfig(config);
    const { clientId, clientSecret } = config.trelloOAuth;
    return { clientId: clientId as TrelloOAuthClientId, clientSecret: clientSecret as TrelloOAuthClientSecret };
  }
}

/**
 * Factory function that creates a {@link TrelloOAuthServiceConfig} from NestJS ConfigService
 * environment variables.
 *
 * Fails at startup rather than at the consent screen: a missing client id otherwise composes an
 * authorize URL carrying `client_id=undefined`.
 *
 * @param configService - The NestJS ConfigService instance.
 * @returns A validated TrelloOAuthServiceConfig.
 * @throws {Error} When either client credential is missing.
 */
export function trelloOAuthServiceConfigFactory(configService: ConfigService): TrelloOAuthServiceConfig {
  const clientId = configService.get<string>(TRELLO_OAUTH_CLIENT_ID_CONFIG_KEY);
  const clientSecret = configService.get<string>(TRELLO_OAUTH_CLIENT_SECRET_CONFIG_KEY);

  const config: TrelloOAuthServiceConfig = {
    trelloOAuth: {
      clientId: clientId || undefined,
      clientSecret: clientSecret || undefined
    }
  };

  TrelloOAuthServiceConfig.assertValidConfig(config);
  return config;
}
