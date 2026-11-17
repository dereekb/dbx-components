import { type LlmAdapter, type LlmCompletionAdapter, type LlmCompletionAdapterConfig, type LlmDecisionAdapter, type LlmDecisionAdapterConfig } from '@dereekb/llm';
import { LLM_OPENROUTER_DECISION_STRATEGY_KIND, makeLlmOpenRouterDecisionStrategy, type LlmOpenRouterDecisionStrategyConfig } from './openrouter.decision';
import { LLM_OPENROUTER_BASE_URL, LLM_OPENROUTER_STRATEGY_KIND, makeLlmOpenRouterStrategy, type LlmOpenRouterStrategyConfig } from './openrouter.strategy';

/**
 * Map one completion adapter config onto {@link LlmOpenRouterStrategyConfig}: `id` / `apiKey` from the provider, then
 * `baseUrl`, `defaultModel`, `maxOutputTokens`, `timeoutMs`, `visionByModel`, `costBasis`, `providerStatusSource`,
 * `credentialProbeSource` (from `credentialProbe`) and `probeFetch` (from `fetch`), each a conditional spread.
 *
 * It deliberately IGNORES `reasoningOffByModel` and the provider's `reasoningOff`, `tokenLimitParam` and
 * `usageAccounting`: the OpenRouter wire has one spelling for each (the nested `reasoning` object carries
 * `enabled: false`; the cap is always `max_tokens`; accounting is always on).
 *
 * Exported so a host can extend an adapter-built config in its own adapter (e.g. `dangerouslyAllowBrowser: true` for a
 * browser app holding the user's own key); the stock adapter never sets it.
 *
 * @param config - The resolved completion adapter config.
 * @returns The strategy config.
 * @__NO_SIDE_EFFECTS__
 */
export function llmOpenRouterStrategyConfigOf(config: LlmCompletionAdapterConfig): LlmOpenRouterStrategyConfig {
  const { provider, baseUrl, defaultModel, maxOutputTokens, timeoutMs, visionByModel, costBasis, providerStatusSource, credentialProbe, fetch } = config;
  return {
    id: provider.id,
    apiKey: provider.apiKey,
    ...(baseUrl == null ? {} : { baseUrl }),
    ...(defaultModel == null ? {} : { defaultModel }),
    ...(maxOutputTokens == null ? {} : { maxOutputTokens }),
    ...(timeoutMs == null ? {} : { timeoutMs }),
    ...(visionByModel == null ? {} : { visionByModel }),
    ...(costBasis == null ? {} : { costBasis }),
    ...(providerStatusSource == null ? {} : { providerStatusSource }),
    ...(credentialProbe == null ? {} : { credentialProbeSource: credentialProbe }),
    ...(fetch == null ? {} : { probeFetch: fetch })
  };
}

/**
 * Map one decision adapter config onto {@link LlmOpenRouterDecisionStrategyConfig}: `id` / `apiKey` from the provider,
 * then `baseUrl`, `timeoutMs` and `probeFetch` (from `fetch`), each a conditional spread.
 *
 * @param config - The resolved decision adapter config.
 * @returns The strategy config.
 * @__NO_SIDE_EFFECTS__
 */
export function llmOpenRouterDecisionStrategyConfigOf(config: LlmDecisionAdapterConfig): LlmOpenRouterDecisionStrategyConfig {
  const { provider, baseUrl, timeoutMs, fetch } = config;
  return {
    id: provider.id,
    apiKey: provider.apiKey,
    ...(baseUrl == null ? {} : { baseUrl }),
    ...(timeoutMs == null ? {} : { timeoutMs }),
    ...(fetch == null ? {} : { probeFetch: fetch })
  };
}

/**
 * The completion adapter for the `openrouter` transport: builds {@link makeLlmOpenRouterStrategy} for every provider
 * whose `transport` is `'openrouter'`, defaulting its base URL to OpenRouter's.
 */
export const LLM_OPENROUTER_COMPLETION_ADAPTER: LlmCompletionAdapter = {
  facet: 'completion',
  kind: LLM_OPENROUTER_STRATEGY_KIND,
  defaultBaseUrl: LLM_OPENROUTER_BASE_URL,
  make: (config) => makeLlmOpenRouterStrategy(llmOpenRouterStrategyConfigOf(config))
};

/**
 * The decision adapter for the `openrouter` decision route: builds {@link makeLlmOpenRouterDecisionStrategy}. Its
 * `transports` is what lets the root derive the route for every `openrouter`-transport provider that declares no
 * `decision` of its own.
 */
export const LLM_OPENROUTER_DECISION_ADAPTER: LlmDecisionAdapter = {
  facet: 'decision',
  kind: LLM_OPENROUTER_STRATEGY_KIND,
  strategyKind: LLM_OPENROUTER_DECISION_STRATEGY_KIND,
  transports: [LLM_OPENROUTER_STRATEGY_KIND],
  make: (config) => makeLlmOpenRouterDecisionStrategy(llmOpenRouterDecisionStrategyConfigOf(config))
};

/**
 * Every adapter `@dereekb/llm/openrouter` contributes — seed a registry with it:
 * `makeLlmAdapterRegistry([...LLM_OPENROUTER_ADAPTERS, …])`.
 */
export const LLM_OPENROUTER_ADAPTERS: ReadonlyArray<LlmAdapter> = [LLM_OPENROUTER_COMPLETION_ADAPTER, LLM_OPENROUTER_DECISION_ADAPTER];
