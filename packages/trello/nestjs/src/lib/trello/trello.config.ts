import { type TrelloConfig, type TrelloFactoryConfig, isTrelloAccessTokenConfig, isTrelloAccessTokenProviderConfig } from '@dereekb/trello';

export const TRELLO_API_KEY_ENV_VAR = 'TRELLO_API_KEY';
export const TRELLO_API_TOKEN_ENV_VAR = 'TRELLO_API_TOKEN';

export type TrelloServiceApiConfig = TrelloConfig;

/**
 * Configuration for TrelloApi.
 */
export abstract class TrelloServiceConfig {
  readonly trello!: TrelloServiceApiConfig;
  readonly factoryConfig?: TrelloFactoryConfig;

  static assertValidConfig(config: TrelloServiceConfig) {
    const { trello } = config;

    // a provider mode has nothing to check up front: the provider is validated when it is called
    if (isTrelloAccessTokenConfig(trello)) {
      if (!trello.accessToken) {
        throw new Error('No Trello OAuth 2.0 access token specified.');
      }
    } else if (!isTrelloAccessTokenProviderConfig(trello)) {
      if (!trello.apiKey) {
        throw new Error('No Trello API key specified.');
      }

      if (!trello.apiToken) {
        throw new Error('No Trello API token specified.');
      }
    }
  }
}
