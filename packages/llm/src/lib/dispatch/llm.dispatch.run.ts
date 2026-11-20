/**
 * The dispatcher's attempt policy — the single-shot fast path (no `validate`, no `critique`) and the validated path:
 * the BOUNDED retry loop (corrections, the lever ladder, the transport lane, the truncation pre-read, the bonus
 * attempt, the fast-fix tier of the reply-repair lane and the critique pass).
 */

import { isNotBlankString, type Maybe, waitForMsUnlessAborted, type Count } from '@dereekb/util';
import { type FetchErrorClassification, type IsRetryableUnknownErrorFunction } from '@dereekb/util/fetch';
import { type LlmModelId, type LlmTokenCount } from '../model/llm.value';
import { type LlmPromptSlotId } from '../prompt/llm.prompt.layout';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallAttemptPhase, type LlmCallFailedAttempt } from '../record/llm.call.record';
import { classifyLlmDecodeFailure, classifyLlmReplyOutcome, isLlmLengthCappedFinish, type LlmDecodeFailureAttempt, type LlmDecodeFailureClass, type LlmRetryCause } from '../record/llm.decode.failure';
import { type LlmCritic } from '../reply/llm.reply.critique';
import { readLlmLineReplyValue, type LlmReplyEnvelopeKeys, type LlmReplyReading } from '../reply/llm.reply.envelope';
import { type LlmReplyFastFixLimits, type LlmReplyFastFixMissReason } from '../reply/llm.reply.fast.fix';
import { type LlmReplyProtocol } from '../reply/llm.reply.protocol';
import { type LlmValueValidator } from '../reply/llm.reply.validator';
import { formatLlmErrorSummary } from '../strategy/llm.error';
import { type LlmDecodeStatus, type LlmDispatchResult, type LlmReplyRepairSummary, type LlmRequest, type LlmStrategy } from '../strategy/llm.strategy';
import { isDegenerateLlmReplyReading, type LlmBoundReplyFastFix, type LlmDispatchAttemptFault, type LlmDispatchAttemptSend, type LlmReplyRepairRefusal, readLlmDispatchReply, runLlmReplyRepairLane, type RunLlmReplyRepairLaneConfig, sendLlmDispatchAttempt, validateLlmDispatchValue } from './llm.dispatch.attempt';
import { type LlmDispatchPauseSignal, type LlmDispatchTransportBackoff, parkLlmDispatchWhilePaused } from './llm.dispatch.control';
import { type LlmCorrectionKind, type LlmDispatchCorrectionTexts, renderLlmDispatchCorrectionText, withLlmDispatchCorrection } from './llm.dispatch.correction';
import { type LlmDispatchRetryLadder, makeLlmDispatchRetryLadder } from './llm.dispatch.ladder';
import { toLlmCallAttemptPhase, type LlmDecodeFailureAttemptConfig, toLlmDecodeFailureAttempt, type LlmDispatchOutcome, type LlmDispatchTerminalFault, toLlmCallFailedAttempt, toLlmRepairedDecodeAttempt } from './llm.dispatch.outcome';
import { type LlmRetryLever } from './llm.retry.lever';

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
   * Scopes the repair lane's fidelity coverage and the `shape` of every `parse-error` row. `undefined` ⇒ the whole reply
   * is the payload.
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
    const { fastFixCalled, fastFixMiss } = laneResult;
    repaired = laneResult.repaired == null ? { ...repaired, fastFixCalled, fastFixMiss } : { result: laneResult.repaired.result, reading: laneResult.repaired.reading, repair: laneResult.repaired.summary, fastFixCalled, fastFixMiss };
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
  const row = toLlmDecodeFailureAttempt({ attempt: 1, failureClass, result, maxOutputTokens, envelope: config.readingEnvelope, transportError, errorClassification });
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
 * The single-push-site ledger of one validated dispatch — every decode row and every failed row goes through it.
 */
