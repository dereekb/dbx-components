/**
 * The dispatcher's attempt policy — the single-shot fast path (no `validate`, no `critique`) and the validated path:
 * the BOUNDED retry loop (corrections, the lever ladder, the transport lane, the truncation pre-read, the bonus
 * attempt, the fast-fix tier of the reply-repair lane and the critique pass).
 */

import { isNotBlankString, type Maybe, waitForMsUnlessAborted, type Count } from '@dereekb/util';
import { type FetchErrorClassification, type IsRetryableUnknownErrorFunction } from '@dereekb/util/fetch';
import { type LlmModelId, type LlmTokenCount } from '../model/llm.value';
import { type LlmPromptSlotId } from '../prompt/llm.prompt.layout';
import { type LlmDecodeRowShape, toLlmCallAttemptPhase, toLlmCallFailedAttempt, toLlmDecodeFailureAttempt, toLlmDecodeRowShape, toLlmRepairedDecodeAttempt } from '../record/llm.call.attempt';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallAttemptPhase, type LlmCallFailedAttempt } from '../record/llm.call.record';
import { classifyLlmDecodeFailure, classifyLlmReplyOutcome, isLlmLengthCappedFinish, type LlmDecodeFailureAttempt, type LlmDecodeFailureClass, type LlmRetryCause } from '../record/llm.decode.failure';
import { type LlmCritic } from '../reply/llm.reply.critique';
import { readLlmLineReplyValue, type LlmReplyEnvelopeKeys, type LlmReplyReading } from '../reply/llm.reply.envelope';
import { type LlmReplyFastFixLimits, type LlmReplyFastFixMissReason } from '../reply/llm.reply.fast.fix';
import { type LlmReplyProtocol } from '../reply/llm.reply.protocol';
import { scoreLlmReplyJson } from '../reply/llm.reply.repair';
import { type LlmValueValidator } from '../reply/llm.reply.validator';
import { formatLlmErrorSummary } from '../strategy/llm.error';
import { type LlmCallMeta, type LlmDecodeStatus, type LlmDispatchResult, type LlmReplyRepairSummary, type LlmRequest, type LlmStrategy } from '../strategy/llm.strategy';
import { isDegenerateLlmReplyReading, type LlmBoundReplyFastFix, type LlmDispatchAttemptFault, type LlmDispatchAttemptSend, type LlmReplyRepairRefusal, readLlmDispatchReply, runLlmReplyRepairLane, type RunLlmReplyRepairLaneConfig, sendLlmDispatchAttempt, validateLlmDispatchValue } from './llm.dispatch.attempt';
import { type LlmDispatchPauseSignal, type LlmDispatchTransportBackoff, parkLlmDispatchWhilePaused } from './llm.dispatch.control';
import { type LlmCorrectionKind, type LlmDispatchCorrectionTexts, renderLlmDispatchCorrectionText, withLlmDispatchCorrection } from './llm.dispatch.correction';
import { type LlmDispatchRetryLadder, makeLlmDispatchRetryLadder } from './llm.dispatch.ladder';
import { type LlmDispatchOutcome, type LlmDispatchTerminalFault } from './llm.dispatch.outcome';

/**
 * The attempt budget of a validated dispatch that does not set `maxAttempts` — one initial attempt and one retry.
 */
export const DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS: Count = 2;

/**
 * Clamp a requested attempt budget — absent ⇒ {@link DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS}, never below 1.
 *
 * @param requested - The request's (or follow-up's) `maxAttempts`.
 * @returns The budget.
 */
export function resolveLlmDispatchMaxAttempts(requested?: Maybe<Count>): Count {
  return Math.max(1, requested ?? DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS);
}

/**
 * Receives every decode row as it is recorded, with whether a retry follows it — the decision made when the attempt was
 * judged. A dispatch cancelled after that decision (during the transport backoff or a park) settles before the retry
 * is sent, so its last row can read `willRetry: true` with no attempt after it.
 */
export type LlmDispatchDecodeAttemptListener = (attempt: LlmDecodeFailureAttempt, willRetry: boolean) => void;

/**
 * The inputs of the attempt stage.
 */
