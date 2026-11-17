import { type LlmAdapter, type LlmCompletionAdapter, type LlmCompletionAdapterConfig } from '@dereekb/llm';
import { DEFAULT_LLM_OPENAI_BASE_URL, LLM_OPENAI_STRATEGY_KIND, makeLlmOpenAiStrategy, type LlmOpenAiStrategyConfig } from './openai.strategy';

/**
 * Map one completion adapter config (what `makeLlmProviderStrategy` resolved for a provider) onto
 * {@link LlmOpenAiStrategyConfig}. Every key is a conditional spread, so an absent input leaves its key absent and the
 * strategy's own default applies.
 *
 * | strategy key | from |
 * |---|---|
 * | `id` / `apiKey` | `provider.id` / `provider.apiKey` |
 * | `baseUrl`, `defaultModel`, `maxOutputTokens`, `timeoutMs` | the same names (`baseUrl` is already the effective one) |
 * | `tokenLimitParam` | `provider.tokenLimitParam` |
 * | `reasoningOffEncoding` | `provider.reasoningOff` (the provider-level fallback) |
 * | `reasoningOffByModel`, `visionByModel`, `costBasis`, `providerStatusSource` | the same names |
 * | `usageAccounting` | `provider.usageAccounting` |
 * | `credentialProbeSource` / `probeFetch` | `credentialProbe` / `fetch` |
 *
 * Exported so a host can extend an adapter-built config in its own adapter — e.g. a browser app holding the user's own
 * key: `{ ...llmOpenAiStrategyConfigOf(config), dangerouslyAllowBrowser: true }`. The stock adapter never sets it.
 *
 * @param config - The resolved completion adapter config.
 * @returns The strategy config.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function llmOpenAiStrategyConfigOf(config: LlmCompletionAdapterConfig): LlmOpenAiStrategyConfig {
  const { provider, baseUrl, defaultModel, maxOutputTokens, timeoutMs, reasoningOffByModel, visionByModel, costBasis, providerStatusSource, credentialProbe, fetch } = config;
  return {
    id: provider.id,
    apiKey: provider.apiKey,
    ...(baseUrl == null ? {} : { baseUrl }),
    ...(defaultModel == null ? {} : { defaultModel }),
    ...(maxOutputTokens == null ? {} : { maxOutputTokens }),
    ...(timeoutMs == null ? {} : { timeoutMs }),
    ...(provider.tokenLimitParam == null ? {} : { tokenLimitParam: provider.tokenLimitParam }),
    ...(provider.reasoningOff == null ? {} : { reasoningOffEncoding: provider.reasoningOff }),
    ...(reasoningOffByModel == null ? {} : { reasoningOffByModel }),
    ...(visionByModel == null ? {} : { visionByModel }),
    ...(provider.usageAccounting == null ? {} : { usageAccounting: provider.usageAccounting }),
    ...(costBasis == null ? {} : { costBasis }),
    ...(providerStatusSource == null ? {} : { providerStatusSource }),
    ...(credentialProbe == null ? {} : { credentialProbeSource: credentialProbe }),
    ...(fetch == null ? {} : { probeFetch: fetch })
  };
}

/**
 * The completion adapter for the `openai` transport: builds {@link makeLlmOpenAiStrategy} for every provider whose
 * `transport` is `'openai'`, defaulting its base URL to bare OpenAI.
 */
export const LLM_OPENAI_COMPLETION_ADAPTER: LlmCompletionAdapter = {
  facet: 'completion',
  kind: LLM_OPENAI_STRATEGY_KIND,
  defaultBaseUrl: DEFAULT_LLM_OPENAI_BASE_URL,
  make: (config) => makeLlmOpenAiStrategy(llmOpenAiStrategyConfigOf(config))
};

/**
 * Every adapter `@dereekb/llm/openai` contributes — seed a registry with it:
 * `makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, …])`.
 */
export const LLM_OPENAI_ADAPTERS: ReadonlyArray<LlmAdapter> = [LLM_OPENAI_COMPLETION_ADAPTER];
