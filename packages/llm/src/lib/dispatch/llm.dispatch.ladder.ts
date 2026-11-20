/**
 * One dispatch's RETRY LADDER state — the levers taken so far (re-applied to every later attempt, in order), the rungs
 * already spent, the bonus attempts granted, and the decision the latest failure bought (stamped on the next attempt's
 * phase and on the failed-attempt row). The rung itself is chosen by {@link chooseLlmRetryLever}; the three lever axes
 * it reads (completion budget, reasoning, structured output) are read off the base request as
 * {@link applyLlmRetryLever} moves it, so the chooser always sees what the next attempt would send.
 */

import { type Maybe } from '@dereekb/util';
import { DEFAULT_LLM_DECODE_RETRY_TIER, isLlmOffValue, type LlmModelTierMap, resolveLlmModelTier } from '../model/llm.model.tier';
import { type LlmCapabilityKey, type LlmModelId, type LlmModelTierKey } from '../model/llm.value';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallAttemptRetry } from '../record/llm.call.record';
import { isLlmLengthCappedFinish, isLlmReasoningOnlyReply, type LlmRetryCause } from '../record/llm.decode.failure';
import { type LlmDispatchResult, type LlmRequest } from '../strategy/llm.strategy';
import { applyLlmRetryLever, chooseLlmRetryLever, LLM_RETRY_BONUS_LEVER, LLM_RETRY_INDUCED_BONUS_ATTEMPTS, LLM_RETRY_OUTPUT_BUDGET_CEILING, type LlmRetryLever, type LlmRetryLeverKind } from './llm.retry.lever';

/**
 * The inputs of {@link makeLlmDispatchRetryLadder}.
 */
export interface LlmDispatchRetryLadderConfig {
  /**
   * The dispatch's capability (named on every breadcrumb).
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The composed request — its reasoning and schema hint seed the axes.
   */
  readonly baseRequest: LlmRequest;
  /**
   * The completion budget the first attempt was sent with — read as the budget axis while no lever has set
   * `maxOutputTokens`.
   */
  readonly baseOutputBudget: number;
  /**
   * The concrete slug the dispatch resolved to (never the elided wire `model`).
   */
  readonly resolvedModel: LlmModelId;
  /**
   * The decode-retry tier's slug, when one is configured.
   */
  readonly escalateModel?: Maybe<LlmModelId>;
  /**
   * Whether the serving strategy accepts a reasoning parameter.
   */
  readonly reasoningSupported: boolean;
  /**
   * The dispatch's call context — the breadcrumbs land here.
   */
  readonly callContext: LlmCallContext;
}

/**
 * The inputs of {@link LlmDispatchRetryLadder.take}.
 */
export interface LlmDispatchRetryLadderTakeParams {
  /**
   * Why the attempt is retried.
   */
  readonly cause: LlmRetryCause;
  /**
   * The failed attempt's reply.
   */
  readonly failed: LlmDispatchResult;
  /**
   * The 1-based ordinal of the FAILED attempt.
   */
  readonly attempt: number;
}

/**
 * One dispatch's retry ladder.
 */