export interface LlmDispatchAttemptsConfig {
  /**
   * The resolved strategy.
   */
  readonly strategy: LlmStrategy;
  /**
   * The composed request.
   */
  readonly baseRequest: LlmRequest;
  /**
   * The call's reply protocol.
   */
  readonly protocol: LlmReplyProtocol;
  /**
   * The host's envelope keys (read on a `json-envelope` call, and by the line lift).
   */
  readonly envelope?: Maybe<LlmReplyEnvelopeKeys>;
  /**
   * The call's READING envelope — `resolveLlmReplyReadingEnvelope(protocol, envelope)`, computed once by the pipeline.
   * Scopes the repair lane's scoring and fidelity coverage — the lane's rounded reading is the `shape` a `parse-error`
   * row carries. `undefined` ⇒ the whole reply is the payload.
   */
  readonly readingEnvelope: Maybe<LlmReplyEnvelopeKeys>;
  /**
   * The value validator, when the call set one.
   */
  readonly validate?: Maybe<LlmValueValidator>;
  /**
   * The dispatch's call context.
   */
  readonly callContext: LlmCallContext;
  /**
   * The forwarded cancellation signal.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * Whether the dispatch is cancelled right now — read at every retry decision, after that branch's own awaits.
   */
  readonly cancelled: () => boolean;
  /**
   * The host pause gate.
   */
  readonly pause?: Maybe<LlmDispatchPauseSignal>;
  /**
   * The completion budget a raised-budget retry climbs from — the resolved cap the first attempt sends.
   */
  readonly baseOutputBudget: LlmTokenCount;
  /**
   * Receives every decode row as it is recorded.
   */
  readonly onDecodeAttempt?: Maybe<LlmDispatchDecodeAttemptListener>;
  /**
   * The attempt budget, already clamped ({@link resolveLlmDispatchMaxAttempts}).
   */
  readonly maxAttempts: Count;
  /**
   * The concrete slug the dispatch resolved to.
   */
  readonly resolvedModel: LlmModelId;
  /**
   * The decode-retry tier's slug, when one is configured.
   */
  readonly escalateModel?: Maybe<LlmModelId>;
  /**
   * The semantic critic (root calls only).
   */
  readonly critique?: Maybe<LlmCritic>;
  /**
   * The critic's subject — the joined live context (`''` on a follow-up).
   */
  readonly liveContext: string;
  /**
   * The field a `line` reply's lifted value names (the pipeline resolves the request's, else
   * `DEFAULT_LLM_LINE_VALUE_FIELD`).
   */
  readonly lineValueField: string;
  /**
   * The bound fast fix, when one is.
   */
  readonly fastFix?: Maybe<LlmBoundReplyFastFix>;
  /**
   * The repair-lane refusal when no fast fix is bound (`fast-fix-off` or `no-schema`).
   */
  readonly fastFixUnavailable: LlmReplyRepairRefusal;
  /**
   * The fast-fix limits, already merged over `DEFAULT_LLM_REPLY_FAST_FIX_LIMITS`.
   */
  readonly fastFixLimits: LlmReplyFastFixLimits;
  /**
   * The correction words, already merged over `DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS`.
   */
  readonly corrections: LlmDispatchCorrectionTexts;
  /**
   * The layout's `correction` slot id (`'correction'` when the layout declares none).
   */
  readonly correctionSlotId: LlmPromptSlotId;
  /**
   * The separator appended after a correction — the layout's `correction` slot's `lastSeparator ?? separator` (`''`
   * when the layout declares none).
   */
  readonly correctionSeparator: string;
  /**
   * The wait before a transport resend (the host's, else `llmTransportBackoffMs`).
   */
  readonly transportBackoff: LlmDispatchTransportBackoff;
  /**
   * The host's call on a send error the classifier reads as `unknown` (`LlmDispatcherConfig.isRetryableUnknownError`)
   * — consulted by the validated loop for every `unknown` error, never by the single-shot path.
   */
  readonly isRetryableUnknownError?: Maybe<IsRetryableUnknownErrorFunction>;
}

/**
 * A send error's classification when it is not transient — what a decode / failed row records.
 *
 * @param classification - The send's classification.
 * @returns The classification, or `undefined` when absent or transient.
 */
function nonTransientLlmErrorClassificationOf(classification: Maybe<FetchErrorClassification>): Maybe<Exclude<FetchErrorClassification, 'transient'>> {
  return classification == null || classification === 'transient' ? undefined : classification;
}

/**
 * The terminal fault of an `unretryable` send.
 *
 * @param attempt - The attempt that failed.
 * @param sent - The faulted send.
 * @returns The terminal fault.
 */
function llmDispatchTerminalFaultOf(attempt: number, sent: LlmDispatchAttemptSend): LlmDispatchTerminalFault {
  return { attempt, error: sent.error, summary: sent.transportError ?? formatLlmErrorSummary(sent.error), classification: nonTransientLlmErrorClassificationOf(sent.classification) ?? 'unknown' };
}

/**
 * The reply reader of one attempt — the protocol / envelope read, its swallows on the attempt context.
 *
 * @param config - The attempt-stage config.
 * @param attemptContext - The attempt's context.
 * @returns The reader.
 */
function replyReaderOf(config: Pick<LlmDispatchAttemptsConfig, 'protocol' | 'envelope'>, attemptContext: LlmCallContext): (text: string) => LlmReplyReading {
  const { protocol, envelope } = config;
  return (text) => readLlmDispatchReply(text, { protocol, envelope, swallow: (site, cause) => attemptContext.swallow(site, cause) });
}

/**
 * What {@link repairLlmDispatchReading} produced.
 */
interface LlmDispatchRepairedReading {
  /**
   * The envelope to judge — the served one, or the substituted repair.
   */
  readonly result: LlmDispatchResult;
  /**
   * The reading of {@link result}.
   */
  readonly reading: LlmReplyReading;
  /**
   * The repair summary — present iff the reply was repaired.
   */
  readonly repair?: Maybe<LlmReplyRepairSummary>;
  /**
   * Whether the lane spent a fast-fix call.
   */
  readonly fastFixCalled: boolean;
  /**
   * Why the fast fix missed, when it was called and missed.
   */
  readonly fastFixMiss?: Maybe<LlmReplyFastFixMissReason>;
  /**
   * The fixer's `meta` on a miss, when it returned one.
   */
  readonly fastFixMissMeta?: Maybe<LlmCallMeta>;
  /**
   * The lane's rounded reading of the SERVED reply — present iff the lane ran.
   */
  readonly shape?: Maybe<LlmDecodeRowShape>;
}

/**
 * The inputs of {@link repairLlmDispatchReading}.
 */
interface RepairLlmDispatchReadingConfig {
  /**
   * The reply as served.
   */
  readonly served: LlmDispatchResult;
  /**
   * Its reading.
   */
  readonly reading: LlmReplyReading;
  /**
   * The repair lane's inputs, less the served reply.
   */
  readonly lane: Omit<RunLlmReplyRepairLaneConfig, 'served'>;
}

