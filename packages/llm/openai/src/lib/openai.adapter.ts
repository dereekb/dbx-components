import { type LlmAdapter, type LlmCompletionAdapter, type LlmCompletionAdapterConfig } from '@dereekb/llm';
import { type LlmOpenAiCompatibleChatStrategyConfig } from './openai.compatible.strategy';
import { DEFAULT_LLM_OPENAI_BASE_URL, LLM_OPENAI_STRATEGY_KIND, makeLlmOpenAiStrategy, type LlmOpenAiStrategyConfig } from './openai.strategy';

/**
 * Map one completion adapter config onto the shared {@link LlmOpenAiCompatibleChatStrategyConfig}: `id` / `apiKey` from
 * the provider, then `baseUrl`, `defaultModel`, `maxOutputTokens`, `timeoutMs`, `visionByModel`, `costBasis`,
 * `providerStatusSource`, `credentialProbeSource` (from `credentialProbe`) and `probeFetch` (from `fetch`), each passed
 * through, so an unset input arrives nullish and the strategy's own default applies (it reads each with `??`).
 *
 * Every OpenAI-compatible completion adapter starts from it: the OpenRouter adapter uses it as is (its wire has one
 * spelling for the reasoning OFF, the cap and accounting), and {@link toLlmOpenAiStrategyConfig} adds the OpenAI extras.
 *
 * Exported so a host can extend an adapter-built config in its own adapter (e.g. `dangerouslyAllowBrowser: true` for a
 * browser app holding the user's own key); the stock adapters never set it.
 *
 * @param config - The resolved completion adapter config.
 * @returns The strategy config.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toLlmOpenAiCompatibleChatStrategyConfig(config: LlmCompletionAdapterConfig): LlmOpenAiCompatibleChatStrategyConfig {
  const { provider, baseUrl, defaultModel, maxOutputTokens, timeoutMs, visionByModel, costBasis, providerStatusSource, credentialProbe, fetch } = config;
  return {
    id: provider.id,
    apiKey: provider.apiKey,
    baseUrl,
    defaultModel,
    maxOutputTokens,
    timeoutMs,
    visionByModel,
    costBasis,
    providerStatusSource,
    credentialProbeSource: credentialProbe,
    probeFetch: fetch
  };
}

/**
 * Map one completion adapter config onto {@link LlmOpenAiStrategyConfig}: {@link toLlmOpenAiCompatibleChatStrategyConfig}
 * plus the OpenAI extras, each passed through.
 *
 * | strategy key | from |
 * |---|---|
 * | the shared keys | {@link toLlmOpenAiCompatibleChatStrategyConfig} |
 * | `tokenLimitParam` | `provider.tokenLimitParam` |
 * | `reasoningOffEncoding` | `provider.reasoningOff` (the provider-level fallback) |
 * | `reasoningOffByModel` | the same name |
 * | `usageAccounting` | `provider.usageAccounting` |
 *
 * Exported so a host can extend an adapter-built config in its own adapter — e.g. a browser app holding the user's own
 * key: `{ ...toLlmOpenAiStrategyConfig(config), dangerouslyAllowBrowser: true }`. The stock adapter never sets it.
 *
 * @param config - The resolved completion adapter config.
 * @returns The strategy config.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toLlmOpenAiStrategyConfig(config: LlmCompletionAdapterConfig): LlmOpenAiStrategyConfig {
  const { provider, reasoningOffByModel } = config;
  return {
    ...toLlmOpenAiCompatibleChatStrategyConfig(config),
    tokenLimitParam: provider.tokenLimitParam,
    reasoningOffEncoding: provider.reasoningOff,
    reasoningOffByModel,
    usageAccounting: provider.usageAccounting
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
  make: (config) => makeLlmOpenAiStrategy(toLlmOpenAiStrategyConfig(config))
};

/**
 * Every adapter `@dereekb/llm/openai` contributes — seed a registry with it:
 * `makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, …])`.
 */
export const LLM_OPENAI_ADAPTERS: ReadonlyArray<LlmAdapter> = [LLM_OPENAI_COMPLETION_ADAPTER];
