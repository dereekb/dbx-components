/**
 * The ZenMux adapters — what a host registers in its `LlmAdapterRegistry` so a provider that declares `metering: 'zenmux'`
 * (or points at a ZenMux URL) reads the ZenMux account, and one that declares `decision: 'zenmux'` serves decisions over
 * `/systemone`. ZenMux CHAT is not here: it rides the OpenAI-compatible completion transport.
 */

import { type LlmAdapter, type LlmBillAdapter, type LlmCredentialProbeAdapter, type LlmDecisionAdapter, type LlmMeteringAdapter } from '@dereekb/llm';
import { isNotBlankString, isNotNullOrEmptyString, type Maybe } from '@dereekb/util';
import { isZenmuxBaseUrl, zenmuxAccountBaseUrlOf, ZENMUX_SYNC_COST_BASIS } from './zenmux.account';
import { ZENMUX_DECISION_ROUTE, ZENMUX_PROVIDER_ID } from './zenmux.constants';
import { probeZenmuxCredential } from './zenmux.credential.probe';
import { makeZenmuxDecisionStrategy, ZENMUX_DECISION_STRATEGY_KIND } from './zenmux.decision.strategy';
import { makeZenmuxGenerationBillReader } from './zenmux.generation.bill';
import { makeZenmuxProviderStatusSource } from './zenmux.provider.status';

/**
 * The host secrets the ZenMux account adapters close over. None is read from the environment here.
 */
export interface ZenmuxLlmAdaptersConfig {
  /**
   * The **Management API Key** the account (quota status) reads authenticate with. Absent ⇒ every status read reports
   * `available: false` with an issue naming {@link managementApiKeyEnv}.
   */
  readonly managementApiKey?: Maybe<string>;
  /**
   * WHICH env var supplied {@link managementApiKey} — the label a missing-key report names. Absent ⇒
   * `ZENMUX_MANAGEMENT_API_KEY`.
   */
  readonly managementApiKeyEnv?: Maybe<string>;
  /**
   * The PAY-AS-YOU-GO inference key bills are read with — the one key `management/generation` accepts, and it reads
   * subscription-key calls too. Blank / absent ⇒ each provider's own key.
   */
  readonly billApiKey?: Maybe<string>;
}

/**
 * The ZenMux DECISION adapter — keyed by {@link ZENMUX_DECISION_ROUTE}. It declares no `transports`: a provider must DECLARE
 * `decision: 'zenmux'`, because an OpenAI-transport provider is not on ZenMux by default. The strategy uses the provider's own
 * id, key and EFFECTIVE base URL, since the route lives on the inference endpoint.
 */
export const ZENMUX_DECISION_ADAPTER: LlmDecisionAdapter = {
  facet: 'decision',
  kind: ZENMUX_DECISION_ROUTE,
  strategyKind: ZENMUX_DECISION_STRATEGY_KIND,
  make: ({ provider, baseUrl, fetch, timeoutMs }) =>
    makeZenmuxDecisionStrategy({
      id: provider.id,
      apiKey: provider.apiKey,
      apiKeyEnv: provider.apiKeyEnv,
      ...(baseUrl == null ? {} : { baseUrl }),
      ...(timeoutMs == null ? {} : { timeoutMs }),
      ...(fetch == null ? {} : { probeFetch: fetch })
    })
};

/**
 * The ZenMux CREDENTIAL-PROBE adapter — keyed by {@link ZENMUX_PROVIDER_ID}. Probes the provider's OWN key at its EFFECTIVE
 * base URL with {@link probeZenmuxCredential}; a provider with no key is reported unready without a request.
 */
export const ZENMUX_CREDENTIAL_PROBE_ADAPTER: LlmCredentialProbeAdapter = {
  facet: 'credentialProbe',
  kind: ZENMUX_PROVIDER_ID,
  make:
    ({ provider, baseUrl, fetch }) =>
    async (options) => {
      const apiKey = provider.apiKey;
      return isNotBlankString(apiKey) ? probeZenmuxCredential({ strategyId: provider.id, apiKey, baseUrl, ...(fetch == null ? {} : { fetch }), ...(options?.signal == null ? {} : { signal: options.signal }) }) : { ready: false, issues: [{ severity: 'error', message: 'no apiKey configured' }] };
    }
};

/**
 * Build the ZenMux METERING adapter — keyed by {@link ZENMUX_PROVIDER_ID}. A metered provider's synchronous cost is the LIST
 * amount ({@link ZENMUX_SYNC_COST_BASIS}), an undeclared provider is metered when its URL is ZenMux ({@link isZenmuxBaseUrl}),
 * and its status source reads the account at {@link zenmuxAccountBaseUrlOf} with the closed-over management key.
 *
 * @param config - The management key and its label.
 * @returns The metering adapter.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeZenmuxMeteringAdapter(config: ZenmuxLlmAdaptersConfig = {}): LlmMeteringAdapter {
  const { managementApiKey, managementApiKeyEnv } = config;
  return {
    facet: 'metering',
    kind: ZENMUX_PROVIDER_ID,
    costBasis: ZENMUX_SYNC_COST_BASIS,
    isAccountBaseUrl: isZenmuxBaseUrl,
    make: ({ baseUrl, fetch }) => makeZenmuxProviderStatusSource({ managementApiKey, managementApiKeyEnv, baseUrl: zenmuxAccountBaseUrlOf(baseUrl), ...(fetch == null ? {} : { fetch }) })
  };
}

/**
 * Build the ZenMux BILL adapter — keyed by {@link ZENMUX_PROVIDER_ID}. Reads `management/generation` at
 * {@link zenmuxAccountBaseUrlOf} with the closed-over `billApiKey`, else the provider's own key.
 *
 * Without a `billApiKey`, a SUBSCRIPTION provider's reads fail `HTTP 403: Invalid API key` — that endpoint accepts only the
 * pay-as-you-go key — which is why a host passes its pay-as-you-go key here.
 *
 * @param config - The pay-as-you-go bill key.
 * @returns The bill adapter.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeZenmuxBillAdapter(config: ZenmuxLlmAdaptersConfig = {}): LlmBillAdapter {
  const billApiKey = config.billApiKey?.trim();
  return {
    facet: 'bill',
    kind: ZENMUX_PROVIDER_ID,
    make: ({ provider, baseUrl, fetch }) => makeZenmuxGenerationBillReader({ apiKey: isNotNullOrEmptyString(billApiKey) ? billApiKey : provider.apiKey, baseUrl: zenmuxAccountBaseUrlOf(baseUrl), ...(fetch == null ? {} : { fetch }) })
  };
}

/**
 * Build every ZenMux adapter, in `LLM_ADAPTER_FACETS` order: decision, metering, bill, credential probe.
 *
 * Register this array BEFORE `/openrouter`'s (or pass a `routePreference`) when ZenMux should be the default decision route.
 *
 * ```ts
 * const adapters = makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, ...makeZenmuxLlmAdapters({ managementApiKey, billApiKey })]);
 * ```
 *
 * @param config - The host secrets the account adapters close over.
 * @returns The four ZenMux adapters.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeZenmuxLlmAdapters(config: ZenmuxLlmAdaptersConfig = {}): ReadonlyArray<LlmAdapter> {
  return [ZENMUX_DECISION_ADAPTER, makeZenmuxMeteringAdapter(config), makeZenmuxBillAdapter(config), ZENMUX_CREDENTIAL_PROBE_ADAPTER];
}
