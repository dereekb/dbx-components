import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type OpenRouterApiKey, type OpenRouterRetryConfig, type OpenRouterServerUrl } from './openrouter.type';

/**
 * Default environment variable for the OpenRouter API key.
 */
export const OPENROUTER_API_KEY_ENV_VAR = 'OPENROUTER_API_KEY';

/**
 * Optional environment variable for overriding the OpenRouter server/base URL.
 *
 * This workspace's name, read first.
 */
export const OPENROUTER_SERVER_URL_ENV_VAR = 'OPENROUTER_SERVER_URL';

/**
 * `@openrouter/sdk`'s own variable for the server/base URL, read after `OPENROUTER_SERVER_URL_ENV_VAR`.
 *
 * The SDK already falls back to it when no `serverURL` is passed; reading it here makes that order explicit.
 */
export const OPENROUTER_BASE_URL_ENV_VAR = 'OPENROUTER_BASE_URL';

export interface OpenRouterServiceApiConfig {
  /**
   * API key used to authenticate requests to OpenRouter.
   */
  readonly apiKey: OpenRouterApiKey;
  /**
   * Optional override for the OpenRouter server/base URL.
   *
   * Maps to the SDK's `serverURL` option. When omitted, the SDK reads `OPENROUTER_BASE_URL` from the environment, then
   * uses its production server (`https://openrouter.ai/api/v1`).
   */
  readonly serverURL?: OpenRouterServerUrl | undefined;
  /**
   * The client's per-attempt request timeout in milliseconds (the SDK's `timeoutMs`). It applies to a request that sets
   * no `timeoutMs` of its own and carries no `signal`: the SDK ignores it when a signal is set. `@dereekb/openrouter`
   * passes a prompt's `requestTimeoutMs` per request when one is configured.
   *
   * Unset by default: the SDK then sets no timeout.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
  /**
   * The client's retry policy (the SDK's `retryConfig`). It applies to a request that sets no `retries` of its own.
   * `@dereekb/openrouter`'s request functions send `retries: { strategy: 'none' }` unless their caller passes
   * `retries`, so this reaches only calls made on the client directly.
   *
   * Unset keeps the SDK's default: backoff on 5xx, connection errors and timeouts, for up to an hour.
   */
  readonly retryConfig?: Maybe<OpenRouterRetryConfig>;
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
