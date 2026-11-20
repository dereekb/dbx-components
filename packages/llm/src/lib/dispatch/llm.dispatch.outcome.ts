/**
 * What one dispatch's attempts produced, and the row builders every attempt records through — the decode-failure row,
 * the repaired-decode row, the failed-attempt row, the attempt phase and the folded call phases — plus the synthetic
 * timeout / transport envelopes a failed send is recorded as.
 */

import { type Maybe, type NumberPrecision, roundToPrecision } from '@dereekb/util';
import { type FetchErrorClassification } from '@dereekb/util/fetch';
import { type LlmStrategyId } from '../model/llm.value';
import { type LlmCallContext, type LlmCallProfile } from '../record/llm.call.context';
import { type LlmCallAttemptPhase, type LlmCallAttemptRetry, type LlmCallFailedAttempt, type LlmCallPhases } from '../record/llm.call.record';
import { llmCallTelemetry } from '../record/llm.call.telemetry';
import { clipLlmFailedAttemptReply, LLM_TIMEOUT_FINISH_REASON, LLM_TRANSPORT_FINISH_REASON, LLM_UNRETRYABLE_FINISH_REASON, type LlmDecodeFailureAttempt, type LlmDecodeFailureClass, llmDecodeFailureExcerpt, llmDecodeFailureTailExcerpt, type LlmRetryCause } from '../record/llm.decode.failure';
import { type LlmReplyEnvelopeKeys } from '../reply/llm.reply.envelope';
import { scoreLlmReplyJson } from '../reply/llm.reply.repair';
import { type LlmDispatchResult, type LlmReplyRepairSummary, type LlmRequest } from '../strategy/llm.strategy';
import { type LlmRetryLever } from './llm.retry.lever';

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
   * dispatch dropped the beat.
   */
  readonly recovered: boolean;
  /**
   * The shipped reply's last critic feedback — set when the critic rejected the final attempt and no retry could
   * follow (the budget was spent, or the dispatch was cancelled), so the rejected reply shipped anyway. The evidence of
   * the `critique-fail` gap. Absent otherwise.
   */
  readonly critiqueFailure?: string;
  /**
   * The send error that ended the dispatch with no resend — set only when the final attempt was an `unretryable`
   * fault. The pipeline records the call as usual, then rejects with an `LlmDispatchFaultError` built from it.
   */
  readonly fault?: LlmDispatchTerminalFault;
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
 * The decimal places a repair score is rounded to (`roundToPrecision`) — bounded bytes on every row that carries one.
 */
export const LLM_REPLY_REPAIR_SCORE_PRECISION: NumberPrecision = 3;

/**
 * The inputs of {@link toLlmDecodeFailureAttempt}.
 */
export interface LlmDecodeFailureAttemptConfig {
  /**
   * The 1-based attempt ordinal.
   */
  readonly attempt: number;
  /**
   * Why the attempt failed.
   */
  readonly failureClass: LlmDecodeFailureClass;
  /**
   * The attempt's reply envelope (the SERVED one — its excerpt / length / finish are the model's).
   */
  readonly result: LlmDispatchResult;
  /**
   * The completion budget the attempt was sent with, when it carried one.
   */
  readonly maxOutputTokens?: Maybe<number>;
  /**
   * The reply's reading envelope (`resolveLlmReplyReadingEnvelope`) — a `parse-error` row's `shape` is scored with the
   * fidelity coverage over its value key's object. `undefined` ⇒ the whole reply is the payload.
   */
  readonly envelope: Maybe<LlmReplyEnvelopeKeys>;
  /**
   * The validator's error, on a `schema-validation` row.
   */
  readonly validatorError?: Maybe<string>;
  /**
   * The retry lever this failure bought, when a retry followed it.
   */
  readonly lever?: Maybe<Pick<LlmRetryLever, 'lever'>>;
  /**
   * The transport error summary, on a `transport` / `unretryable` row.
   */
  readonly transportError?: Maybe<string>;
  /**
   * The send error's classification, when it was not transient.
   */
  readonly errorClassification?: Maybe<Exclude<FetchErrorClassification, 'transient'>>;
}

/**
 * Build one decode-failure row. A `parse-error` row carries the scorer's `shape`; a `parse-error` /
 * `length-truncation` row carries the reply's tail.
 *
 * @param config - The attempt, its class, its envelope and what it was sent with / bought.
 * @returns The decode row.
 */
