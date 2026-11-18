/**
 * The dispatcher's attempt policy — the single-shot fast path (no `validate`, no `critique`) and the validated path
 * (one attempt today; the bounded retry ladder replaces {@link runLlmDispatchAttempts}' single pass).
 */

import { type Maybe } from '@dereekb/util';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallAttemptPhase, type LlmCallFailedAttempt } from '../record/llm.call.record';
import { classifyLlmDecodeFailure, classifyLlmReplyOutcome, isLlmLengthCappedFinish, type LlmDecodeFailureAttempt, type LlmDecodeFailureClass, type LlmRetryCause } from '../record/llm.decode.failure';
import { type LlmReplyEnvelopeKeys, type LlmReplyLeverReading } from '../reply/llm.reply.envelope';
import { type LlmReplyProtocol } from '../reply/llm.reply.protocol';
import { type LlmLeverValidator } from '../reply/llm.reply.validator';
import { type LlmDecodeStatus, type LlmDispatchResult, type LlmReplyRepairSummary, type LlmRequest, type LlmStrategy } from '../strategy/llm.strategy';
import { isDegenerateLlmReplyReading, type LlmDispatchAttemptSend, readLlmDispatchReply, runLlmReplyRepairLane, sendLlmDispatchAttempt, validateLlmDispatchLever } from './llm.dispatch.attempt';
import { type LlmDispatchPauseSignal } from './llm.dispatch.control';
import { llmAttemptPhaseOf, llmDecodeFailureAttemptOf, type LlmDispatchOutcome, llmFailedAttemptOf, llmRepairedDecodeAttemptOf } from './llm.dispatch.outcome';

/**
 * Receives every decode row as it is recorded, with whether a retry follows it.
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
   * The host's envelope keys (read on a `json-envelope` call).
   */
  readonly envelope?: Maybe<LlmReplyEnvelopeKeys>;
  /**
   * The lever validator, when the call set one.
   */
  readonly validate?: Maybe<LlmLeverValidator>;
  /**
   * The dispatch's call context.
   */
  readonly callContext: LlmCallContext;
  /**
   * The forwarded cancellation signal.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * Whether the dispatch is cancelled right now.
   */
  readonly cancelled: () => boolean;
  /**
   * The host pause gate.
   */
  readonly pause?: Maybe<LlmDispatchPauseSignal>;
  /**
   * The completion budget a raised-budget retry climbs from (`baseRequest.maxOutputTokens ?? defaultMaxOutputTokens`).
   * Read by the retry ladder; the single pass does not raise it.
   */
  readonly baseOutputBudget: number;
  /**
   * Receives every decode row as it is recorded.
   */
  readonly onDecodeAttempt?: Maybe<LlmDispatchDecodeAttemptListener>;
}

/**
 * The reply reader of one attempt — the protocol / envelope read, its swallows on the attempt context.
 *
 * @param config - The attempt-stage config.
 * @param attemptContext - The attempt's context.
 * @returns The reader.
 */
function replyReaderOf(config: Pick<LlmDispatchAttemptsConfig, 'protocol' | 'envelope'>, attemptContext: LlmCallContext): (text: string) => LlmReplyLeverReading {
  const { protocol, envelope } = config;
  return (text) => readLlmDispatchReply(text, { protocol, envelope, swallow: (site, cause) => attemptContext.swallow(site, cause) });
}

/**
 * The SINGLE-SHOT fast path (no `validate`, no `critique`): one `strategy.complete`, the result returned UNCHANGED (no
 * `attempts` / `decodeStatus`). An abort while the dispatch is CANCELLED drops the beat (the synthetic timeout
 * envelope); every other throw — a retryable transport error included — propagates. A non-`line` reply that reads
 * degenerate gets the free deterministic repair (substituted in place, no decode row; an unrepaired object-led reply is
 * refused as `mangled`).
 *
 * @param config - The attempt-stage config.
 * @returns The outcome.
 */