export interface LlmDispatchRetryLadder {
  /**
   * Choose, record and return the ONE lever the next attempt moves. Called only when a retry follows.
   *
   * @param params - The cause, the failed reply and the failed attempt's ordinal.
   * @returns The chosen lever (`none` included).
   */
  take(params: LlmDispatchRetryLadderTakeParams): LlmRetryLever;
  /**
   * Whether a cap-ended attempt earns the bonus attempt — the retry that produced it took the `reasoning-low` rung and
   * fewer than {@link LLM_RETRY_INDUCED_BONUS_ATTEMPTS} bonuses were granted. No strategy check: the chooser only ever
   * prices `reasoning-low` when the strategy supports reasoning.
   *
   * @param retry - The retry stamp of the cap-ended attempt (its phase's `retry`).
   * @returns Whether the bonus is due.
   */
  bonusDue(retry: Maybe<LlmCallAttemptRetry>): boolean;
  /**
   * Grant the ONE bonus attempt — {@link LLM_RETRY_BONUS_LEVER}, a forced `reasoning-off` that undoes a cap-ended
   * `reasoning-low` retry — and count it toward {@link bonusAttempts}.
   *
   * @param params - The cause and the failed attempt's ordinal.
   * @returns The forced lever.
   */
  takeBonus(params: Omit<LlmDispatchRetryLadderTakeParams, 'failed'>): LlmRetryLever;
  /**
   * How many bonus attempts were granted — added to the attempt budget.
   *
   * @returns The count.
   */
  bonusAttempts(): number;
  /**
   * Re-apply every lever taken so far, in order.
   *
   * @param request - The request to move.
   * @returns The moved request.
   */
  apply(request: LlmRequest): LlmRequest;
  /**
   * The decision the latest failure bought, when one is pending.
   *
   * @returns The pending retry stamp.
   */
  pending(): Maybe<LlmCallAttemptRetry>;
  /**
   * Read and clear the pending decision (called right after a send, to stamp its phase).
   *
   * @returns The pending retry stamp.
   */
  takePending(): Maybe<LlmCallAttemptRetry>;
}

/**
 * The attempt-phase stamp of a lever.
 *
 * @param lever - The lever.
 * @param cause - The failure class it answers.
 * @returns The stamp.
 */
export function llmCallAttemptRetryOf(lever: LlmRetryLever, cause: LlmRetryCause): LlmCallAttemptRetry {
  return { lever: lever.lever, from: lever.from, to: lever.to, cause, ...(lever.headroom == null ? {} : { headroom: lever.headroom }) };
}

/**
 * The `retry-lever` breadcrumb message.
 *
 * @param lever - The chosen rung.
 * @returns The message.
 */
function llmRetryLeverMessageOf(lever: LlmRetryLeverKind): string {
  return lever === 'none' ? 'retry moves no lever' : `retry moves the ${lever} lever`;
}

