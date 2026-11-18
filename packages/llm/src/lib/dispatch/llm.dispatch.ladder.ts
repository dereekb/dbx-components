/**
 * One dispatch's RETRY LADDER state — the levers taken so far (re-applied to every later attempt, in order), the rungs
 * already spent, the three lever axes as currently sent, and the decision the latest failure bought (stamped on the
 * next attempt's phase and on the failed-attempt row). The rung itself is chosen by {@link chooseLlmRetryLever}.
 */

import { type Maybe } from '@dereekb/util';
import { DEFAULT_LLM_DECODE_RETRY_TIER, LLM_DECODE_RETRY_TIER_OFF, type LlmModelTierMap, resolveLlmModelTier } from '../model/llm.model.tier';
import { type LlmCapabilityKey, type LlmModelId, type LlmModelTierKey } from '../model/llm.value';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallAttemptRetry } from '../record/llm.call.record';
import { isLlmLengthCappedFinish, isLlmReasoningOnlyReply, type LlmRetryCause } from '../record/llm.decode.failure';
import { type LlmDispatchResult, type LlmRequest } from '../strategy/llm.strategy';
import { applyLlmRetryLever, chooseLlmRetryLever, LLM_RETRY_OUTPUT_BUDGET_CEILING, type LlmRetryLever, type LlmRetryLeverKind } from './llm.retry.lever';

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
   * The completion budget the first attempt was sent with.
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
   * Grant the ONE bonus attempt — a forced `reasoning-off` that undoes a cap-ended `reasoning-low` retry.
   *
   * @param params - The cause and the failed attempt's ordinal.
   * @returns The forced lever.
   */
  takeBonus(params: Omit<LlmDispatchRetryLadderTakeParams, 'failed'>): LlmRetryLever;
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
  const { capability, baseRequest, resolvedModel, escalateModel, reasoningSupported, callContext } = config;
  const applied: LlmRetryLever[] = [];
  const spent = new Set<LlmRetryLeverKind>();
  let outputBudget = config.baseOutputBudget;
  let reasoningEnabled = baseRequest.reasoning != null && baseRequest.reasoning.enabled !== false;
  let structured = baseRequest.responseSchemaHint != null;
  let pendingRetry: Maybe<LlmCallAttemptRetry>;

  const moveAxes = (lever: LlmRetryLever, params: Pick<LlmDispatchRetryLadderTakeParams, 'cause' | 'attempt'>) => {
    switch (lever.lever) {
      case 'budget': {
        const from = outputBudget;
        outputBudget = Number(lever.to);
        callContext.diag({ level: 'info', code: 'output-budget-raise', fields: { capability, attempt: params.attempt, failureClass: params.cause, from, to: outputBudget }, message: 'reply was cut off, raising the completion budget for the remaining attempts' });
        break;
      }
      case 'model':
        callContext.diag({ level: 'info', code: 'decode-escalate', fields: { capability, attempt: params.attempt + 1, model: lever.to }, message: 'decode retry escalating to the configured retry tier' });
        break;
      case 'reasoning-off':
        reasoningEnabled = false;
        break;
      case 'reasoning-low':
        reasoningEnabled = true;
        outputBudget = lever.headroom ?? outputBudget;
        break;
      case 'structured-off':
        structured = false;
        break;
      case 'none':
        break;
    }
  };

  return {
    take(params) {
      const { cause, failed, attempt } = params;
      const lever = chooseLlmRetryLever({
        cause,
        lengthCapped: isLlmLengthCappedFinish(failed),
        reasoningOnly: isLlmReasoningOnlyReply(failed),
        model: resolvedModel,
        ...(escalateModel == null ? {} : { escalateModel }),
        reasoningEnabled,
        reasoningSupported,
        structured,
        outputBudget,
        budgetCeiling: LLM_RETRY_OUTPUT_BUDGET_CEILING,
        spent
      });

      if (lever.lever !== 'none') {
        applied.push(lever);
        spent.add(lever.lever);
        moveAxes(lever, params);
      }

      callContext.diag({ level: 'info', code: 'retry-lever', fields: { capability, attempt: attempt + 1, cause, lever: lever.lever, from: lever.from, to: lever.to, reason: lever.reason }, message: llmRetryLeverMessageOf(lever.lever) });
      pendingRetry = llmCallAttemptRetryOf(lever, cause);
      return lever;
    },
    takeBonus(params) {
      const { cause, attempt } = params;
      const lever: LlmRetryLever = { lever: 'reasoning-off', from: 'low', to: 'off', reason: 'the reasoning-low re-ask spent its completion on reasoning; the bonus attempt undoes it', induced: 'reasoning-low' };
      applied.push(lever);
      spent.add(lever.lever);
      reasoningEnabled = false;
      callContext.diag({
        level: 'info',
        code: 'retry-lever',
        fields: { capability, attempt: attempt + 1, cause, lever: lever.lever, from: lever.from, to: lever.to, reason: lever.reason, bonus: true, induced: 'reasoning-low' },
        message: 'the reasoning-low re-ask was cut off by the completion cap; one bonus attempt with reasoning off'
      });
      pendingRetry = { ...llmCallAttemptRetryOf(lever, cause), bonus: true, induced: 'reasoning-low' };
      return lever;
    },
    apply(request) {
      return applied.reduce((moved, lever) => applyLlmRetryLever(moved, lever), request);
    },
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
   * The configured decode-retry tier — absent ⇒ {@link DEFAULT_LLM_DECODE_RETRY_TIER}; {@link LLM_DECODE_RETRY_TIER_OFF}
   * pins the model rung off.
   */
  readonly decodeRetryTier?: Maybe<LlmModelTierKey>;
}

/**
 * Resolve the decode-retry tier's slug at construction. `off` ⇒ none; an explicit key FAILS LOUD on a typo; the
 * implicit default resolves only when the map holds it (never throws). A same-slug tier needs no special case: the
 * chooser refuses an inert model rung.
 *
 * @param config - The tier map and the configured tier.
 * @returns The escalation slug, or `undefined` when there is none.
 * @throws {Error} When an explicit tier key is not in the map.
 */
export function llmDecodeRetryModelOf(config: LlmDecodeRetryModelConfig): Maybe<LlmModelId> {
  const { modelTiers, decodeRetryTier } = config;
  let model: Maybe<LlmModelId>;

  if (decodeRetryTier === LLM_DECODE_RETRY_TIER_OFF) {
    model = undefined;
  } else if (decodeRetryTier != null) {
    model = resolveLlmModelTier(modelTiers, decodeRetryTier);
  } else if (modelTiers[DEFAULT_LLM_DECODE_RETRY_TIER] != null) {
    model = resolveLlmModelTier(modelTiers, DEFAULT_LLM_DECODE_RETRY_TIER);
  }

  return model;
}
