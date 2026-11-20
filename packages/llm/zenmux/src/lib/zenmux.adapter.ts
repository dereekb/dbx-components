/**
 * The ZenMux adapters — what a host registers in its `LlmAdapterRegistry` so a provider that declares `metering: 'zenmux'`
 * (or points at a ZenMux URL) reads the ZenMux account, and one that declares `decision: 'zenmux'` serves decisions over
 * `/systemone`. ZenMux CHAT is not here: it rides the OpenAI-compatible completion transport.
 */

import { toLlmSystemOneDecisionStrategyConfig, type LlmAdapter, type LlmBillAdapter, type LlmCredentialProbeAdapter, type LlmDecisionAdapter, type LlmMeteringAdapter } from '@dereekb/llm';
import { isNotBlankString, isNotNullOrEmptyString, type Maybe } from '@dereekb/util';
import { isLlmZenmuxBaseUrl, resolveLlmZenmuxAccountBaseUrl, LLM_ZENMUX_SYNC_COST_BASIS } from './zenmux.account';
import { LLM_ZENMUX_DECISION_ROUTE, LLM_ZENMUX_PROVIDER_ID } from './zenmux.constants';
import { probeLlmZenmuxCredential } from './zenmux.credential.probe';
import { makeLlmZenmuxDecisionStrategy, LLM_ZENMUX_DECISION_STRATEGY_KIND } from './zenmux.decision.strategy';
import { makeLlmZenmuxGenerationBillReader } from './zenmux.generation.bill';
import { makeLlmZenmuxProviderStatusSource, type LlmZenmuxProviderStatusSourceConfig } from './zenmux.provider.status';

/**
 * The host secrets the ZenMux account adapters close over. None is read from the environment here.
 */
export interface LlmZenmuxAdaptersConfig extends Pick<LlmZenmuxProviderStatusSourceConfig, 'managementApiKey' | 'managementApiKeyEnv'> {
  /**
   * The PAY-AS-YOU-GO inference key bills are read with — the one key `management/generation` accepts, and it reads
   * subscription-key calls too. Blank / absent ⇒ each provider's own key.
   */
  readonly billApiKey?: Maybe<string>;
}

/**
 * The ZenMux DECISION adapter — keyed by {@link LLM_ZENMUX_DECISION_ROUTE}. It declares no `transports`: a provider must DECLARE
 * `decision: 'zenmux'`, because an OpenAI-transport provider is not on ZenMux by default. The strategy uses the provider's own
 * id, key and EFFECTIVE base URL, since the route lives on the inference endpoint.
 */
export const LLM_ZENMUX_DECISION_ADAPTER: LlmDecisionAdapter = {
  facet: 'decision',
  kind: LLM_ZENMUX_DECISION_ROUTE,
  strategyKind: LLM_ZENMUX_DECISION_STRATEGY_KIND,
  make: (config) => makeLlmZenmuxDecisionStrategy({ ...toLlmSystemOneDecisionStrategyConfig(config), apiKeyEnv: config.provider.apiKeyEnv })
};

/**
 * The ZenMux CREDENTIAL-PROBE adapter — keyed by {@link LLM_ZENMUX_PROVIDER_ID}. Probes the provider's OWN key at its EFFECTIVE
 * base URL with {@link probeLlmZenmuxCredential}; a provider with no key is reported unready without a request.
 */
export const LLM_ZENMUX_CREDENTIAL_PROBE_ADAPTER: LlmCredentialProbeAdapter = {
  facet: 'credentialProbe',
  kind: LLM_ZENMUX_PROVIDER_ID,
  make:
    ({ provider, baseUrl, fetch }) =>
    async (options) => {
      const apiKey = provider.apiKey;
      return isNotBlankString(apiKey) ? probeLlmZenmuxCredential({ strategyId: provider.id, apiKey, baseUrl, ...(fetch == null ? {} : { fetch }), ...(options?.signal == null ? {} : { signal: options.signal }) }) : { ready: false, issues: [{ severity: 'error', message: 'no apiKey configured' }] };
    }
};

/**
 * Build the ZenMux METERING adapter — keyed by {@link LLM_ZENMUX_PROVIDER_ID}. A metered provider's synchronous cost is the LIST
 * amount ({@link LLM_ZENMUX_SYNC_COST_BASIS}), an undeclared provider is metered when its URL is ZenMux ({@link isLlmZenmuxBaseUrl}),
 * and its status source reads the account at {@link resolveLlmZenmuxAccountBaseUrl} with the closed-over management key.
 *
 * @param config - The management key and its label.
 * @returns The metering adapter.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmZenmuxMeteringAdapter(config: LlmZenmuxAdaptersConfig = {}): LlmMeteringAdapter {
  const { managementApiKey, managementApiKeyEnv } = config;
  return {
    facet: 'metering',
    kind: LLM_ZENMUX_PROVIDER_ID,
    costBasis: LLM_ZENMUX_SYNC_COST_BASIS,
    isAccountBaseUrl: isLlmZenmuxBaseUrl,
    make: ({ baseUrl, fetch }) => makeLlmZenmuxProviderStatusSource({ managementApiKey, managementApiKeyEnv, baseUrl: resolveLlmZenmuxAccountBaseUrl(baseUrl), ...(fetch == null ? {} : { fetch }) })
  };
}

/**
 * Build the ZenMux BILL adapter — keyed by {@link LLM_ZENMUX_PROVIDER_ID}. Reads `management/generation` at
 * {@link resolveLlmZenmuxAccountBaseUrl} with the closed-over `billApiKey`, else the provider's own key.
 *
 * Without a `billApiKey`, a SUBSCRIPTION provider's reads fail `HTTP 403: Invalid API key` — that endpoint accepts only the
 * pay-as-you-go key — which is why a host passes its pay-as-you-go key here.
 *
 * @param config - The pay-as-you-go bill key.
 * @returns The bill adapter.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmZenmuxBillAdapter(config: LlmZenmuxAdaptersConfig = {}): LlmBillAdapter {
  const billApiKey = config.billApiKey?.trim();
  return {
    facet: 'bill',
    kind: LLM_ZENMUX_PROVIDER_ID,
    make: ({ provider, baseUrl, fetch }) => makeLlmZenmuxGenerationBillReader({ apiKey: isNotNullOrEmptyString(billApiKey) ? billApiKey : provider.apiKey, baseUrl: resolveLlmZenmuxAccountBaseUrl(baseUrl), ...(fetch == null ? {} : { fetch }) })
  };
}

/**
 * Build every ZenMux adapter, in facet order: decision, metering, bill, credential probe.
 *
 * Register this array BEFORE `/openrouter`'s (or pass a `routePreference`) when ZenMux should be the default decision route.
 *
 * ```ts
 * const adapters = makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, ...makeLlmZenmuxAdapters({ managementApiKey, billApiKey })]);
 * ```
 *
 * @param config - The host secrets the account adapters close over.
 * @returns The four ZenMux adapters.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmZenmuxAdapters(config: LlmZenmuxAdaptersConfig = {}): ReadonlyArray<LlmAdapter> {
  return [LLM_ZENMUX_DECISION_ADAPTER, makeLlmZenmuxMeteringAdapter(config), makeLlmZenmuxBillAdapter(config), LLM_ZENMUX_CREDENTIAL_PROBE_ADAPTER];
}