/**
 * The reply-repair core both paths share — runs the repair lane on a degenerate JSON reading and substitutes a repair.
 * The caller decides whether the reply is read as JSON at all (never on a `line` call).
 *
 * @param config - The served reply, its reading and the lane inputs.
 * @returns The (possibly repaired) reply and reading, with the fast-fix accounting.
 */
async function repairLlmDispatchReading(config: RepairLlmDispatchReadingConfig): Promise<LlmDispatchRepairedReading> {
  const { served, reading, lane } = config;
  let repaired: LlmDispatchRepairedReading = { result: served, reading, fastFixCalled: false };

  if (isDegenerateLlmReplyReading(reading)) {
    const laneResult = await runLlmReplyRepairLane({ ...lane, served });
    const { fastFixCalled, fastFixMiss, fastFixMissMeta, shape } = laneResult;
    repaired = laneResult.repaired == null ? { ...repaired, fastFixCalled, fastFixMiss, fastFixMissMeta, shape } : { result: laneResult.repaired.result, reading: laneResult.repaired.reading, repair: laneResult.repaired.summary, fastFixCalled, fastFixMiss, shape };
  }

  return repaired;
}

/**
 * The decode status of a settled dispatch.
 *
 * @param accepted - Whether the final attempt was accepted.
 * @param attempts - How many attempts ran.
 * @returns `clean` on a first-try accept, `retried` on a later one, `dropped` otherwise.
 */
function llmDecodeStatusOf(accepted: boolean, attempts: number): LlmDecodeStatus {
  let status: LlmDecodeStatus = 'dropped';

  if (accepted) {
    status = attempts > 1 ? 'retried' : 'clean';
  }

  return status;
}

/**
 * The SINGLE-SHOT fast path (no `validate`, no `critique`): one `strategy.complete`, the result returned UNCHANGED (no
 * `attempts` / `decodeStatus`) when the send delivered a reply. A non-`line` reply that reads degenerate gets the free
 * deterministic repair (substituted in place, no decode row; an unrepaired object-led reply is refused as `mangled`) —
 * never the fast fix, and never the line lift.
 *
 * A send that faulted:
 * - `timeout` / `transport` on a CANCELLED dispatch is dropped quietly — the synthetic envelope, unstamped and recorded.
 * - `timeout` / `transport` otherwise is recorded as one row of that class with the envelope stamped `dropped`, and
 *   carries {@link LlmDispatchOutcome.rethrow}: the pipeline records the call, then rethrows the original error.
 * - `unretryable` (a `permanent` error, or an `unknown` one — the host function is never consulted here, since no
 *   resend is possible) is recorded the same way and carries {@link LlmDispatchOutcome.fault}: the pipeline records
 *   the call, then rejects with `LlmDispatchFaultError`.
 *
 * @param config - The attempt-stage config.
 * @returns The outcome.
 */
export async function runSingleShotLlmDispatch(config: LlmDispatchAttemptsConfig): Promise<LlmDispatchOutcome> {
  const { strategy, baseRequest, protocol, callContext, signal, cancelled, pause, fastFixLimits } = config;
  const sent = await sendLlmDispatchAttempt({ strategy, request: baseRequest, attempt: 1, callContext, signal, pause });
  const { attemptContext, fault } = sent;
  let outcome: LlmDispatchOutcome;

  if (fault != null && (fault === 'unretryable' || !cancelled())) {
    outcome = singleShotLlmFaultedOutcomeOf(config, sent, fault);
  } else if (fault == null) {
    let result = sent.result;
    let repair: Maybe<LlmReplyRepairSummary>;

    if (protocol !== 'line') {
      const read = replyReaderOf(config, attemptContext);
      const repaired = await repairLlmDispatchReading({ served: result, reading: read(result.text), lane: { attempt: 1, attemptContext, read, envelope: config.readingEnvelope, unrepairedRefusal: 'mangled', fastFixLimits } });
      result = repaired.result;
      repair = repaired.repair;
    }

    outcome = { result, finalRequest: baseRequest, attemptPhases: [toLlmCallAttemptPhase({ attempt: 1, attemptContext, result, repair })], decodeFailures: [], failedAttempts: [], recovered: false };
  } else {
    // a cancelled dispatch's timeout / transport fault is dropped quietly: the synthetic envelope, unstamped
    outcome = { result: sent.result, finalRequest: baseRequest, attemptPhases: [toLlmCallAttemptPhase({ attempt: 1, attemptContext, result: sent.result })], decodeFailures: [], failedAttempts: [], recovered: false };
  }

  return outcome;
}

/**
 * The single-shot outcome of a faulted send — one decode row and one failed row of the fault's class, the envelope
 * stamped like a dropped validated dispatch, and either the terminal fault (`unretryable`) the pipeline rejects with,
 * or the original error (`timeout` / `transport`) it rethrows, after recording the call.
 *
 * @param config - The attempt-stage config.
 * @param sent - The faulted send.
 * @param failureClass - Its fault.
 * @returns The outcome.
 */
