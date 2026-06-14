import { type OpenRouterApiKey, type OpenRouterServerUrl } from './openrouter.type';

/**
 * Default environment variable for the OpenRouter API key.
 */
export const OPENROUTER_API_KEY_ENV_VAR = 'OPENROUTER_API_KEY';

/**
 * Optional environment variable for overriding the OpenRouter server/base URL.
 */
export const OPENROUTER_SERVER_URL_ENV_VAR = 'OPENROUTER_SERVER_URL';

export interface OpenRouterServiceApiConfig {
  /**
   * API key used to authenticate requests to OpenRouter.
   */
  readonly apiKey: OpenRouterApiKey;
  /**
   * Optional override for the OpenRouter server/base URL.
   *
   * Maps to the SDK's `serverURL` option. When omitted the SDK's default
   * production server (`https://openrouter.ai/api/v1`) is used.
   */
  readonly serverURL?: OpenRouterServerUrl;
}

/**
 * Configuration for OpenRouterApi.
 */
export abstract class OpenRouterServiceConfig {
  readonly openrouter!: OpenRouterServiceApiConfig;

  static assertValidConfig(config: OpenRouterServiceConfig) {
    if (!config.openrouter.apiKey) {
      throw new Error('No OpenRouter API key specified.');
    }
  }
}
