import { type TrelloConfig, type TrelloFactoryConfig } from '@dereekb/trello';

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
    if (!config.trello.apiKey) {
      throw new Error('No Trello API key specified.');
    }

    if (!config.trello.apiToken) {
      throw new Error('No Trello API token specified.');
    }
  }
}