function singleShotLlmFaultedOutcomeOf(config: LlmDispatchAttemptsConfig, sent: LlmDispatchAttemptSend, failureClass: LlmDispatchAttemptFault): LlmDispatchOutcome {
  const { baseRequest, onDecodeAttempt } = config;
  const { result, attemptContext } = sent;
  const fault = failureClass === 'unretryable' ? llmDispatchTerminalFaultOf(1, sent) : undefined;
  const transportError = fault?.summary ?? sent.transportError;
  const errorClassification = fault?.classification ?? nonTransientLlmErrorClassificationOf(sent.classification);
  const { maxOutputTokens } = baseRequest;
  const row = toLlmDecodeFailureAttempt({ attempt: 1, failureClass, result, maxOutputTokens, transportError, errorClassification });
  const failedRow = toLlmCallFailedAttempt({ attempt: 1, cause: failureClass, result, maxOutputTokens, error: transportError, errorClassification });
  onDecodeAttempt?.(row, false);

  return {
    result: { ...result, attempts: 1, decodeStatus: llmDecodeStatusOf(false, 1), decodeOutcome: classifyLlmReplyOutcome(result, failureClass) },
    finalRequest: baseRequest,
    attemptPhases: [toLlmCallAttemptPhase({ attempt: 1, attemptContext, result })],
    decodeFailures: [row],
    failedAttempts: [failedRow],
    recovered: false,
    ...(fault == null ? { rethrow: { error: sent.error } } : { fault })
  };
}

/**
 * What one validated dispatch has filed — every decode row and every failed row is pushed by
 * {@link fileLlmDispatchAttempt} alone.
 */
interface LlmDispatchAttemptLedger {
  readonly decodeFailures: LlmDecodeFailureAttempt[];
  readonly failedAttempts: LlmCallFailedAttempt[];
  readonly validationErrors: string[];
}

/**
 * The correction the next attempt carries.
 */
interface LlmDispatchNextCorrection {
  readonly error: string;
  readonly kind: LlmCorrectionKind;
}

/**
 * The mutable state of one bounded loop.
 */
interface LlmDispatchLoopState {
  readonly ladder: LlmDispatchRetryLadder;
  readonly ledger: LlmDispatchAttemptLedger;
  readonly attemptPhases: LlmCallAttemptPhase[];
  readonly texts: LlmDispatchCorrectionTexts;
  /**
   * The call's reading envelope ({@link LlmDispatchAttemptsConfig.readingEnvelope}) — the repair lane scores with it, and
   * so does a degenerate row whose host fast fix substituted text that still reads degenerate.
   */
  readonly readingEnvelope: Maybe<LlmReplyEnvelopeKeys>;
  attempts: number;
  fastFixCalls: number;
  request: LlmRequest;
  result: LlmDispatchResult;
  sentCorrection?: Maybe<string>;
  nextCorrection?: Maybe<LlmDispatchNextCorrection>;
  lengthCapped: boolean;
  /**
   * The failure class of the LAST SENT attempt — reset before every send, so it never describes an earlier one.
   */
  lastFailureClass?: LlmDecodeFailureClass | undefined;
  critiqueFailure?: Maybe<string>;
  terminalFault?: Maybe<LlmDispatchTerminalFault>;
  accepted: boolean;
  recovered: boolean;
  acceptedValue?: unknown;
}

/**
 * One attempt's send, as the branch helpers read it.
 */
interface LlmDispatchLoopStep {
  readonly sent: LlmDispatchAttemptSend;
  readonly attempt: number;
  /**
   * Whether a retry may follow RIGHT NOW: budget remains (`attempt < maxAttempts + bonus attempts`) and the dispatch
   * is not cancelled. Read ONCE per branch, after that branch's own awaits (repair lane, critique), and used for the
   * lever, the row's `willRetry` and the branch's answer alike.
   */
  readonly canRetry: () => boolean;
}

/**
 * Whether an attempt retries or the loop settles.
 */
type LlmDispatchLoopNext = 'retry' | 'settle';

/**
 * Why the loop rejected an attempt — what files its failed row.
 */
interface LlmDispatchAttemptRejection {
  readonly cause: LlmRetryCause;
  /**
   * The words of the rejection — validator error, critic feedback or transport summary.
   */
  readonly error?: Maybe<string>;
  readonly errorClassification?: Maybe<Exclude<FetchErrorClassification, 'transient'>>;
}

/**
 * A repaired attempt's decode row — the served bytes, stamped with what the repair lane did.
 */
interface LlmDispatchAttemptRepairedDecode {
  readonly kind: 'repaired';
  readonly summary: LlmReplyRepairSummary;
}

/**
 * A decode-failure row, classified.
 */
interface LlmDispatchAttemptFailedDecode {
  readonly kind: 'failure';
  readonly failureClass: LlmDecodeFailureClass;
  /**
   * The row excerpts the SERVED bytes rather than the held reply — a schema miss, whose held reply may be a repair.
   */
  readonly fromServed?: Maybe<true>;
  readonly shape?: Maybe<LlmDecodeRowShape>;
  readonly validatorError?: Maybe<string>;
  readonly transportError?: Maybe<string>;
  readonly errorClassification?: Maybe<Exclude<FetchErrorClassification, 'transient'>>;
  /**
   * The repair tier of a schema miss on a repaired reply — its row is the failure row plus `repaired`, nothing more.
   */
  readonly repaired?: Maybe<LlmReplyRepairSummary['tier']>;
  readonly fastFixMiss?: Maybe<LlmReplyFastFixMissReason>;
  /**
   * The fixer's `meta` on a miss — lands on the row as `fastFixMeta`.
   */
  readonly fastFixMissMeta?: Maybe<LlmCallMeta>;
}

/**
 * What one attempt's judgement decided — each branch of the loop returns one, and {@link fileLlmDispatchAttempt} files
 * its rows. The population rules are stated once per branch, here, instead of as pushes scattered through it.
 */
interface LlmDispatchAttemptVerdict {
  readonly next: LlmDispatchLoopNext;
  /**
   * Why the attempt was rejected; absent on an accepted one. Files the failed row.
   */
  readonly rejection?: Maybe<LlmDispatchAttemptRejection>;
  /**
   * The decode row the attempt files, when it files one. A critic's rejection files none.
   */
  readonly decode?: Maybe<LlmDispatchAttemptRepairedDecode | LlmDispatchAttemptFailedDecode>;
}