export async function runSingleShotLlmDispatch(config: LlmDispatchAttemptsConfig): Promise<LlmDispatchOutcome> {
  const { strategy, baseRequest, protocol, callContext, signal, cancelled, pause } = config;
  const sent = await sendLlmDispatchAttempt({ strategy, request: baseRequest, attempt: 1, callContext, signal, pause });
  const { attemptContext } = sent;

  if (sent.fault != null && !(sent.fault === 'timeout' && cancelled())) {
    throw sent.error;
  }

  let result = sent.result;
  let repair: LlmReplyRepairSummary | undefined;

  if (protocol !== 'line') {
    const read = replyReaderOf(config, attemptContext);

    if (isDegenerateLlmReplyReading(read(result.text))) {
      const lane = await runLlmReplyRepairLane({ served: result, attempt: 1, attemptContext, read, unrepairedRefusal: 'mangled' });

      if (lane.repaired != null) {
        result = lane.repaired.result;
        repair = lane.repaired.summary;
      }
    }
  }

  return { result, finalRequest: baseRequest, attemptPhases: [llmAttemptPhaseOf({ attempt: 1, attemptContext, result, repair })], decodeFailures: [], failedAttempts: [], recovered: false };
}

/**
 * The single-push-site ledger of one validated dispatch — every decode row and every failed row goes through it.
 */
interface LlmDispatchAttemptLedger {
  readonly decodeFailures: LlmDecodeFailureAttempt[];
  readonly failedAttempts: LlmCallFailedAttempt[];
  readonly validationErrors: string[];
  recordDecodeAttempt(row: LlmDecodeFailureAttempt, willRetry: boolean): void;
  recordFailedAttempt(cause: LlmRetryCause, result: LlmDispatchResult, error?: Maybe<string>): void;
}

/**
 * How one attempt settled.
 */
interface LlmDispatchAttemptVerdict {
  readonly result: LlmDispatchResult;
  readonly accepted: boolean;
  readonly recovered: boolean;
  readonly lever?: unknown;
  readonly failureClass?: LlmDecodeFailureClass;
  readonly repair?: LlmReplyRepairSummary;
}

/**
 * The inputs of {@link judgeLlmDispatchAttempt}.
 */
interface JudgeLlmDispatchAttemptConfig {
  readonly config: LlmDispatchAttemptsConfig;
  readonly sent: LlmDispatchAttemptSend;
  readonly attempt: number;
  readonly ledger: LlmDispatchAttemptLedger;
}

/**
 * Decode and validate one delivered reply: read → repair lane (non-`line`, degenerate) → validate. A valid lever, a
 * decline, or a `line` reply that is not JSON is ACCEPTED; an invalid lever records a `schema-validation` row; any other
 * degenerate reading records its classified row.
 *
 * @param input - The attempt-stage config, the send, the attempt ordinal and the ledger.
 * @returns How the attempt settled.
 */