export function toLlmDecodeFailureAttempt(config: LlmDecodeFailureAttemptConfig): LlmDecodeFailureAttempt {
  const { attempt, failureClass, result, maxOutputTokens, envelope, validatorError, lever, transportError, errorClassification } = config;
  const shape = failureClass === 'parse-error' ? scoreLlmReplyJson(result.text, { envelope }) : undefined;
  const tailExcerpt = failureClass === 'parse-error' || failureClass === 'length-truncation' ? llmDecodeFailureTailExcerpt(result.text) : undefined;

  return {
    attempt,
    class: failureClass,
    excerpt: llmDecodeFailureExcerpt(result.text),
    ...(tailExcerpt == null ? {} : { tailExcerpt }),
    rawLength: result.text.length,
    ...(shape == null ? {} : { shape: { verdict: shape.verdict, score: roundToPrecision(shape.score, LLM_REPLY_REPAIR_SCORE_PRECISION) } }),
    ...(result.finishReason == null ? {} : { finishReason: result.finishReason }),
    ...(result.usage?.completionTokens == null ? {} : { completionTokens: result.usage.completionTokens }),
    ...(result.latencyMs == null ? {} : { latencyMs: result.latencyMs }),
    ...(maxOutputTokens == null ? {} : { maxOutputTokens }),
    ...(validatorError == null ? {} : { validatorError }),
    ...(lever == null ? {} : { lever: lever.lever }),
    ...(transportError == null ? {} : { transportError }),
    ...(errorClassification == null ? {} : { errorClassification })
  };
}

/**
 * The inputs of {@link toLlmRepairedDecodeAttempt}.
 */
export interface LlmRepairedDecodeAttemptConfig {
  /**
   * The 1-based attempt ordinal.
   */
  readonly attempt: number;
  /**
   * The reply as served, before the substitution.
   */
  readonly served: LlmDispatchResult;
  /**
   * The repair summary.
   */
  readonly summary: LlmReplyRepairSummary;
  /**
   * The served reply's reading envelope — scopes the row's `shape` like {@link LlmDecodeFailureAttemptConfig.envelope}.
   */
  readonly envelope: Maybe<LlmReplyEnvelopeKeys>;
  /**
   * The completion budget the attempt was sent with, when it carried one.
   */
  readonly maxOutputTokens?: Maybe<number>;
  /**
   * The retry lever this attempt bought, when a retry followed it.
   */
  readonly lever?: Maybe<Pick<LlmRetryLever, 'lever'>>;
}

/**
 * The decode row of an attempt the reply-repair lane REPAIRED — class `parse-error` (the model's slip stays countable),
 * built from the SERVED reply, stamped `repaired` (+ `repairOps`).
 *
 * @param config - The attempt, the served reply and the repair summary.
 * @returns The decode row.
 */
export function toLlmRepairedDecodeAttempt(config: LlmRepairedDecodeAttemptConfig): LlmDecodeFailureAttempt {
  const { attempt, served, summary, maxOutputTokens, envelope, lever } = config;
  return { ...toLlmDecodeFailureAttempt({ attempt, failureClass: 'parse-error', result: served, maxOutputTokens, envelope, lever }), repaired: summary.tier, ...(summary.ops == null ? {} : { repairOps: summary.ops }) };
}

/**
 * The inputs of {@link toLlmCallFailedAttempt}.
 */
export interface LlmFailedAttemptConfig {
  /**
   * The 1-based attempt ordinal.
   */
  readonly attempt: number;
  /**
   * Why the attempt was rejected.
   */
  readonly cause: LlmRetryCause;
  /**
   * The attempt's reply envelope — the REPAIRED one when the repair lane substituted it (its `repair.originalText` is
   * then the model's bytes).
   */
  readonly result: LlmDispatchResult;
  /**
   * The completion budget the attempt was sent with, when it carried one.
   */
  readonly maxOutputTokens?: Maybe<number>;
  /**
   * The words of the rejection — validator error, critic feedback or transport summary.
   */
  readonly error?: Maybe<string>;
  /**
   * The send error's classification, when it was not transient.
   */
  readonly errorClassification?: Maybe<Exclude<FetchErrorClassification, 'transient'>>;
  /**
   * The correction block the attempt's request carried.
   */
  readonly correction?: Maybe<string>;
  /**
   * The retry decision this failure bought, when a retry followed it.
   */
  readonly retry?: Maybe<LlmCallAttemptRetry>;
}

/**
 * Build one failed-attempt row — the decode row's twin that keeps the WHOLE reply (the model's bytes, clipped only past
 * the failed-attempt cap) plus the attempt's own telemetry block.
 *
 * @param config - The attempt, its cause, its envelope and what it was sent with / bought.
 * @returns The failed-attempt row.
 */
