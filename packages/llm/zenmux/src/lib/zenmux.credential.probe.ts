/**
 * The ZenMux credential probe — the only module that knows how to tell a live ZenMux INFERENCE key from a dead one for free.
 */

import { probeLlmCredentialEndpoint, type LlmCredentialProbeParams, type LlmStrategyHealth } from '@dereekb/llm';
import { type Maybe, removeTrailingSlashes } from '@dereekb/util';
import { resolveLlmZenmuxAccountBaseUrl } from './zenmux.account';
import { DEFAULT_LLM_ZENMUX_BASE_URL } from './zenmux.constants';
import { llmZenmuxGenerationUrl } from './zenmux.management';

/**
 * The model id the ZenMux credential probe asks for — one no gateway serves, so a key that passes authentication is refused
 * with `404 invalid_model` and no completion ever runs.
 */
export const LLM_ZENMUX_CREDENTIAL_PROBE_MODEL = 'llm-credential-probe/no-such-model';

/**
 * The generation id the second (pay-as-you-go) probe looks up — never a real one, so a live key reads "not found" and
 * nothing bills.
 */
export const LLM_ZENMUX_CREDENTIAL_PROBE_GENERATION_ID = 'llm-credential-probe';

/**
 * The statuses ZenMux answers a REJECTED inference key with (`403 access_denied` on the completion endpoint, `401` /
 * `403 Invalid API key` on `management/generation`). Any other 4xx means the key authenticated.
 */
export const LLM_ZENMUX_REJECTED_CREDENTIAL_STATUSES: ReadonlyArray<number> = [401, 403];

/**
 * Config for {@link probeLlmZenmuxCredential}.
 */
export interface ProbeLlmZenmuxCredentialParams extends Omit<LlmCredentialProbeParams, 'baseUrl'> {
  /**
   * The ZenMux API base (or a LAN proxy in front of it); defaults to {@link DEFAULT_LLM_ZENMUX_BASE_URL}. Trailing slashes are
   * stripped. The `management/generation` lookup always goes to the ZenMux account base ({@link resolveLlmZenmuxAccountBaseUrl}).
   */
  readonly baseUrl?: Maybe<string>;
}

/**
 * Probe a ZenMux INFERENCE key for liveness, free, in at most two requests.
 *
 * ZenMux's `GET /models` answers 200 to ANY bearer (a made-up key included, measured 2026-11-14), so the generic probe an
 * OpenAI-compatible transport runs could never report a revoked key here. ZenMux has no free GET that tells a live key from a
 * dead one, and its two key types are accepted at DIFFERENT places, so this asks two auth-gated questions and the key is live
 * when EITHER says so:
 *
 * 1. `POST /chat/completions` naming {@link LLM_ZENMUX_CREDENTIAL_PROBE_MODEL}: a live SUBSCRIPTION key gets `404 invalid_model`;
 *    a dead or fake one gets `403 access_denied`.
 * 2. Only when that refused: `GET /management/generation?id=…`, the one endpoint that accepts the PAY-AS-YOU-GO key (a
 *    pay-as-you-go key also 403s the first probe, because its allow-list holds no unknown model). A disabled legacy key is
 *    told apart here: ZenMux's 403 says the legacy keys were disabled on 2026-11-10 and to create a new one.
 *
 * Neither request runs a model or bills. Never throws.
 *
 * @param config - The key, its provider id, and optional base URL / fetch / signal.
 * @returns The credential verdict; a dead key carries both refusals in the provider's own words.
 */
export async function probeLlmZenmuxCredential(config: ProbeLlmZenmuxCredentialParams): Promise<LlmStrategyHealth> {
  const baseUrl = removeTrailingSlashes(config.baseUrl ?? DEFAULT_LLM_ZENMUX_BASE_URL);
  const shared = { strategyId: config.strategyId, apiKey: config.apiKey, rejectedStatuses: LLM_ZENMUX_REJECTED_CREDENTIAL_STATUSES, fetch: config.fetch, signal: config.signal };
  const completions = await probeLlmCredentialEndpoint({ ...shared, url: `${baseUrl}/chat/completions`, postBody: JSON.stringify({ model: LLM_ZENMUX_CREDENTIAL_PROBE_MODEL, messages: [{ role: 'user', content: '.' }], max_tokens: 1 }) });
  let health: LlmStrategyHealth = completions;

  if (!completions.ready) {
    const generation = await probeLlmCredentialEndpoint({ ...shared, url: llmZenmuxGenerationUrl(resolveLlmZenmuxAccountBaseUrl(baseUrl), LLM_ZENMUX_CREDENTIAL_PROBE_GENERATION_ID) });
    health = generation.ready ? generation : { ready: false, issues: [...completions.issues, ...generation.issues] };
  }

  return health;
}