async function judgeLlmDispatchAttempt(input: JudgeLlmDispatchAttemptConfig): Promise<LlmDispatchAttemptVerdict> {
  const { config, sent, attempt, ledger } = input;
  const { protocol, validate } = config;
  const { attemptContext } = sent;
  const maxOutputTokens = config.baseRequest.maxOutputTokens;
  const served = sent.result;
  const line = protocol === 'line';
  const read = replyReaderOf(config, attemptContext);
  let reading = read(served.text);
  let result = served;
  let repair: LlmReplyRepairSummary | undefined;
  let verdict: LlmDispatchAttemptVerdict;

  if (!line && isDegenerateLlmReplyReading(reading)) {
    // L9b: the fast-fix tier binds here; without one an unrepaired object-led reply is refused as `fast-fix-off`.
    const lane = await runLlmReplyRepairLane({ served, attempt, attemptContext, read, unrepairedRefusal: 'fast-fix-off' });

    if (lane.repaired != null) {
      result = lane.repaired.result;
      reading = lane.repaired.reading;
      repair = lane.repaired.summary;
    }
  }

  const repairedRow = () => llmRepairedDecodeAttemptOf({ attempt, served, summary: repair as LlmReplyRepairSummary, maxOutputTokens });

  if (reading.kind === 'lever') {
    const valid = validateLlmDispatchLever({ validate, lever: reading.lever, attemptContext });

    if (valid === true) {
      if (repair != null) {
        ledger.recordDecodeAttempt(repairedRow(), false);
      }

      verdict = { result, accepted: true, recovered: ledger.decodeFailures.length > 0, lever: reading.lever, repair };
    } else {
      ledger.validationErrors.push(`attempt ${attempt}: ${valid.error}`);
      ledger.recordDecodeAttempt({ ...llmDecodeFailureAttemptOf({ attempt, failureClass: 'schema-validation', result: served, maxOutputTokens, validatorError: valid.error }), ...(repair == null ? {} : { repaired: repair.tier }) }, false);
      ledger.recordFailedAttempt('schema-validation', result, valid.error);
      verdict = { result, accepted: false, recovered: false, failureClass: 'schema-validation', repair };
    }
  } else if (reading.kind === 'declined' || (line && isDegenerateLlmReplyReading(reading))) {
    // a decline (or a `line` reply that is not JSON) is an ANSWER, never a decode failure
    if (repair != null) {
      ledger.recordDecodeAttempt(repairedRow(), false);
    }

    verdict = { result, accepted: true, recovered: repair != null, repair };
  } else {
    const failureClass = classifyLlmDecodeFailure(reading.kind, result);
    ledger.recordDecodeAttempt(llmDecodeFailureAttemptOf({ attempt, failureClass, result, maxOutputTokens }), false);
    ledger.recordFailedAttempt(failureClass, result);
    verdict = { result, accepted: false, recovered: false, failureClass, repair };
  }

  return verdict;
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
 * The VALIDATED path (a `validate` or a `critique` is set) — today a budget of exactly ONE attempt. An abort records a
 * `timeout` row and drops the beat; a retryable transport error a `transport` row (with its summary) and drops; any
 * other throw propagates. A delivered reply is read, repaired (deterministic tier; an unrepaired object-led reply is
 * refused as `fast-fix-off`) and validated. Every failed attempt records its decode row (`willRetry: false`) and its
 * failed-attempt row. The result is stamped `attempts`, `decodeStatus`, `decodeOutcome`, `lengthCapped?`, `lever?` and
 * `validationErrors?`.
 *
 * @param config - The attempt-stage config.
 * @returns The outcome.
 */
export async function runLlmDispatchAttempts(config: LlmDispatchAttemptsConfig): Promise<LlmDispatchOutcome> {
  const { strategy, baseRequest, callContext, signal, pause, onDecodeAttempt } = config;
  const maxOutputTokens = baseRequest.maxOutputTokens;
  const attempts = 1;
  const attemptPhases: LlmCallAttemptPhase[] = [];
  const ledger: LlmDispatchAttemptLedger = {
    decodeFailures: [],
    failedAttempts: [],
    validationErrors: [],
    recordDecodeAttempt(row, willRetry) {
      ledger.decodeFailures.push(row);
      onDecodeAttempt?.(row, willRetry);
    },
    recordFailedAttempt(cause, failed, error) {
      ledger.failedAttempts.push(llmFailedAttemptOf({ attempt: attempts, cause, result: failed, maxOutputTokens, error }));
    }
  };
  const sent = await sendLlmDispatchAttempt({ strategy, request: baseRequest, attempt: attempts, callContext, signal, pause });
  const lengthCapped = isLlmLengthCappedFinish(sent.result);
  let verdict: LlmDispatchAttemptVerdict;

  if (sent.fault == null) {
    verdict = await judgeLlmDispatchAttempt({ config, sent, attempt: attempts, ledger });
  } else {
    const { fault, transportError, result: failed } = sent;
    ledger.recordDecodeAttempt(llmDecodeFailureAttemptOf({ attempt: attempts, failureClass: fault, result: failed, maxOutputTokens, transportError }), false);
    ledger.recordFailedAttempt(fault, failed, transportError);
    verdict = { result: failed, accepted: false, recovered: false, failureClass: fault };
  }

  attemptPhases.push(llmAttemptPhaseOf({ attempt: attempts, attemptContext: sent.attemptContext, result: sent.result, repair: verdict.repair }));

  const { result, accepted, recovered, lever: acceptedLever, failureClass } = verdict;
  const decodeStatus = llmDecodeStatusOf(accepted, attempts);
  const decodeOutcome = classifyLlmReplyOutcome(result, accepted ? undefined : failureClass);
  const lever = acceptedLever === undefined ? undefined : JSON.stringify(acceptedLever);
  const { validationErrors, decodeFailures, failedAttempts } = ledger;

  return {
    result: { ...result, attempts, decodeStatus, decodeOutcome, ...(lengthCapped ? { lengthCapped: true } : {}), ...(lever == null ? {} : { lever }), ...(validationErrors.length > 0 ? { validationErrors } : {}) },
    finalRequest: baseRequest,
    attemptPhases,
    decodeFailures,
    failedAttempts,
    recovered
  };
}