/**
 * File one judged attempt's rows — **the one filing site**: the failed row, then the decode row and
 * `onDecodeAttempt(row, verdict.next === 'retry')`. The attempt's facts are read once, at filing: the served and held
 * replies, the cap and correction it was sent with, and the retry its verdict bought (`ladder.pending()`), whose `lever`
 * / `bonus` both rows stamp.
 *
 * @param config - The attempt-stage config (its `onDecodeAttempt`).
 * @param loop - The loop state.
 * @param step - The attempt's send.
 * @param verdict - What the attempt's judgement decided.
 */
function fileLlmDispatchAttempt(config: Pick<LlmDispatchAttemptsConfig, 'onDecodeAttempt'>, loop: LlmDispatchLoopState, step: LlmDispatchLoopStep, verdict: LlmDispatchAttemptVerdict): void {
  const { attempt } = step;
  const { rejection, decode } = verdict;
  const served = step.sent.result;
  const held = loop.result;
  const maxOutputTokens = loop.request.maxOutputTokens;
  const retry = loop.ladder.pending();

  if (rejection != null) {
    loop.ledger.failedAttempts.push(toLlmCallFailedAttempt({ attempt, cause: rejection.cause, result: held, maxOutputTokens, error: rejection.error, errorClassification: rejection.errorClassification, correction: loop.sentCorrection, retry }));
  }

  if (decode != null) {
    let row: LlmDecodeFailureAttempt;

    if (decode.kind === 'repaired') {
      row = toLlmRepairedDecodeAttempt({ attempt, served, summary: decode.summary, maxOutputTokens, lever: retry });
    } else {
      const { failureClass, shape, validatorError, transportError, errorClassification, repaired, fastFixMiss, fastFixMissMeta } = decode;
      const failed = toLlmDecodeFailureAttempt({ attempt, failureClass, result: decode.fromServed === true ? served : held, maxOutputTokens, shape, validatorError, lever: retry, transportError, errorClassification });
      row = { ...failed, ...(repaired == null ? {} : { repaired }), ...(retry?.bonus === true ? { bonus: true } : {}), ...(fastFixMiss == null ? {} : { fastFix: 'missed' as const, fastFixMiss, ...(fastFixMissMeta == null ? {} : { fastFixMeta: fastFixMissMeta }) }) };
    }

    loop.ledger.decodeFailures.push(row);
    config.onDecodeAttempt?.(row, verdict.next === 'retry');
  }
}

/**
 * A send that faulted — the transport lane. While a retry can follow: a `timeout` re-asks with the timeout ladder's
 * lever (`reasoning-off` when reasoning is on, else none), and a `transport` fault resends identical bytes after
 * {@link LlmDispatchAttemptsConfig.transportBackoff} ({@link backOffLlmDispatchTransport}, once the rows are filed).
 * An `unretryable` fault is recorded the same way, takes no lever and no backoff, and settles the loop with its
 * terminal fault. The pending correction is untouched.
 *
 * @param loop - The loop state.
 * @param step - The attempt's send.
 * @returns The verdict: a decode row and a failed row, both carrying the transport summary.
 */
function judgeLlmDispatchFault(loop: LlmDispatchLoopState, step: LlmDispatchLoopStep): LlmDispatchAttemptVerdict {
  const { sent, attempt } = step;
  const fault = sent.fault as LlmDispatchAttemptFault;
  const { transportError } = sent;
  const errorClassification = nonTransientLlmErrorClassificationOf(sent.classification);
  const willRetry = fault !== 'unretryable' && step.canRetry();
  loop.lastFailureClass = fault;

  if (willRetry) {
    loop.ladder.take({ cause: fault, failed: loop.result, attempt });
  }

  if (fault === 'unretryable') {
    loop.terminalFault = llmDispatchTerminalFaultOf(attempt, sent);
  }

  return { next: willRetry ? 'retry' : 'settle', rejection: { cause: fault, error: transportError, errorClassification }, decode: { kind: 'failure', failureClass: fault, transportError, errorClassification } };
}

/**
 * Wait out the transport backoff before an identical resend. A cancel during the wait ends it early; the next pass
 * then settles before sending.
 *
 * @param config - The attempt-stage config.
 * @param step - The faulted attempt's send.
 */
async function backOffLlmDispatchTransport(config: LlmDispatchAttemptsConfig, step: LlmDispatchLoopStep): Promise<void> {
  const { sent, attempt } = step;
  const { transportError } = sent;
  const delayMs = config.transportBackoff({ attempt, error: sent.error });
  config.callContext.diag({ level: 'warn', code: 'transport-backoff', fields: { capability: config.baseRequest.capability, attempt, delayMs, ...(transportError == null ? {} : { error: transportError }) }, message: 'transport failed before reaching the model, backing off before an identical resend' });
  await sent.attemptContext.timeAsync('transport-backoff', () => waitForMsUnlessAborted(delayMs, config.signal));
}

/**
 * A length-capped reply re-asked BEFORE it is parsed — while a retry can follow, or as the one bonus attempt that
 * undoes a cap-ended `reasoning-low` retry (its rows stamp `bonus` from the ladder's pending retry).
 *
 * @param loop - The loop state.
 * @param step - The attempt's send and whether this is the bonus attempt.
 * @returns The verdict: always `retry`, with a decode row and a failed row.
 */