export function toLlmCallFailedAttempt(config: LlmFailedAttemptConfig): LlmCallFailedAttempt {
  const { attempt, cause, result, maxOutputTokens, error, errorClassification, correction, retry } = config;
  const raw = result.repair?.originalText ?? result.text;
  const clip = clipLlmFailedAttemptReply(raw);

  return {
    attempt,
    cause,
    ...(error == null ? {} : { error }),
    ...(errorClassification == null ? {} : { errorClassification }),
    text: clip.text,
    rawLength: raw.length,
    ...(clip.clipped == null ? {} : { clipped: clip.clipped }),
    ...llmCallTelemetry(result),
    ...(maxOutputTokens == null ? {} : { maxOutputTokens }),
    ...(correction == null ? {} : { correction }),
    ...(retry == null ? {} : { retry })
  };
}

/**
 * The inputs of {@link toLlmCallAttemptPhase}.
 */
export interface LlmAttemptPhaseConfig {
  /**
   * The 1-based attempt ordinal.
   */
  readonly attempt: number;
  /**
   * The attempt's child context — its `complete` span is the attempt's wall time.
   */
  readonly attemptContext: LlmCallContext;
  /**
   * The attempt's reply envelope.
   */
  readonly result: LlmDispatchResult;
  /**
   * The retry decision that produced this attempt, when it was a retry.
   */
  readonly retry?: Maybe<LlmCallAttemptRetry>;
  /**
   * The repair that substituted this attempt's reply, when one did.
   */
  readonly repair?: Maybe<LlmReplyRepairSummary>;
}

/**
 * Build one attempt phase. `wallMs` is the attempt context's `complete` span (0 on a context that does not time).
 *
 * @param config - The attempt, its context, its envelope and its retry / repair stamps.
 * @returns The attempt phase.
 */
export function toLlmCallAttemptPhase(config: LlmAttemptPhaseConfig): LlmCallAttemptPhase {
  const { attempt, attemptContext, result, retry, repair } = config;
  const wallMs = attemptContext.profile().spans.find((span) => span.name === 'complete')?.durationMs ?? 0;
  return { attempt, wallMs, ...(result.latencyMs == null ? {} : { latencyMs: result.latencyMs }), ...(retry == null ? {} : { retry }), ...(repair == null ? {} : { repair }) };
}

/**
 * The inputs of {@link toLlmCallPhases}.
 */
export interface LlmCallPhasesConfig {
  /**
   * The dispatch's ALREADY-SNAPSHOTTED profile (its spans carry `render` / `assemble`).
   */
  readonly profile: LlmCallProfile;
  /**
   * The per-attempt phases the outcome collected.
   */
  readonly attemptPhases: ReadonlyArray<LlmCallAttemptPhase>;
  /**
   * The request THIS call sent — its prompt and cache split give the sizes.
   */
  readonly request: Pick<LlmRequest, 'prompt' | 'cacheSegments'>;
  /**
   * The cache watch's hash of that prefix, when the dispatch was segmented.
   */
  readonly cachePrefixHash?: Maybe<string>;
}

/**
 * Project the persisted call phases out of a dispatch's snapshotted profile — the `render` / `assemble` spans (root
 * only), the summed per-attempt wall, and the prompt / cache-prefix sizes.
 *
 * @param config - The snapshot, the attempt phases, the sent request and the prefix hash.
 * @returns The phase block.
 */
export function toLlmCallPhases(config: LlmCallPhasesConfig): LlmCallPhases {
  const { profile, attemptPhases, request, cachePrefixHash } = config;
  const renderMs = profile.spans.find((span) => span.name === 'render')?.durationMs;
  const assembleMs = profile.spans.find((span) => span.name === 'assemble')?.durationMs;
  const completeMs = attemptPhases.reduce((sum, attempt) => sum + attempt.wallMs, 0);

  return {
    totalMs: profile.totalMs,
    ...(renderMs == null ? {} : { renderMs }),
    ...(assembleMs == null ? {} : { assembleMs }),
    completeMs,
    ...(attemptPhases.length > 0 ? { attempts: attemptPhases } : {}),
    promptChars: request.prompt.length,
    ...(request.cacheSegments == null ? {} : { cachePrefixChars: request.cacheSegments.cachePrefix.length }),
    ...(cachePrefixHash == null ? {} : { cachePrefixHash })
  };
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
