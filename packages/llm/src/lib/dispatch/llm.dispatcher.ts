/**
 * The dispatcher surface — assemble a capability's prompt, route the call, return the raw dispatch result — plus the
 * optional decision lane a dispatcher built with a decision registry also serves.
 *
 * Method syntax on purpose, so a host's narrower implementation fits. A host passes its own request (`R`) and result
 * (`X`) types; both default to the library's.
 */

import { type Maybe, type Count } from '@dereekb/util';
import { type LlmDecisionDispatchRequest } from '../decision/llm.decision.descriptor';
import { type LlmDecisionQuestions } from '../decision/llm.decision.question';
import { type LlmDecisionResult } from '../decision/llm.decision.strategy';
import { type LlmCapabilityModelOverride, type LlmCapabilityVision } from '../model/llm.model.precedence';
import { type LlmCapabilityKey } from '../model/llm.value';
import { joinLlmLiveContextBlocks } from '../prompt/llm.prompt.live.context';
import { type LlmPrompt, makeLlmPromptFactory } from '../prompt/llm.prompt.thread';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { type LlmDispatchRequest } from './llm.dispatch.request';

/**
 * A dispatcher.
 *
 * @typeParam R - The host's request type.
 * @typeParam X - The host's dispatch result type.
 */
export interface LlmDispatcher<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult> {
  /**
   * Run one capability call: select a strategy, assemble the prompt, route, return the raw result. With an opt-in
   * request `validate` it runs the bounded, capability-agnostic validate-and-retry loop; without one it is
   * single-shot. Equivalent to `preparePrompt(request).execute()` on a fresh instance, unwrapped to the raw result —
   * the one-shot spelling of the prompt-handle path.
   *
   * @param request - The capability request.
   * @returns The raw dispatch result (the capability parses `.text`).
   */
  dispatch(request: R): Promise<X>;
  /**
   * Prepare (without executing) a chainable prompt for one capability call. The prompt's cached `execute` fires the
   * full dispatch path (assembly / strategy routing / validate-and-retry / telemetry) at most once; the executed
   * prompt reuses that result and chains follow-up messages onto the same exchanged thread (replayed to the strategy,
   * keeping the provider prompt cache warm).
   *
   * @param request - The capability request the chain roots on.
   * @returns The prepared, not-yet-executed prompt.
   */
  preparePrompt(request: R): LlmPrompt<R, X>;
  /**
   * Run one DECISION — declared questions over a state, typed answers back, recorded in the same ledger as every
   * completion. The decision-lane sibling of {@link dispatch}: it shares the dispatcher's recorder, host hooks
   * (`lane: 'decision'`) and taps (`onDispatch` / `onDispatchComplete`), and nests under `request.callContext`. A send
   * that fails with a retryable transport error is resent after the transport backoff — one bounded resend by default
   * (`decisions.maxAttempts`); any other throw propagates. A model that is not a decision model throws before sending.
   *
   * OPTIONAL, and that is the contract rather than an oversight. It is implemented only when the dispatcher was built
   * with a decision registry, so every hand-rolled fake dispatcher keeps compiling untouched, and a consumer reads
   * `dispatcher.decide != null` as "this run can serve a decision at all" — the ONE check that keeps a run with no
   * decision-capable provider on its text arm instead of throwing.
   *
   * @param request - The consuming capability, the declared decision, its input and any per-call concerns.
   * @returns The typed answers and the usage.
   */
  decide?<I, Q extends LlmDecisionQuestions>(request: LlmDecisionDispatchRequest<I, Q>): Promise<LlmDecisionResult<Q>>;
  /**
   * The slug this dispatcher would bill for `capability` and whether it can SEE — over the dispatcher's OWN routes /
   * tiers / default tier / vision map, so it names the slug the dispatch resolves. OPTIONAL: a hand-rolled double
   * without it reads as not-vision, so no attachment rides a call no reader vouched for.
   *
   * @param capability - The capability.
   * @param override - The per-call model / tier override, when the call carries one.
   * @returns The billed slug and its vision flag.
   */
  capabilityVision?(capability: LlmCapabilityKey, override?: Maybe<LlmCapabilityModelOverride>): LlmCapabilityVision;
  /**
   * How many decision SENDS THIS dispatcher has made (counted at the wire, every send a resend included, whether or not
   * the reply was usable) — the per-run counter a host's decision budget is enforced against. Present exactly when
   * {@link decide} is.
   *
   * @returns The served decision-call count.
   */
  decisionsSpent?(): Count;
  /**
   * Zero {@link decisionsSpent} — the per-run refill a host calls at the start of every run, so a budget that promises
   * "one run" holds even when one dispatcher serves several runs. Present exactly when {@link decide} is.
   */
  resetDecisionsSpent?(): void;
  /**
   * CLAIM the ONE per-run decision-budget warning — `true` the first time it is called since the last
   * {@link resetDecisionsSpent}, `false` every time after. The latch lives here rather than at a call site so several
   * consumers reading the same budget file one warning, not one each. Present exactly when {@link decide} is.
   *
   * @returns Whether this caller owns the warning.
   */
  claimDecisionBudgetWarning?(): boolean;
}

/**
 * Wrap a bare dispatch function as an {@link LlmDispatcher} — the fake / double helper. `dispatch` is the function;
 * `preparePrompt` routes every execution (root or follow-up) through it too, reporting the root's sent turn as its
 * joined live context and a follow-up's as the follow-up's content.
 *
 * @param dispatch - The dispatch function.
 * @returns The dispatcher.
 *
 * @example
 * ```ts
 * const fake = makeLlmDispatcherFromDispatch(async (request) => ({ text: '{}', strategyId: 'fake', capability: request.capability }));
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmDispatcherFromDispatch<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult>(dispatch: (request: R) => Promise<X>): LlmDispatcher<R, X> {
  return {
    dispatch,
    preparePrompt: makeLlmPromptFactory<R, X>({
      runPromptRequest: async ({ request, followUp }) => {
        const result = await dispatch(request);
        return { result, sentTurn: { role: 'user', content: followUp == null ? joinLlmLiveContextBlocks(request.renderLiveContext()) : followUp.content } };
      }
    })
  };
}
