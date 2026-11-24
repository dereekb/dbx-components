/**
 * **ZenMux's System One route** — ZenMux's hook set over the core System One transport
 * (`makeLlmSystemOneDecisionStrategy`), the {@link LlmDecisionStrategy} a keyed ZenMux provider serves decisions through.
 *
 * ZenMux serves TypeSafe's decision route at `POST <baseUrl>/systemone` (`https://zenmux.ai/api/v1/systemone`), Jev included
 * (`typesafe/jev-1.14`), on BOTH the subscription and the pay-as-you-go key. Its body schema is strict: the request is
 * exactly `{ model, state, questions }`, and `metadata`, `trace`, `session_id` and `user` each answer `400 invalid_params`,
 * so the route accepts NO caller metadata. Its answers may arrive without a `type`, so the hooks read them lax.
 *
 * **The generation id rides a HEADER, not the body.** The reply carries no `id`; ZenMux answers every call with an
 * `X-ZenMux-RequestId` header instead, and that value IS the `generationId` its dashboard and `management/generation?id=` key
 * the call by. Run attribution therefore lives on the host's own call record, found by that id.
 *
 * A reported `cost` is ZenMux's synchronous figure, stamped as its list price ({@link LLM_ZENMUX_SYNC_COST_BASIS}). Built from
 * an EXISTING provider — the same id and the same key its completion lane bills — so serving decisions takes no new secret.
 */

import { makeLlmSystemOneDecisionStrategy, type LlmDecisionStrategy, type LlmStrategyId, type LlmSystemOneDecisionStrategyConfig, type LlmSystemOneDecisionStrategyHooks } from '@dereekb/llm';
import { LLM_ZENMUX_SYNC_COST_BASIS } from './zenmux.account';
import { DEFAULT_LLM_ZENMUX_BASE_URL } from './zenmux.constants';
import { probeLlmZenmuxCredential } from './zenmux.credential.probe';

/**
 * The TRANSPORT kind a ZenMux decision strategy reports — what a call record reads as its `strategyKind` and what a cost
 * fold groups on. Distinct from every completion kind, so a decision can never be confused with the OpenAI-transport
 * completion lane that shares its provider and its key. The value is stable: stored call rows fold on it.
 */
export const LLM_ZENMUX_DECISION_STRATEGY_KIND: LlmStrategyId = 'zenmux-systemone';

/**
 * The response header ZenMux carries its generation id in — the id the dashboard and `management/generation?id=` look a call
 * up by. The `/systemone` body carries no `id` of its own, so this is the only handle there is.
 */
export const LLM_ZENMUX_REQUEST_ID_HEADER = 'x-zenmux-requestid';

/**
 * Config for {@link makeLlmZenmuxDecisionStrategy} — the core System One config: the key (and the env var that supplied it,
 * a label for the readiness messages), the endpoint root (absent ⇒ {@link DEFAULT_LLM_ZENMUX_BASE_URL}), the timeout and the
 * `decisionFetch` / `probeFetch` seams.
 */
export type LlmZenmuxDecisionStrategyConfig = LlmSystemOneDecisionStrategyConfig;

/**
 * ZenMux's definition over the System One transport.
 */
const ZENMUX_DECISION_STRATEGY_HOOKS: LlmSystemOneDecisionStrategyHooks = {
  kind: LLM_ZENMUX_DECISION_STRATEGY_KIND,
  label: 'ZenMux',
  defaultBaseUrl: DEFAULT_LLM_ZENMUX_BASE_URL,
  generationIdHeader: LLM_ZENMUX_REQUEST_ID_HEADER,
  costBasis: LLM_ZENMUX_SYNC_COST_BASIS,
  laxAnswerTypes: true,
  // The SAME probe the ZenMux completion lane runs, because it is the same account and the same key. Not `GET /models`:
  // ZenMux answers that 200 to any bearer, so it could never report a revoked key.
  credentialProbe: (params) => probeLlmZenmuxCredential(params)
};

/**
 * **Build a ZenMux decision strategy** over `POST <baseUrl>/systemone`.
 *
 * @param config - The key, the endpoint and the injectable seams.
 * @returns The decision strategy.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmZenmuxDecisionStrategy(config: LlmZenmuxDecisionStrategyConfig = {}): LlmDecisionStrategy {
  return makeLlmSystemOneDecisionStrategy(config, ZENMUX_DECISION_STRATEGY_HOOKS);
}