function judgeLlmDispatchTruncation(loop: LlmDispatchLoopState, step: LlmDispatchLoopStep & { readonly bonus: boolean }): LlmDispatchAttemptVerdict {
  const { attempt, bonus } = step;
  const failureClass: LlmDecodeFailureClass = isNotBlankString(loop.result.text) ? 'length-truncation' : 'empty-result';
  loop.lastFailureClass = failureClass;

  if (bonus) {
    loop.ladder.takeBonus({ cause: failureClass, attempt });
  } else {
    loop.ladder.take({ cause: failureClass, failed: loop.result, attempt });
  }

  loop.nextCorrection = { error: loop.texts.decode[failureClass], kind: 'contract' };
  return { next: 'retry', rejection: { cause: failureClass }, decode: { kind: 'failure', failureClass } };
}

/**
 * The read value of one attempt, with what the repair lane did to it.
 */
interface LlmDispatchJudgedReading {
  readonly served: LlmDispatchResult;
  readonly reading: LlmReplyReading;
  readonly repair?: Maybe<LlmReplyRepairSummary>;
  readonly fastFixMiss?: Maybe<LlmReplyFastFixMissReason>;
  readonly fastFixMissMeta?: Maybe<LlmCallMeta>;
  /**
   * The repair lane's rounded reading of {@link served} — present iff the lane ran.
   */
  readonly shape?: Maybe<LlmDecodeRowShape>;
}

/**
 * A read value — validate, then critique. A valid, accepted value settles; a critic's rejection re-asks with a
 * critique correction (no decode row) while a retry can follow, else the rejected reply SHIPS (accepted, its feedback
 * on {@link LlmDispatchOutcome.critiqueFailure}, no failed row); an invalid value re-asks with the validator's error (a
 * decode row only when no retry follows, or when the reply was repaired).
 *
 * @param config - The attempt-stage config.
 * @param loop - The loop state.
 * @param step - The attempt's send and its judged reading.
 * @returns Whether to retry.
 */
async function runLlmDispatchValueStep(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState, step: LlmDispatchLoopStep & LlmDispatchJudgedReading & { readonly value: Record<string, unknown> }): Promise<LlmDispatchAttemptVerdict> {
  const { validate, critique, baseRequest, protocol, liveContext } = config;
  const { sent, attempt, repair, value } = step;
  const { attemptContext } = sent;
  const { ledger, ladder } = loop;
  const repaired: Maybe<LlmDispatchAttemptRepairedDecode> = repair == null ? undefined : { kind: 'repaired', summary: repair };
  // an accepted attempt files its repaired row (when the lane repaired it) and nothing else
  const accept = (): LlmDispatchAttemptVerdict => {
    loop.recovered = repaired != null || ledger.decodeFailures.length > 0;
    loop.accepted = true;
    loop.acceptedValue = value;
    return { next: 'settle', decode: repaired };
  };
  const valid = validateLlmDispatchValue({ validate, value, attemptContext });
  let verdict: LlmDispatchAttemptVerdict;

  if (valid === true) {
    const critiqued = critique == null ? true : await attemptContext.timeAsync('critique', () => critique({ capability: baseRequest.capability, meta: baseRequest.meta, value, replyText: loop.result.text, liveContext, replyProtocol: protocol, attempt, callContext: attemptContext, signal: config.signal }));

    if (critiqued === true) {
      verdict = accept();
    } else {
      ledger.validationErrors.push(`attempt ${attempt}: ${critiqued.error}`);

      if (step.canRetry()) {
        loop.nextCorrection = { error: critiqued.error, kind: 'critique' };
        ladder.take({ cause: 'critique', failed: loop.result, attempt });
        // a critic's rejection files a failed row and no decode row
        verdict = { next: 'retry', rejection: { cause: 'critique', error: critiqued.error } };
      } else {
        // no retry can follow: the rejected reply ships, accepted, and its feedback files the critique-fail gap
        loop.critiqueFailure = critiqued.error;
        verdict = accept();
      }
    }
  } else {
    ledger.validationErrors.push(`attempt ${attempt}: ${valid.error}`);
    loop.lastFailureClass = 'schema-validation';
    const rejection: LlmDispatchAttemptRejection = { cause: 'schema-validation', error: valid.error };

    if (step.canRetry()) {
      loop.nextCorrection = { error: valid.error, kind: 'contract' };
      ladder.take({ cause: 'schema-validation', failed: loop.result, attempt });
      // an UNREPAIRED intermediate schema miss mints no decode row
      verdict = { next: 'retry', rejection, decode: repaired };
    } else {
      verdict = { next: 'settle', rejection, decode: { kind: 'failure', failureClass: 'schema-validation', fromServed: true, validatorError: valid.error, repaired: repair?.tier } };
    }
  }

  return verdict;
}

/**
 * Read one delivered reply — the protocol read, the line lift (a `line` + critique call reads a bare line as a value)
 * and the reply-repair lane (non-`line`, degenerate). A repair substitutes the reply and patches the attempt's phase.
 *
 * @param config - The attempt-stage config.
 * @param loop - The loop state.
 * @param step - The attempt's send.
 * @returns The judged reading.
 */
