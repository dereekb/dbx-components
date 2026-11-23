import { toLlmSystemOneDecisionStrategyConfig, type LlmAdapter, type LlmCompletionAdapter, type LlmDecisionAdapter } from '@dereekb/llm';
import { toLlmOpenAiCompatibleChatStrategyConfig } from '@dereekb/llm/openai';
import { DEFAULT_LLM_OPENROUTER_BASE_URL } from './openrouter.constants';
import { LLM_OPENROUTER_DECISION_STRATEGY_KIND, makeLlmOpenRouterDecisionStrategy } from './openrouter.decision';
import { LLM_OPENROUTER_STRATEGY_KIND, makeLlmOpenRouterStrategy } from './openrouter.strategy';

/**
 * The completion adapter for the `openrouter` transport: builds {@link makeLlmOpenRouterStrategy} for every provider
 * whose `transport` is `'openrouter'`, defaulting its base URL to OpenRouter's.
 */
export const LLM_OPENROUTER_COMPLETION_ADAPTER: LlmCompletionAdapter = {
  facet: 'completion',
  kind: LLM_OPENROUTER_STRATEGY_KIND,
  defaultBaseUrl: DEFAULT_LLM_OPENROUTER_BASE_URL,
  make: (config) => makeLlmOpenRouterStrategy(toLlmOpenAiCompatibleChatStrategyConfig(config))
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
  make: (config) => makeLlmOpenRouterDecisionStrategy(toLlmSystemOneDecisionStrategyConfig(config))
};

/**
 * Every adapter `@dereekb/llm/openrouter` contributes — seed a registry with it:
 * `makeLlmAdapterRegistry([...LLM_OPENROUTER_ADAPTERS, …])`.
 */
export const LLM_OPENROUTER_ADAPTERS: ReadonlyArray<LlmAdapter> = [LLM_OPENROUTER_COMPLETION_ADAPTER, LLM_OPENROUTER_DECISION_ADAPTER];