interface LlmDispatchAttemptLedger {
  readonly decodeFailures: LlmDecodeFailureAttempt[];
  readonly failedAttempts: LlmCallFailedAttempt[];
  readonly validationErrors: string[];
  recordDecodeAttempt(row: LlmDecodeFailureAttempt, willRetry: boolean): void;
  recordFailedAttempt(cause: LlmRetryCause, error?: Maybe<string>, errorClassification?: Maybe<Exclude<FetchErrorClassification, 'transient'>>): void;
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
   * The call's reading envelope ({@link LlmDispatchAttemptsConfig.readingEnvelope}) — every loop decode row scores with it.
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
  lastFailureClass?: LlmDecodeFailureClass;
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
 * The inputs of {@link loopDecodeRowOf} — a decode row's fields, less the cap and the reading envelope the loop supplies.
 */
type LlmDispatchLoopDecodeRowConfig = Omit<LlmDecodeFailureAttemptConfig, 'maxOutputTokens' | 'envelope'>;

/**
 * A decode row of the current attempt, at the cap it was sent with.
 *
 * @param loop - The loop state.
 * @param config - The row's attempt, class, reply and optional lever / validator error / transport summary.
 * @returns The row.
 */
function loopDecodeRowOf(loop: LlmDispatchLoopState, config: LlmDispatchLoopDecodeRowConfig): LlmDecodeFailureAttempt {
  return toLlmDecodeFailureAttempt({ ...config, maxOutputTokens: loop.request.maxOutputTokens, envelope: loop.readingEnvelope });
}

/**
 * A send that faulted — the transport lane. While a retry can follow: a `timeout` re-asks with the timeout ladder's
 * lever (`reasoning-off` when reasoning is on, else none), and a `transport` fault resends identical bytes after
 * {@link LlmDispatchAttemptsConfig.transportBackoff}. An `unretryable` fault is recorded the same way, takes no lever
 * and no backoff, and settles the loop with its terminal fault. The pending correction is untouched.
 *
 * @param config - The attempt-stage config.
 * @param loop - The loop state.
 * @param step - The attempt's send.
 * @returns Whether to retry.
 */
async function runLlmDispatchFaultStep(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState, step: LlmDispatchLoopStep): Promise<LlmDispatchLoopNext> {
  const { sent, attempt } = step;
  const fault = sent.fault as LlmDispatchAttemptFault;
  const { transportError } = sent;
  const errorClassification = nonTransientLlmErrorClassificationOf(sent.classification);
  const willRetry = fault !== 'unretryable' && step.canRetry();
  loop.lastFailureClass = fault;
  const lever = willRetry ? loop.ladder.take({ cause: fault, failed: loop.result, attempt }) : undefined;
  loop.ledger.recordDecodeAttempt(loopDecodeRowOf(loop, { attempt, failureClass: fault, result: loop.result, lever, transportError, errorClassification }), willRetry);
  loop.ledger.recordFailedAttempt(fault, transportError, errorClassification);

  if (fault === 'unretryable') {
    loop.terminalFault = llmDispatchTerminalFaultOf(attempt, sent);
  }

  if (willRetry && fault === 'transport') {
    const delayMs = config.transportBackoff({ attempt, error: sent.error });
    config.callContext.diag({ level: 'warn', code: 'transport-backoff', fields: { capability: config.baseRequest.capability, attempt, delayMs, ...(transportError == null ? {} : { error: transportError }) }, message: 'transport failed before reaching the model, backing off before an identical resend' });
    // a cancel during the wait ends it early; the next pass then settles before sending
    await sent.attemptContext.timeAsync('transport-backoff', () => waitForMsUnlessAborted(delayMs, config.signal));
  }

  return willRetry ? 'retry' : 'settle';
}

/**
 * A length-capped reply re-asked BEFORE it is parsed — while a retry can follow, or as the one bonus attempt that
 * undoes a cap-ended `reasoning-low` retry.
 *
 * @param loop - The loop state.
 * @param step - The attempt's send and whether this is the bonus attempt.
 * @returns Always `retry`.
 */
function runLlmDispatchTruncatedStep(loop: LlmDispatchLoopState, step: LlmDispatchLoopStep & { readonly bonus: boolean }): LlmDispatchLoopNext {
  const { attempt, bonus } = step;
  const failureClass: LlmDecodeFailureClass = isNotBlankString(loop.result.text) ? 'length-truncation' : 'empty-result';
  loop.lastFailureClass = failureClass;
  const lever: LlmRetryLever = bonus ? loop.ladder.takeBonus({ cause: failureClass, attempt }) : loop.ladder.take({ cause: failureClass, failed: loop.result, attempt });
  loop.ledger.recordDecodeAttempt({ ...loopDecodeRowOf(loop, { attempt, failureClass, result: loop.result, lever }), ...(bonus ? { bonus: true } : {}) }, true);
  loop.ledger.recordFailedAttempt(failureClass);
  loop.nextCorrection = { error: loop.texts.decode[failureClass], kind: 'contract' };
  return 'retry';
}

/**
 * The read value of one attempt, with what the repair lane did to it.
 */
interface LlmDispatchJudgedReading {
  readonly served: LlmDispatchResult;
  readonly reading: LlmReplyReading;
  readonly repair?: Maybe<LlmReplyRepairSummary>;
  readonly fastFixMiss?: Maybe<LlmReplyFastFixMissReason>;
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
async function runLlmDispatchValueStep(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState, step: LlmDispatchLoopStep & LlmDispatchJudgedReading & { readonly value: Record<string, unknown> }): Promise<LlmDispatchLoopNext> {
  const { validate, critique, baseRequest, protocol, liveContext } = config;
  const { sent, attempt, served, repair, value } = step;
  const { attemptContext } = sent;
  const { ledger, ladder } = loop;
  const repairedRow = (retryLever?: Maybe<LlmRetryLever>) => toLlmRepairedDecodeAttempt({ attempt, served, summary: repair as LlmReplyRepairSummary, maxOutputTokens: loop.request.maxOutputTokens, envelope: loop.readingEnvelope, lever: retryLever });
  const accept = () => {
    if (repair != null) {
      ledger.recordDecodeAttempt(repairedRow(), false);
    }

    loop.recovered = ledger.decodeFailures.length > 0;
    loop.accepted = true;
    loop.acceptedValue = value;
  };
  const valid = validateLlmDispatchValue({ validate, value, attemptContext });
  let next: LlmDispatchLoopNext = 'settle';

  if (valid === true) {
    const verdict = critique == null ? true : await attemptContext.timeAsync('critique', () => critique({ capability: baseRequest.capability, meta: baseRequest.meta, value, replyText: loop.result.text, liveContext, replyProtocol: protocol, attempt, callContext: attemptContext, signal: config.signal }));

    if (verdict === true) {
      accept();
    } else {
      ledger.validationErrors.push(`attempt ${attempt}: ${verdict.error}`);

      if (step.canRetry()) {
        loop.nextCorrection = { error: verdict.error, kind: 'critique' };
        ladder.take({ cause: 'critique', failed: loop.result, attempt });
        ledger.recordFailedAttempt('critique', verdict.error);
        next = 'retry';
      } else {
        // no retry can follow: the rejected reply ships, accepted, and its feedback files the critique-fail gap
        loop.critiqueFailure = verdict.error;
        accept();
      }
    }
  } else {
    ledger.validationErrors.push(`attempt ${attempt}: ${valid.error}`);
    loop.lastFailureClass = 'schema-validation';

    if (step.canRetry()) {
      loop.nextCorrection = { error: valid.error, kind: 'contract' };
      const retryLever = ladder.take({ cause: 'schema-validation', failed: loop.result, attempt });
      ledger.recordFailedAttempt('schema-validation', valid.error);

      // an UNREPAIRED intermediate schema miss mints no decode row
      if (repair != null) {
        ledger.recordDecodeAttempt(repairedRow(retryLever), true);
      }

      next = 'retry';
    } else {
      ledger.recordDecodeAttempt({ ...loopDecodeRowOf(loop, { attempt, failureClass: 'schema-validation', result: served, validatorError: valid.error }), ...(repair == null ? {} : { repaired: repair.tier }) }, false);
      ledger.recordFailedAttempt('schema-validation', valid.error);
    }
  }

  return next;
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

    if (repaired.repair != null) {
      loop.result = repaired.result;
      reading = repaired.reading;
      repair = repaired.repair;
      const last = loop.attemptPhases.length - 1;
      loop.attemptPhases[last] = { ...loop.attemptPhases[last], repair };
    }
  }