async function readLlmDispatchLoopReply(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState, step: LlmDispatchLoopStep): Promise<LlmDispatchJudgedReading> {
  const { protocol, critique, envelope, fastFix, fastFixLimits } = config;
  const { sent, attempt } = step;
  const { attemptContext } = sent;
  const served = sent.result;
  const read = replyReaderOf(config, attemptContext);
  let reading = read(served.text);
  let repair: Maybe<LlmReplyRepairSummary>;
  let fastFixMiss: Maybe<LlmReplyFastFixMissReason>;
  let fastFixMissMeta: Maybe<LlmCallMeta>;
  let shape: Maybe<LlmDecodeRowShape>;

  if (critique != null && protocol === 'line' && reading.kind === 'no-json') {
    const lifted = readLlmLineReplyValue(served.text, { field: config.lineValueField, envelope });

    if (lifted != null) {
      reading = { kind: 'value', value: lifted };
    }
  }

  if (protocol !== 'line') {
    const repaired = await repairLlmDispatchReading({ served, reading, lane: { attempt, attemptContext, read, envelope: config.readingEnvelope, unrepairedRefusal: config.fastFixUnavailable, fastFix, fastFixSpent: loop.fastFixCalls >= fastFixLimits.maxPerDispatch, fastFixLimits } });
    loop.fastFixCalls += repaired.fastFixCalled ? 1 : 0;
    fastFixMiss = repaired.fastFixMiss;
    fastFixMissMeta = repaired.fastFixMissMeta;
    shape = repaired.shape;

    if (repaired.repair != null) {
      loop.result = repaired.result;
      reading = repaired.reading;
      repair = repaired.repair;
      const last = loop.attemptPhases.length - 1;
      loop.attemptPhases[last] = { ...loop.attemptPhases[last], repair };
    }
  }

  return { served, reading, repair, fastFixMiss, fastFixMissMeta, shape };
}

/**
 * Judge one delivered reply: read (line lift + repair lane), then a value is validated / critiqued; a decline (or a
 * `line` reply that is not JSON) is ACCEPTED; any other degenerate reading records its classified row and re-asks
 * while a retry can follow.
 *
 * @param config - The attempt-stage config.
 * @param loop - The loop state.
 * @param step - The attempt's send.
 * @returns Whether to retry.
 */
async function runLlmDispatchReplyStep(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState, step: LlmDispatchLoopStep): Promise<LlmDispatchAttemptVerdict> {
  const judged = await readLlmDispatchLoopReply(config, loop, step);
  const { reading, repair, fastFixMiss, fastFixMissMeta } = judged;
  const { attempt } = step;
  let verdict: LlmDispatchAttemptVerdict;

  if (reading.kind === 'value') {
    verdict = await runLlmDispatchValueStep(config, loop, { ...step, ...judged, value: reading.value });
  } else if (reading.kind === 'declined' || (config.protocol === 'line' && isDegenerateLlmReplyReading(reading))) {
    // a decline (or a `line` reply that is not JSON) is an ANSWER, never a decode failure
    if (repair != null) {
      loop.recovered = true;
    }

    loop.accepted = true;
    verdict = { next: 'settle', decode: repair == null ? undefined : { kind: 'repaired', summary: repair } };
  } else {
    const failureClass = classifyLlmDecodeFailure(reading.kind, loop.result);
    loop.lastFailureClass = failureClass;
    const willRetry = step.canRetry();

    if (willRetry) {
      loop.ladder.take({ cause: failureClass, failed: loop.result, attempt });
      loop.nextCorrection = { error: loop.texts.decode[failureClass], kind: 'contract' };
    }

    // the lane scored the served reply; only a host fast fix whose substituted text still reads degenerate is scored here
    const shape = repair == null ? judged.shape : toLlmDecodeRowShape(scoreLlmReplyJson(loop.result.text, { envelope: loop.readingEnvelope }));
    verdict = { next: willRetry ? 'retry' : 'settle', rejection: { cause: failureClass }, decode: { kind: 'failure', failureClass, shape, fastFixMiss, fastFixMissMeta } };
  }

  return verdict;
}

/**
 * Send ONE attempt of the bounded loop: compose its request (the latest correction on the base request, then every
 * lever taken so far), send it, stamp its phase, and branch — the transport lane, the truncation pre-read, the bonus
 * attempt, or the reply judgement.
 *
 * @param config - The attempt-stage config.
 * @param loop - The loop state.
 * @param attempt - The 1-based ordinal of the attempt to send.
 * @returns Whether to retry.
 */
async function sendLlmDispatchLoopAttempt(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState, attempt: number): Promise<LlmDispatchLoopNext> {
  const { strategy, baseRequest, protocol, callContext, signal, pause, maxAttempts, cancelled } = config;
  const { nextCorrection, ladder } = loop;
  let request = baseRequest;
  loop.sentCorrection = undefined;
  loop.lastFailureClass = undefined;

  if (nextCorrection != null) {
    loop.sentCorrection = renderLlmDispatchCorrectionText({ ...nextCorrection, protocol, texts: loop.texts });
    request = withLlmDispatchCorrection(baseRequest, { text: loop.sentCorrection, kind: nextCorrection.kind, protocol, attempt, slotId: config.correctionSlotId, separator: config.correctionSeparator });
  }

  loop.request = ladder.apply(request);
  loop.attempts = attempt;
  const sent = await sendLlmDispatchAttempt({ strategy, request: loop.request, attempt, callContext, signal, pause, isRetryableUnknownError: config.isRetryableUnknownError });
  const retry = ladder.takePending();
  loop.attemptPhases.push(toLlmCallAttemptPhase({ attempt, attemptContext: sent.attemptContext, result: sent.result, retry }));
  loop.result = sent.result;
  const lengthCapped = isLlmLengthCappedFinish(sent.result);
  loop.lengthCapped = loop.lengthCapped || lengthCapped;
  const step: LlmDispatchLoopStep = { sent, attempt, canRetry: () => attempt < maxAttempts + ladder.bonusAttempts() && !cancelled() };
  let verdict: LlmDispatchAttemptVerdict;

  if (sent.fault != null) {
    verdict = judgeLlmDispatchFault(loop, step);
  } else if (lengthCapped && step.canRetry()) {
    verdict = judgeLlmDispatchTruncation(loop, { ...step, bonus: false });
  } else if (lengthCapped && !cancelled() && ladder.bonusDue(retry)) {
    verdict = judgeLlmDispatchTruncation(loop, { ...step, bonus: true });
  } else {
    verdict = await runLlmDispatchReplyStep(config, loop, step);
  }

  // each attempt is filed ONCE, here, after its branch decided and before anything else awaits
  fileLlmDispatchAttempt(config, loop, step, verdict);

  if (sent.fault === 'transport' && verdict.next === 'retry') {
    await backOffLlmDispatchTransport(config, step);
  }

  return verdict.next;
}

