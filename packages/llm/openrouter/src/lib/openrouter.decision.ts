/**
 * **The OpenRouter decision strategy** — OpenRouter's hook set over the core System One transport
 * (`makeLlmSystemOneDecisionStrategy`, `POST {baseUrl}/systemone`). The body, the HTTP call, the failure mapping, the
 * reply read and the usage fold are all the core transport's; what is OpenRouter's is only its kind, its default base
 * URL and its credential probe (`GET {baseUrl}/key`).
 *
 * A decision is a CAPABILITY some providers offer and others structurally cannot: this strategy is built from an
 * existing OpenRouter provider — the same name, the same key — and is deliberately distinct from the completion
 * strategy's `'openrouter'` kind, so a ledger row never confuses the decision lane with the completion lane that
 * shares its provider and its key.
 *
 * **The one thing this lane has that a completion cannot get.** OpenRouter returns `usage.cost` SYNCHRONOUSLY on a
 * decision reply, so a decision call carries an EXACT, final cost — which is why the hooks stamp no `costBasis`.
 * Answers are read strictly: a type-less answer faults as `answer-mistyped`. The generation id is the body `id`.
 */
import { makeLlmSystemOneDecisionStrategy, type LlmDecisionStrategy, type LlmStrategyId, type LlmSystemOneDecisionStrategyConfig, type LlmSystemOneDecisionStrategyHooks } from '@dereekb/llm';
import { LLM_OPENROUTER_BASE_URL } from './openrouter.constants';
import { probeLlmOpenRouterCredential } from './openrouter.credential.probe';

/**
 * The strategy KIND (and default instance id) of the OpenRouter decision transport — deliberately distinct from the
 * completion strategy's `'openrouter'`, so a ledger row can never confuse the two lanes.
 */
export const LLM_OPENROUTER_DECISION_STRATEGY_KIND: LlmStrategyId = 'openrouter-decisions';

/**
 * Config for {@link makeLlmOpenRouterDecisionStrategy} — the core System One config: the key, the endpoint root
 * (absent ⇒ {@link LLM_OPENROUTER_BASE_URL}; it governs both the decision and the `GET {baseUrl}/key` probe), the
 * timeout and the `decisionFetch` / `probeFetch` seams.
 */
export type LlmOpenRouterDecisionStrategyConfig = LlmSystemOneDecisionStrategyConfig;

/**
 * OpenRouter's definition over the System One transport.
 */
const LLM_OPENROUTER_DECISION_STRATEGY_HOOKS: LlmSystemOneDecisionStrategyHooks = {
  kind: LLM_OPENROUTER_DECISION_STRATEGY_KIND,
  label: 'OpenRouter',
  defaultBaseUrl: LLM_OPENROUTER_BASE_URL,
  // `GET /key` is OpenRouter's free key-metadata endpoint — the SAME probe the completion sibling runs, because it is
  // the same account. A revoked key answers `401 "User not found."` verbatim.
  credentialProbe: (params) => probeLlmOpenRouterCredential(params)
};

/**
 * **Build an OpenRouter decision strategy.**.
 *
 * @param config - The key, the endpoint and the injectable seams.
 * @returns The strategy.
 *
 * @example
 * ```ts
 * const decisions = makeLlmOpenRouterDecisionStrategy({ apiKey });
 * const { answers, usage } = await decisions.decide({ model: 'typesafe/jev-1.14', state: { ticket }, questions: { spam: llmNoulQuestion('`ticket` is unsolicited marketing.') } });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmOpenRouterDecisionStrategy(config: LlmOpenRouterDecisionStrategyConfig = {}): LlmDecisionStrategy {
  return makeLlmSystemOneDecisionStrategy(config, LLM_OPENROUTER_DECISION_STRATEGY_HOOKS);
}
