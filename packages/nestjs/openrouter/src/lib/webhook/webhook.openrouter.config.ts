import { type Maybe } from '@dereekb/util';
import { type OpenRouterWebhookSecret } from '../openrouter.type';

export const OPENROUTER_WEBHOOK_SECRET_TOKEN_ENV_VAR = 'OPENROUTER_WEBHOOK_SECRET_TOKEN';
export const OPENROUTER_WEBHOOK_HEADER_ENV_VAR = 'OPENROUTER_WEBHOOK_HEADER';
export const OPENROUTER_WEBHOOK_SCHEME_ENV_VAR = 'OPENROUTER_WEBHOOK_SCHEME';

/**
 * Default request header that carries the OpenRouter webhook secret.
 *
 * OpenRouter broadcast webhooks send a user-configured header (commonly `Authorization`)
 * verbatim with each request. Express lower-cases incoming header names.
 */
export const DEFAULT_OPENROUTER_WEBHOOK_HEADER = 'authorization';

/**
 * Default scheme prefix expected on the secret-bearing header value (e.g. `Bearer <secret>`).
 */
export const DEFAULT_OPENROUTER_WEBHOOK_SCHEME = 'Bearer';

export interface OpenRouterWebhookConfig {
  /**
   * The expected shared secret token sent by OpenRouter on each webhook request.
   */
  readonly webhookSecret: OpenRouterWebhookSecret;
  /**
   * The header that carries the secret. Defaults to {@link DEFAULT_OPENROUTER_WEBHOOK_HEADER}.
   */
  readonly header?: Maybe<string>;
  /**
   * The scheme prefix stripped from the header value before comparison (e.g. `Bearer`).
   *
   * Defaults to {@link DEFAULT_OPENROUTER_WEBHOOK_SCHEME}. Set to an empty string or null to
   * compare the raw header value with no prefix stripping.
   */
  readonly scheme?: Maybe<string>;
}

/**
 * Configuration for OpenRouterWebhookService.
 */
export abstract class OpenRouterWebhookServiceConfig {
  readonly openrouterWebhook!: OpenRouterWebhookConfig;

  static assertValidConfig(config: OpenRouterWebhookServiceConfig) {
    if (!config.openrouterWebhook.webhookSecret) {
      throw new Error('No OpenRouter webhook secret specified.');
    }
  }
}