/**
 * Run ONE pass of the bounded loop. A RETRY pass first parks on the host pause gate, then SETTLES without sending when
 * the dispatch was cancelled meanwhile (during the transport backoff, the park, or a slow critique / repair) — before
 * the correction is composed, the ladder applied or the attempt counted. The previous attempt's rows keep the
 * `willRetry: true` they were judged with.
 *
 * @param config - The attempt-stage config.
 * @param loop - The loop state.
 * @returns Whether to retry.
 */
async function runLlmDispatchLoopPass(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState): Promise<LlmDispatchLoopNext> {
  const { callContext, signal, pause, cancelled } = config;
  const attempt = loop.attempts + 1;
  let next: LlmDispatchLoopNext = 'settle';

  if (attempt > 1) {
    await parkLlmDispatchWhilePaused({ pause, signal, callContext });
  }

  if (attempt === 1 || !cancelled()) {
    next = await sendLlmDispatchLoopAttempt(config, loop, attempt);
  }

  return next;
}

/**
 * The VALIDATED path (a `validate` or a `critique` is set) — the BOUNDED retry loop, up to `maxAttempts` attempts (plus
 * at most one bonus attempt).
 *
 * - **Transport lane.** An abort records a `timeout` row and re-asks with the timeout ladder's lever
 *   (`reasoning-off` when reasoning is on); a `transient` send error (or an `unknown` one the host's
 *   `isRetryableUnknownError` approved) records a `transport` row (with its summary) and resends identical bytes after
 *   the backoff. Neither retries once the budget is spent or the dispatch is cancelled. Any other send error
 *   (`permanent`, or a refused `unknown`) records an `unretryable` row and settles at once with
 *   {@link LlmDispatchOutcome.fault}; the pipeline records the call, then rejects with `LlmDispatchFaultError`.
 * - **Truncation.** A length-capped reply is never parsed while a retry can follow; it re-asks with a raised budget.
 * - **Reply.** A delivered reply is read, repaired (deterministic tier, then the bound fast fix), validated and
 *   critiqued. Every rejection re-asks with a `## Correction` block naming only the latest failure, and moves ONE
 *   lever of the ladder. A critic's rejection with no retry left ships the reply (stamped accepted, the `critique-fail`
 *   gap filed).
 * - **Cancellation.** Every retry decision reads cancellation at the moment it decides, like a spent budget; a retry
 *   pass parks on the pause gate, then settles without sending when the dispatch was cancelled meanwhile.
 *
 * Every rejected attempt records its failed-attempt row (with the correction it was sent with and the retry it
 * bought); decode rows follow the decode-failure population rules. The result is stamped `attempts`, `decodeStatus`,
 * `decodeOutcome` (of the last SENT attempt), `lengthCapped?`, `valueJson?` and `validationErrors?`.
 *
 * @param config - The attempt-stage config.
 * @returns The outcome.
 */
export async function runLlmDispatchAttempts(config: LlmDispatchAttemptsConfig): Promise<LlmDispatchOutcome> {
  const { strategy, baseRequest, callContext } = config;
  const ladder = makeLlmDispatchRetryLadder({ capability: baseRequest.capability, baseRequest, baseOutputBudget: config.baseOutputBudget, resolvedModel: config.resolvedModel, escalateModel: config.escalateModel, reasoningSupported: strategy.supportsReasoningParam !== false, callContext });
  const decodeFailures: LlmDecodeFailureAttempt[] = [];
  const failedAttempts: LlmCallFailedAttempt[] = [];
  const validationErrors: string[] = [];
  const loop: LlmDispatchLoopState = {
    ladder,
    ledger: { decodeFailures, failedAttempts, validationErrors },
    attemptPhases: [],
    texts: config.corrections,
    readingEnvelope: config.readingEnvelope,
    attempts: 0,
    fastFixCalls: 0,
    request: baseRequest,
    result: { text: '', strategyId: strategy.id, capability: baseRequest.capability },
    lengthCapped: false,
    accepted: false,
    recovered: false
  };

  while ((await runLlmDispatchLoopPass(config, loop)) === 'retry') {
    // each pass sends at most one attempt
  }

  const { result, accepted, recovered, acceptedValue, attempts, lengthCapped, critiqueFailure, terminalFault, attemptPhases } = loop;
  const decodeStatus = llmDecodeStatusOf(accepted, attempts);
  const decodeOutcome = classifyLlmReplyOutcome(result, accepted ? undefined : loop.lastFailureClass);
  const valueJson = acceptedValue === undefined ? undefined : JSON.stringify(acceptedValue);

  return {
    result: { ...result, attempts, decodeStatus, decodeOutcome, ...(lengthCapped ? { lengthCapped: true } : {}), ...(valueJson == null ? {} : { valueJson }), ...(validationErrors.length > 0 ? { validationErrors } : {}) },
    finalRequest: loop.request,
    attemptPhases,
    decodeFailures,
    failedAttempts,
    recovered,
    critiqueFailure,
    fault: terminalFault
  };
}
