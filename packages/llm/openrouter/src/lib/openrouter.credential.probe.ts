/**
 * OpenRouter's credential probe — `GET {baseUrl}/key`, the free key-metadata endpoint. The chat and decision strategies
 * both run it, because they are the same account.
 */

import { probeLlmCredentialEndpoint, type LlmCredentialProbeParams, type LlmStrategyHealth } from '@dereekb/llm';
import { type Maybe, removeTrailingSlashes } from '@dereekb/util';
import { DEFAULT_LLM_OPENROUTER_BASE_URL } from './openrouter.constants';

/**
 * Config for {@link probeLlmOpenRouterCredential}.
 */
export interface ProbeLlmOpenRouterCredentialParams extends Omit<LlmCredentialProbeParams, 'baseUrl'> {
  /**
   * The endpoint root; defaults to {@link DEFAULT_LLM_OPENROUTER_BASE_URL}. Trailing slashes are removed.
   */
  readonly baseUrl?: Maybe<string>;
}

/**
 * Probe an OpenRouter key with `GET {baseUrl}/key`. A revoked key answers `401 "User not found."`, carried verbatim; a 404
 * stays an error (OpenRouter always implements the endpoint). Never throws.
 *
 * @param config - The strategy id, key, optional base URL, fetch seam and signal.
 * @returns The credential verdict.
 */
export function probeLlmOpenRouterCredential(config: ProbeLlmOpenRouterCredentialParams): Promise<LlmStrategyHealth> {
  const { strategyId, apiKey, fetch, signal } = config;
  const baseUrl = removeTrailingSlashes(config.baseUrl ?? DEFAULT_LLM_OPENROUTER_BASE_URL);
  return probeLlmCredentialEndpoint({ strategyId, url: `${baseUrl}/key`, apiKey, fetch, signal });
}
