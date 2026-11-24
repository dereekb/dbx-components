/**
 * The attempt row builders — every row one dispatch attempt records, built beside the row types: the decode-failure
 * row, the repaired-decode row, the failed-attempt row, the attempt phase and the folded call phases, plus the one
 * rounding of the scorer's reading those rows carry. Dispatch files each attempt's rows through them once; the module
 * is not re-exported from the package root.
 */

import { filterMaybeValues, type JsonRepairShape, type Maybe, type NumberPrecision, roundToPrecision } from '@dereekb/util';
import { type FetchErrorClassification } from '@dereekb/util/fetch';
import { type LlmTokenCount } from '../model/llm.value';
import { type LlmDispatchResult, type LlmReplyRepairSummary, type LlmRequest } from '../strategy/llm.strategy';
import { type LlmCallContext, type LlmCallProfile } from './llm.call.context';
import { type LlmCallAttemptPhase, type LlmCallAttemptRetry, type LlmCallFailedAttempt, type LlmCallPhases } from './llm.call.record';
import { llmCallTelemetry } from './llm.call.telemetry';
import { clipLlmFailedAttemptReply, type LlmDecodeFailureAttempt, type LlmDecodeFailureClass, llmDecodeFailureExcerpt, llmDecodeFailureTailExcerpt, type LlmRetryCause } from './llm.decode.failure';

/**
 * The retry a row stamps its `lever` from — the lever the ladder took (`LlmRetryLever`), or the retry stamp it left
 * pending (`LlmCallAttemptRetry`); only the rung's name is read.
 */
export interface LlmAttemptRowLever {
  readonly lever: string;
}

/**
 * The decimal places a repair score is rounded to (`roundToPrecision`) — bounded bytes on every row that carries one.
 */
export const LLM_REPLY_REPAIR_SCORE_PRECISION: NumberPrecision = 3;

/**
 * The bounded scorer reading a `parse-error` decode row carries as `shape`.
 */
export type LlmDecodeRowShape = NonNullable<LlmDecodeFailureAttempt['shape']>;

/**
 * Round the scorer's reading once — the decode row, the repair summaries and the repair diags all carry this.
 *
 * @param shape - The scorer's reading (`repairLlmReplyJson(...).shape` / `scoreLlmReplyJson`).
 * @returns Its verdict and its score rounded to {@link LLM_REPLY_REPAIR_SCORE_PRECISION}.
 */
export function toLlmDecodeRowShape(shape: Pick<JsonRepairShape, 'verdict' | 'score'>): LlmDecodeRowShape {
  return { verdict: shape.verdict, score: roundToPrecision(shape.score, LLM_REPLY_REPAIR_SCORE_PRECISION) };
}

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
  readonly maxOutputTokens?: Maybe<LlmTokenCount>;
  /**
   * The repair lane's reading of THIS row's reply ({@link toLlmDecodeRowShape}) — written on a `parse-error` row only;
   * ignored on every other class.
   */
  readonly shape?: Maybe<LlmDecodeRowShape>;
  /**
   * The validator's error, on a `schema-validation` row.
   */
  readonly validatorError?: Maybe<string>;
  /**
   * The retry lever this failure bought, when a retry followed it.
   */
  readonly lever?: Maybe<LlmAttemptRowLever>;
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
 * Build one decode-failure row. A `parse-error` row carries the lane's `shape`; a `parse-error` /
 * `length-truncation` row carries the reply's tail.
 *
 * @param config - The attempt, its class, its reading and what it was sent with / bought.
 * @returns The decode row.
 */
export function toLlmDecodeFailureAttempt(config: LlmDecodeFailureAttemptConfig): LlmDecodeFailureAttempt {
  const { attempt, failureClass, result, maxOutputTokens, validatorError, lever, transportError, errorClassification } = config;
  const shape = failureClass === 'parse-error' ? config.shape : undefined;
  const tailExcerpt = failureClass === 'parse-error' || failureClass === 'length-truncation' ? llmDecodeFailureTailExcerpt(result.text) : undefined;

  return filterMaybeValues({
    attempt,
    class: failureClass,
    excerpt: llmDecodeFailureExcerpt(result.text),
    tailExcerpt,
    rawLength: result.text.length,
    shape: shape ?? undefined,
    finishReason: result.finishReason,
    completionTokens: result.usage?.completionTokens,
    latencyMs: result.latencyMs,
    maxOutputTokens,
    validatorError,
    lever: lever?.lever,
    transportError,
    errorClassification
  });
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
   * The completion budget the attempt was sent with, when it carried one.
   */
  readonly maxOutputTokens?: Maybe<LlmTokenCount>;
  /**
   * The retry lever this attempt bought, when a retry followed it.
   */
  readonly lever?: Maybe<LlmAttemptRowLever>;
}

/**
 * The decode row of an attempt the reply-repair lane REPAIRED — class `parse-error` (the model's slip stays countable),
 * built from the SERVED reply, stamped `repaired` (+ `repairOps`). Its `shape` is the summary's — the lane's rounded
 * reading of the served reply.
 *
 * @param config - The attempt, the served reply and the repair summary.
 * @returns The decode row.
 */
export function toLlmRepairedDecodeAttempt(config: LlmRepairedDecodeAttemptConfig): LlmDecodeFailureAttempt {
  const { attempt, served, summary, maxOutputTokens, lever } = config;
  return { ...toLlmDecodeFailureAttempt({ attempt, failureClass: 'parse-error', result: served, maxOutputTokens, shape: { verdict: summary.verdict, score: summary.score }, lever }), repaired: summary.tier, ...(summary.ops == null ? {} : { repairOps: summary.ops }) };
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
  readonly maxOutputTokens?: Maybe<LlmTokenCount>;
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

  return filterMaybeValues({
    attempt,
    cause,
    error,
    errorClassification,
    text: clip.text,
    rawLength: raw.length,
    clipped: clip.clipped,
    ...llmCallTelemetry(result),
    maxOutputTokens,
    correction,
    retry
  });
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
}

/**
 * Project the persisted call phases out of a dispatch's snapshotted profile — the `render` / `assemble` spans (root
 * only), the summed per-attempt wall, and the prompt / cache-prefix sizes.
 *
 * @param config - The snapshot, the attempt phases and the sent request.
 * @returns The phase block.
 */
export function toLlmCallPhases(config: LlmCallPhasesConfig): LlmCallPhases {
  const { profile, attemptPhases, request } = config;
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
    ...(request.cacheSegments == null ? {} : { cachePrefixChars: request.cacheSegments.cachePrefix.length })
  };
}