  return { served, reading, repair, fastFixMiss };
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
async function runLlmDispatchReplyStep(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState, step: LlmDispatchLoopStep): Promise<LlmDispatchLoopNext> {
  const judged = await readLlmDispatchLoopReply(config, loop, step);
  const { reading, served, repair, fastFixMiss } = judged;
  const { attempt } = step;
  const { ledger } = loop;
  let next: LlmDispatchLoopNext = 'settle';

  if (reading.kind === 'value') {
    next = await runLlmDispatchValueStep(config, loop, { ...step, ...judged, value: reading.value });
  } else if (reading.kind === 'declined' || (config.protocol === 'line' && isDegenerateLlmReplyReading(reading))) {
    // a decline (or a `line` reply that is not JSON) is an ANSWER, never a decode failure
    if (repair != null) {
      ledger.recordDecodeAttempt(toLlmRepairedDecodeAttempt({ attempt, served, summary: repair, maxOutputTokens: loop.request.maxOutputTokens, envelope: loop.readingEnvelope }), false);
      loop.recovered = true;
    }

    loop.accepted = true;
  } else {
    const failureClass = classifyLlmDecodeFailure(reading.kind, loop.result);
    loop.lastFailureClass = failureClass;
    const willRetry = step.canRetry();
    const lever = willRetry ? loop.ladder.take({ cause: failureClass, failed: loop.result, attempt }) : undefined;
    ledger.recordDecodeAttempt({ ...loopDecodeRowOf(loop, { attempt, failureClass, result: loop.result, lever }), ...(fastFixMiss == null ? {} : { fastFix: 'missed' as const, fastFixMiss }) }, willRetry);
    ledger.recordFailedAttempt(failureClass);

    if (willRetry) {
      loop.nextCorrection = { error: loop.texts.decode[failureClass], kind: 'contract' };
      next = 'retry';
    }
  }

  return next;
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
  let next: LlmDispatchLoopNext;

  if (sent.fault != null) {
    next = await runLlmDispatchFaultStep(config, loop, step);
  } else if (lengthCapped && step.canRetry()) {
    next = runLlmDispatchTruncatedStep(loop, { ...step, bonus: false });
  } else if (lengthCapped && !cancelled() && ladder.bonusDue(retry)) {
    next = runLlmDispatchTruncatedStep(loop, { ...step, bonus: true });
  } else {
    next = await runLlmDispatchReplyStep(config, loop, step);
  }

  return next;
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
  const { strategy, baseRequest, callContext, onDecodeAttempt } = config;
  const ladder = makeLlmDispatchRetryLadder({ capability: baseRequest.capability, baseRequest, baseOutputBudget: config.baseOutputBudget, resolvedModel: config.resolvedModel, escalateModel: config.escalateModel, reasoningSupported: strategy.supportsReasoningParam !== false, callContext });
  const decodeFailures: LlmDecodeFailureAttempt[] = [];
  const failedAttempts: LlmCallFailedAttempt[] = [];
  const validationErrors: string[] = [];
  const loop: LlmDispatchLoopState = {
    ladder,
    ledger: {
      decodeFailures,
      failedAttempts,
      validationErrors,
      recordDecodeAttempt(row, willRetry) {
        decodeFailures.push(row);
        onDecodeAttempt?.(row, willRetry);
      },
      recordFailedAttempt(cause, error, errorClassification) {
        // reads the CURRENT attempt: its (possibly repaired) reply, the cap it was sent with, its correction, and the retry this failure bought
        failedAttempts.push(toLlmCallFailedAttempt({ attempt: loop.attempts, cause, result: loop.result, maxOutputTokens: loop.request.maxOutputTokens, error, errorClassification, correction: loop.sentCorrection, retry: ladder.pending() }));
      }
    },
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
