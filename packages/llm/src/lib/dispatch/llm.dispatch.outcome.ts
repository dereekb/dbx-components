/**
 * What one dispatch's attempts produced, and the row builders every attempt records through — the decode-failure row,
 * the repaired-decode row, the failed-attempt row, the attempt phase and the folded call phases — plus the synthetic
 * timeout / transport envelopes a failed send is recorded as.
 */

import { type Maybe, type NumberPrecision, roundToPrecision } from '@dereekb/util';
import { type LlmStrategyId } from '../model/llm.value';
import { type LlmCallContext, type LlmCallProfile } from '../record/llm.call.context';
import { type LlmCallAttemptPhase, type LlmCallAttemptRetry, type LlmCallFailedAttempt, type LlmCallPhases } from '../record/llm.call.record';
import { llmCallTelemetry } from '../record/llm.call.telemetry';
import { clipLlmFailedAttemptReply, LLM_TIMEOUT_FINISH_REASON, LLM_TRANSPORT_FINISH_REASON, type LlmDecodeFailureAttempt, type LlmDecodeFailureClass, llmDecodeFailureExcerpt, llmDecodeFailureTailExcerpt, type LlmRetryCause } from '../record/llm.decode.failure';
import { scoreLlmReplyJson } from '../reply/llm.reply.repair';
import { type LlmDispatchResult, type LlmReplyRepairSummary, type LlmRequest } from '../strategy/llm.strategy';
import { type LlmRetryLever } from './llm.retry.lever';

/**
 * What a dispatch's attempt stage produced.
 */
export interface LlmDispatchOutcome {
  /**
   * The final reply envelope — stamped with `attempts` / `decodeStatus` / `decodeOutcome` on the validated path,
   * unchanged on the single-shot path.
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
   * 0)`. Empty on the single-shot path.
   */
  readonly failedAttempts: ReadonlyArray<LlmCallFailedAttempt>;
  /**
   * Whether a decode failure occurred and a usable lever still came back. `false` when nothing failed, or when the
   * dispatch dropped the beat.
   */
  readonly recovered: boolean;
  /**
   * The critic's LAST feedback when the attempt budget ran out on a still-rejected reply — the evidence of the
   * `critique-fail` gap. Absent otherwise.
   */
  readonly critiqueFailure?: string;
}

/**
 * The decimal places a repair score is rounded to (`roundToPrecision`) — bounded bytes on every row that carries one.
 */
export const LLM_REPLY_REPAIR_SCORE_PRECISION: NumberPrecision = 3;

/**
 * The inputs of {@link llmDecodeFailureAttemptOf}.
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
   * The validator's error, on a `schema-validation` row.
   */
  readonly validatorError?: Maybe<string>;
  /**
   * The retry lever this failure bought, when a retry followed it.
   */
  readonly lever?: Maybe<Pick<LlmRetryLever, 'lever'>>;
  /**
   * The transport error summary, on a `transport` row.
   */
  readonly transportError?: Maybe<string>;
}

/**
 * Build one decode-failure row. A `parse-error` row carries the scorer's `shape`; a `parse-error` /
 * `length-truncation` row carries the reply's tail.
 *
 * @param config - The attempt, its class, its envelope and what it was sent with / bought.
 * @returns The decode row.
 */
export function llmDecodeFailureAttemptOf(config: LlmDecodeFailureAttemptConfig): LlmDecodeFailureAttempt {
  const { attempt, failureClass, result, maxOutputTokens, validatorError, lever, transportError } = config;
  const shape = failureClass === 'parse-error' ? scoreLlmReplyJson(result.text) : undefined;
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
    ...(transportError == null ? {} : { transportError })
  };
}

/**
 * The inputs of {@link llmRepairedDecodeAttemptOf}.
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
export function llmRepairedDecodeAttemptOf(config: LlmRepairedDecodeAttemptConfig): LlmDecodeFailureAttempt {
  const { attempt, served, summary, maxOutputTokens, lever } = config;
  return { ...llmDecodeFailureAttemptOf({ attempt, failureClass: 'parse-error', result: served, maxOutputTokens, lever }), repaired: summary.tier, ...(summary.ops == null ? {} : { repairOps: summary.ops }) };
}

/**
 * The inputs of {@link llmFailedAttemptOf}.
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
export function llmFailedAttemptOf(config: LlmFailedAttemptConfig): LlmCallFailedAttempt {
  const { attempt, cause, result, maxOutputTokens, error, correction, retry } = config;
  const raw = result.repair?.originalText ?? result.text;
  const clip = clipLlmFailedAttemptReply(raw);

  return {
    attempt,
    cause,
    ...(error == null ? {} : { error }),
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
 * The inputs of {@link llmAttemptPhaseOf}.
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
export function llmAttemptPhaseOf(config: LlmAttemptPhaseConfig): LlmCallAttemptPhase {
  const { attempt, attemptContext, result, retry, repair } = config;
  const wallMs = attemptContext.profile().spans.find((span) => span.name === 'complete')?.durationMs ?? 0;
  return { attempt, wallMs, ...(result.latencyMs == null ? {} : { latencyMs: result.latencyMs }), ...(retry == null ? {} : { retry }), ...(repair == null ? {} : { repair }) };
}

/**
 * The inputs of {@link llmCallPhasesOf}.
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
export function llmCallPhasesOf(config: LlmCallPhasesConfig): LlmCallPhases {
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
export function llmTimeoutResultOf(request: Pick<LlmRequest, 'capability' | 'meta'>, strategyId: LlmStrategyId): LlmDispatchResult {
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
export function llmTransportResultOf(request: Pick<LlmRequest, 'capability' | 'meta'>, strategyId: LlmStrategyId): LlmDispatchResult {
  return syntheticLlmResultOf(request, { strategyId, finishReason: LLM_TRANSPORT_FINISH_REASON });
}
