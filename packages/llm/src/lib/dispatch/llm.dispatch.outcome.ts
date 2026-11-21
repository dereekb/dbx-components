/**
 * What one dispatch's attempts produced, plus the synthetic timeout / transport / unretryable envelopes a failed send is
 * recorded as. The row builders every attempt records through live beside the row types, in
 * `record/llm.call.attempt.ts`.
 */

import { type Maybe } from '@dereekb/util';
import { type FetchErrorClassification } from '@dereekb/util/fetch';
import { type LlmStrategyId } from '../model/llm.value';
import { type LlmCallAttemptPhase, type LlmCallFailedAttempt } from '../record/llm.call.record';
import { LLM_TIMEOUT_FINISH_REASON, LLM_TRANSPORT_FINISH_REASON, LLM_UNRETRYABLE_FINISH_REASON, type LlmDecodeFailureAttempt } from '../record/llm.decode.failure';
import { type LlmDispatchResult, type LlmRequest } from '../strategy/llm.strategy';

/**
 * What a dispatch's attempt stage produced.
 */
export interface LlmDispatchOutcome {
  /**
   * The final reply envelope — stamped with `attempts` / `decodeStatus` / `decodeOutcome` on the validated path and on
   * a single-shot send that faulted (unless the dispatch was cancelled); otherwise unchanged on the single-shot path.
   */
  readonly result: LlmDispatchResult;
  /**
   * The request the final attempt actually sent — the base request on a first try.
   */
  readonly finalRequest: LlmRequest;
  /**
   * One phase per `strategy.complete`.
   */
  readonly attemptPhases: ReadonlyArray<LlmCallAttemptPhase>;
  /**
   * One row per attempt that failed to decode / validate (plus a repaired attempt's row). Empty on a clean dispatch; a
   * non-empty array is what files the one decode-failure record.
   */
  readonly decodeFailures: ReadonlyArray<LlmDecodeFailureAttempt>;
  /**
   * Every attempt the dispatch REJECTED, with its reply in full — `failedAttempts.length === attempts − (accepted ? 1 :
   * 0)`. On the single-shot path, one row when its send faulted (a cancelled timeout / transport fault excepted), else
   * empty.
   */
  readonly failedAttempts: ReadonlyArray<LlmCallFailedAttempt>;
  /**
   * Whether a decode failure occurred and a usable value still came back. `false` when nothing failed, or when the
   * cancelled dispatch was dropped.
   */
  readonly recovered: boolean;
  /**
   * The shipped reply's last critic feedback — set when the critic rejected the final attempt and no retry could
   * follow (the budget was spent, or the dispatch was cancelled), so the rejected reply shipped anyway. The evidence of
   * the `critique-fail` gap. Nullish otherwise.
   */
  readonly critiqueFailure?: Maybe<string>;
  /**
   * The send error that ended the dispatch with no resend — set only when the final attempt was an `unretryable`
   * fault. The pipeline records the call as usual, then rejects with an `LlmDispatchFaultError` built from it.
   */
  readonly fault?: Maybe<LlmDispatchTerminalFault>;
  /**
   * A send error the single-shot path cannot absorb — a `timeout` or `transport` fault on a dispatch that was not
   * cancelled. The pipeline records the call as usual, then rethrows {@link LlmDispatchRethrow.error} unchanged.
   */
  readonly rethrow?: Maybe<LlmDispatchRethrow>;
}

/**
 * A send error the pipeline rethrows unchanged after recording the call.
 */
export interface LlmDispatchRethrow {
  /**
   * The thrown value, as the strategy threw it.
   */
  readonly error: unknown;
}

/**
 * The send error that ended a dispatch with no resend — the pipeline records the call, then rejects with it.
 */
export interface LlmDispatchTerminalFault {
  /**
   * The 1-based attempt that failed.
   */
  readonly attempt: number;
  /**
   * The thrown value.
   */
  readonly error: unknown;
  /**
   * Its bounded summary (`formatLlmErrorSummary`).
   */
  readonly summary: string;
  /**
   * Its classification — never `transient`, which is always resent.
   */
  readonly classification: Exclude<FetchErrorClassification, 'transient'>;
}

/**
 * The empty reply envelope a failed send is recorded as, stamped with `finishReason`.
 *
 * @param request - The request whose capability / meta the envelope echoes.
 * @param config - The strategy that failed and the sentinel finish reason.
 * @param config.strategyId - The strategy that failed.
 * @param config.finishReason - The sentinel finish reason.
 * @returns The synthetic envelope.
 */
function syntheticLlmResultOf(request: Pick<LlmRequest, 'capability' | 'meta'>, config: { readonly strategyId: LlmStrategyId; readonly finishReason: string }): LlmDispatchResult {
  return { text: '', strategyId: config.strategyId, capability: request.capability, ...(request.meta == null ? {} : { meta: request.meta }), finishReason: config.finishReason };
}

/**
 * The synthetic envelope of an ABORTED call — an empty reply stamped {@link LLM_TIMEOUT_FINISH_REASON}, so the abort
 * flows through the decode-failure path as `timeout` instead of throwing out of the dispatch.
 *
 * @param request - The request whose capability / meta the envelope echoes.
 * @param strategyId - The strategy that was aborted.
 * @returns The synthetic timeout envelope.
 */
export function makeLlmTimeoutResult(request: Pick<LlmRequest, 'capability' | 'meta'>, strategyId: LlmStrategyId): LlmDispatchResult {
  return syntheticLlmResultOf(request, { strategyId, finishReason: LLM_TIMEOUT_FINISH_REASON });
}

/**
 * The synthetic envelope of a failed-transport call — stamped {@link LLM_TRANSPORT_FINISH_REASON}, so the failure is
 * recorded as `transport` rather than read as model latency.
 *
 * @param request - The request whose capability / meta the envelope echoes.
 * @param strategyId - The strategy whose transport failed.
 * @returns The synthetic transport envelope.
 */
export function makeLlmTransportResult(request: Pick<LlmRequest, 'capability' | 'meta'>, strategyId: LlmStrategyId): LlmDispatchResult {
  return syntheticLlmResultOf(request, { strategyId, finishReason: LLM_TRANSPORT_FINISH_REASON });
}

/**
 * The synthetic envelope of an UNRETRYABLE send — stamped {@link LLM_UNRETRYABLE_FINISH_REASON}, so the failure is
 * recorded as `unretryable`: the send threw an error the retry policy does not resend.
 *
 * @param request - The request whose capability / meta the envelope echoes.
 * @param strategyId - The strategy whose send failed.
 * @returns The synthetic unretryable envelope.
 */
export function makeLlmUnretryableResult(request: Pick<LlmRequest, 'capability' | 'meta'>, strategyId: LlmStrategyId): LlmDispatchResult {
  return syntheticLlmResultOf(request, { strategyId, finishReason: LLM_UNRETRYABLE_FINISH_REASON });
}