/**
 * Build one dispatch's retry ladder.
 *
 * @param config - The capability, the base request and budget, the models, the reasoning support and the context.
 * @returns The ladder.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmDispatchRetryLadder(config: LlmDispatchRetryLadderConfig): LlmDispatchRetryLadder {
  const { capability, baseRequest, baseOutputBudget, resolvedModel, escalateModel, reasoningSupported, callContext } = config;
  const applied: LlmRetryLever[] = [];
  const spent = new Set<LlmRetryLeverKind>();
  let bonusTaken = 0;
  let pendingRetry: Maybe<LlmCallAttemptRetry>;

  const apply = (request: LlmRequest) => applied.reduce((moved, lever) => applyLlmRetryLever(moved, lever), request);

  // the axes as the next attempt sends them: the base request moved by every lever taken so far
  const axes = () => {
    const moved = apply(baseRequest);
    return { outputBudget: moved.maxOutputTokens ?? baseOutputBudget, reasoningEnabled: moved.reasoning != null && moved.reasoning.enabled !== false, structured: moved.responseSchemaHint != null };
  };

  return {
    take(params) {
      const { cause, failed, attempt } = params;
      const before = axes();
      const lever = chooseLlmRetryLever({
        cause,
        lengthCapped: isLlmLengthCappedFinish(failed),
        reasoningOnly: isLlmReasoningOnlyReply(failed),
        model: resolvedModel,
        ...(escalateModel == null ? {} : { escalateModel }),
        reasoningEnabled: before.reasoningEnabled,
        reasoningSupported,
        structured: before.structured,
        outputBudget: before.outputBudget,
        budgetCeiling: LLM_RETRY_OUTPUT_BUDGET_CEILING,
        spent
      });

      if (lever.lever !== 'none') {
        applied.push(lever);
        spent.add(lever.lever);
      }

      if (lever.lever === 'budget') {
        callContext.diag({ level: 'info', code: 'output-budget-raise', fields: { capability, attempt, failureClass: cause, from: before.outputBudget, to: axes().outputBudget }, message: 'reply was cut off, raising the completion budget for the remaining attempts' });
      } else if (lever.lever === 'model') {
        callContext.diag({ level: 'info', code: 'decode-escalate', fields: { capability, attempt: attempt + 1, model: lever.to }, message: 'decode retry escalating to the configured retry tier' });
      }

      callContext.diag({ level: 'info', code: 'retry-lever', fields: { capability, attempt: attempt + 1, cause, lever: lever.lever, from: lever.from, to: lever.to, reason: lever.reason }, message: llmRetryLeverMessageOf(lever.lever) });
      pendingRetry = llmCallAttemptRetryOf(lever, cause);
      return lever;
    },
    bonusDue(retry) {
      // `reasoning-low` is only ever priced when the strategy supports reasoning, so no strategy check is needed here
      return bonusTaken < LLM_RETRY_INDUCED_BONUS_ATTEMPTS && retry?.lever === 'reasoning-low';
    },
    takeBonus(params) {
      const { cause, attempt } = params;
      const lever = LLM_RETRY_BONUS_LEVER;
      bonusTaken += 1;
      applied.push(lever);
      spent.add(lever.lever);
      callContext.diag({
        level: 'info',
        code: 'retry-lever',
        fields: { capability, attempt: attempt + 1, cause, lever: lever.lever, from: lever.from, to: lever.to, reason: lever.reason, bonus: true, induced: 'reasoning-low' },
        message: 'the reasoning-low re-ask was cut off by the completion cap; one bonus attempt with reasoning off'
      });
      pendingRetry = { ...llmCallAttemptRetryOf(lever, cause), bonus: true, induced: 'reasoning-low' };
      return lever;
    },
    bonusAttempts() {
      return bonusTaken;
    },
    apply,
    pending() {
      return pendingRetry;
    },
    takePending() {
      const retry = pendingRetry;
      pendingRetry = undefined;
      return retry;
    }
  };
}

/**
 * The inputs of {@link llmDecodeRetryModelOf}.
 */
export interface LlmDecodeRetryModelConfig {
  /**
   * The dispatcher's tier map.
   */
  readonly modelTiers: LlmModelTierMap;
  /**
   * The configured decode-retry tier (trimmed) — absent or blank ⇒ {@link DEFAULT_LLM_DECODE_RETRY_TIER}; an off value
   * (`off` / `none`, any case — `LLM_OFF_VALUES`) pins the model rung off.
   */
  readonly decodeRetryTier?: Maybe<LlmModelTierKey>;
}

/**
 * Resolve the decode-retry tier's slug at construction. `off` / `none` (any case) ⇒ none; an explicit key FAILS LOUD on a typo; the
 * implicit default resolves only when the map holds it (never throws). A same-slug tier needs no special case: the
 * chooser refuses an inert model rung.
 *
 * @param config - The tier map and the configured tier.
 * @returns The escalation slug, or `undefined` when there is none.
 * @throws {Error} When an explicit tier key is not in the map.
 */
export function llmDecodeRetryModelOf(config: LlmDecodeRetryModelConfig): Maybe<LlmModelId> {
  const { modelTiers } = config;
  const decodeRetryTier = config.decodeRetryTier?.trim() ?? '';
  let model: Maybe<LlmModelId>;

  if (isLlmOffValue(decodeRetryTier)) {
    model = undefined;
  } else if (decodeRetryTier.length > 0) {
    model = resolveLlmModelTier(modelTiers, decodeRetryTier);
  } else if (modelTiers[DEFAULT_LLM_DECODE_RETRY_TIER] != null) {
    model = resolveLlmModelTier(modelTiers, DEFAULT_LLM_DECODE_RETRY_TIER);
  }

  return model;
}
