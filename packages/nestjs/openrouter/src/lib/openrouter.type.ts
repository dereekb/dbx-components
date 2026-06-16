import { type OpenRouter } from '@openrouter/sdk';

/**
 * Api key used by OpenRouter for making requests.
 */
export type OpenRouterApiKey = string;

/**
 * Override for the OpenRouter server/base URL (maps to the SDK's `serverURL` option).
 */
export type OpenRouterServerUrl = string;

/**
 * Shared secret used to authenticate incoming OpenRouter broadcast webhook requests.
 *
 * OpenRouter broadcast webhooks have no HMAC signature scheme; instead the secret is
 * sent verbatim in a user-configured request header.
 */
export type OpenRouterWebhookSecret = string;

/**
 * The OpenRouter SDK client type.
 */
export type OpenRouterClient = OpenRouter;

/**
 * A generation id returned by OpenRouter for a completed request.
 */
export type OpenRouterGenerationId = string;

/**
 * A model slug/id as used by OpenRouter (e.g. `openai/gpt-4o`).
 */
export type OpenRouterModelId = string;
