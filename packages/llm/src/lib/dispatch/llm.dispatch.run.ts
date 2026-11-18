/**
 * The dispatcher's attempt policy — the single-shot fast path (no `validate`, no `critique`) and the validated path:
 * the BOUNDED retry loop (corrections, the lever ladder, the transport lane, the truncation pre-read, the bonus
 * attempt, the fast-fix tier of the reply-repair lane and the critique pass).
 */

import { type Maybe } from '@dereekb/util';
import { type LlmModelId } from '../model/llm.value';
import { type LlmPromptSlotId } from '../prompt/llm.prompt.layout';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallAttemptPhase, type LlmCallFailedAttempt } from '../record/llm.call.record';
import { classifyLlmDecodeFailure, classifyLlmReplyOutcome, isLlmLengthCappedFinish, type LlmDecodeFailureAttempt, type LlmDecodeFailureClass, type LlmRetryCause } from '../record/llm.decode.failure';
import { type LlmCritic } from '../reply/llm.reply.critique';
import { DEFAULT_LLM_LINE_LEVER_FIELD, llmLineReplyLeverOf, type LlmReplyEnvelopeKeys, type LlmReplyLeverReading } from '../reply/llm.reply.envelope';
import { DEFAULT_LLM_REPLY_FAST_FIX_LIMITS, type LlmReplyFastFixLimits, type LlmReplyFastFixMissReason } from '../reply/llm.reply.fast.fix';
import { type LlmReplyProtocol } from '../reply/llm.reply.protocol';
import { type LlmLeverValidator } from '../reply/llm.reply.validator';
import { type LlmDecodeStatus, type LlmDispatchResult, type LlmReplyRepairSummary, type LlmRequest, type LlmStrategy } from '../strategy/llm.strategy';
import { isDegenerateLlmReplyReading, type LlmBoundReplyFastFix, type LlmDispatchAttemptFault, type LlmDispatchAttemptSend, type LlmReplyRepairRefusal, readLlmDispatchReply, runLlmReplyRepairLane, sendLlmDispatchAttempt, validateLlmDispatchLever } from './llm.dispatch.attempt';
import { delayLlmDispatch, type LlmDispatchPauseSignal, type LlmDispatchTransportBackoff, llmTransportBackoffMs } from './llm.dispatch.control';
import { DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS, type LlmCorrectionKind, type LlmDispatchCorrectionTexts, llmDispatchCorrectionTextOf, withLlmDispatchCorrection } from './llm.dispatch.correction';
import { type LlmDispatchRetryLadder, makeLlmDispatchRetryLadder } from './llm.dispatch.ladder';
import { llmAttemptPhaseOf, llmDecodeFailureAttemptOf, type LlmDispatchOutcome, llmFailedAttemptOf, llmRepairedDecodeAttemptOf } from './llm.dispatch.outcome';
import { LLM_RETRY_INDUCED_BONUS_ATTEMPTS, type LlmRetryLever } from './llm.retry.lever';

/**
 * The attempt budget of a validated dispatch that does not set `maxAttempts` — one initial attempt and one retry.
 */
export const DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS = 2;

/**
 * Clamp a requested attempt budget — absent ⇒ {@link DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS}, never below 1.
 *
 * @param requested - The request's (or follow-up's) `maxAttempts`.
 * @returns The budget.
 */
export function llmDispatchMaxAttemptsOf(requested?: Maybe<number>): number {
  return Math.max(1, requested ?? DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS);
}

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
   * The host's envelope keys (read on a `json-envelope` call, and by the line lift).
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
   */
  readonly baseOutputBudget: number;
  /**
   * Receives every decode row as it is recorded.
   */
  readonly onDecodeAttempt?: Maybe<LlmDispatchDecodeAttemptListener>;
  /**
   * The attempt budget, already clamped ({@link llmDispatchMaxAttemptsOf}).
   */
  readonly maxAttempts: number;
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
  readonly liveContext?: Maybe<string>;
  /**
   * The field a `line` reply's lifted lever names. Defaults to `DEFAULT_LLM_LINE_LEVER_FIELD`.
   */
  readonly lineLeverField?: Maybe<string>;
  /**
   * The bound fast fix, when one is.
   */
  readonly fastFix?: Maybe<LlmBoundReplyFastFix>;
  /**
   * The repair-lane refusal when no fast fix is bound. Defaults to `fast-fix-off`.
   */
  readonly fastFixUnavailable?: Maybe<LlmReplyRepairRefusal>;
  /**
   * The fast-fix limits. Defaults to `DEFAULT_LLM_REPLY_FAST_FIX_LIMITS`.
   */
  readonly fastFixLimits?: Maybe<LlmReplyFastFixLimits>;
  /**
   * The correction words. Defaults to {@link DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS}.
   */
  readonly corrections?: Maybe<LlmDispatchCorrectionTexts>;
  /**
   * The layout's `correction` slot id. Defaults to `'correction'`.
   */
  readonly correctionSlotId?: Maybe<LlmPromptSlotId>;
  /**
   * The wait before a transport resend. Defaults to {@link llmTransportBackoffMs}.
   */
  readonly transportBackoff?: Maybe<LlmDispatchTransportBackoff>;
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
  recordFailedAttempt(cause: LlmRetryCause, error?: Maybe<string>): void;
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
  attempts: number;
  bonusAttempts: number;
  fastFixCalls: number;
  request: LlmRequest;
  result: LlmDispatchResult;
  sentCorrection?: Maybe<string>;
  nextCorrection?: Maybe<LlmDispatchNextCorrection>;
  lengthCapped: boolean;
  lastFailureClass?: Maybe<LlmDecodeFailureClass>;
  critiqueFailure?: Maybe<string>;
  accepted: boolean;
  recovered: boolean;
  acceptedLever?: unknown;
}

/**
 * One attempt's send, as the branch helpers read it.
 */
interface LlmDispatchLoopStep {
  readonly sent: LlmDispatchAttemptSend;
  readonly attempt: number;
  readonly budgetLeft: boolean;
}

/**
 * Whether an attempt retries or the loop settles.
 */
type LlmDispatchLoopNext = 'retry' | 'settle';

/**
 * A decode row of the current attempt, at the cap it was sent with.
 *
 * @param loop - The loop state.
 * @param config - The row's attempt, class, reply and optional lever / validator error / transport summary.
 * @returns The row.
 */
function loopDecodeRowOf(loop: LlmDispatchLoopState, config: { readonly attempt: number; readonly failureClass: LlmDecodeFailureClass; readonly result: LlmDispatchResult; readonly lever?: Maybe<LlmRetryLever>; readonly validatorError?: Maybe<string>; readonly transportError?: Maybe<string> }): LlmDecodeFailureAttempt {
  return llmDecodeFailureAttemptOf({ ...config, maxOutputTokens: loop.request.maxOutputTokens });
}

/**
 * A send that faulted — the transport lane. A `timeout` or `transport` fault resends identical bytes while the budget
 * lasts and the dispatch is not cancelled; a transport resend waits {@link LlmDispatchAttemptsConfig.transportBackoff}
 * first. The pending correction is untouched.
 *
 * @param config - The attempt-stage config.
 * @param loop - The loop state.
 * @param step - The attempt's send.
 * @returns Whether to retry.
 */
async function runLlmDispatchFaultStep(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState, step: LlmDispatchLoopStep): Promise<LlmDispatchLoopNext> {
  const { sent, attempt, budgetLeft } = step;
  const fault = sent.fault as LlmDispatchAttemptFault;
  const { transportError } = sent;
  const willRetry = !config.cancelled() && budgetLeft;
  loop.lastFailureClass = fault;
  const lever = willRetry ? loop.ladder.take({ cause: fault, failed: loop.result, attempt }) : undefined;
  loop.ledger.recordDecodeAttempt(loopDecodeRowOf(loop, { attempt, failureClass: fault, result: loop.result, lever, transportError }), willRetry);
  loop.ledger.recordFailedAttempt(fault, transportError);

  if (willRetry && fault === 'transport') {
    const delayMs = (config.transportBackoff ?? llmTransportBackoffMs)(attempt);
    config.callContext.diag({ level: 'warn', code: 'transport-backoff', fields: { capability: config.baseRequest.capability, attempt, delayMs, ...(transportError == null ? {} : { error: transportError }) }, message: 'transport failed before reaching the model, backing off before an identical resend' });
    await sent.attemptContext.timeAsync('transport-backoff', () => delayLlmDispatch(delayMs, config.signal));
  }

  return willRetry ? 'retry' : 'settle';
}

/**
 * A length-capped reply re-asked BEFORE it is parsed — with budget left, or as the one bonus attempt that undoes a
 * cap-ended `reasoning-low` retry.
 *
 * @param loop - The loop state.
 * @param step - The attempt's send and whether this is the bonus attempt.
 * @returns Always `retry`.
 */
function runLlmDispatchTruncatedStep(loop: LlmDispatchLoopState, step: LlmDispatchLoopStep & { readonly bonus: boolean }): LlmDispatchLoopNext {
  const { attempt, bonus } = step;
  const failureClass: LlmDecodeFailureClass = loop.result.text.trim() === '' ? 'empty-result' : 'length-truncation';
  loop.lastFailureClass = failureClass;
  let lever: LlmRetryLever;

  if (bonus) {
    loop.bonusAttempts += 1;
    lever = loop.ladder.takeBonus({ cause: failureClass, attempt });
  } else {
    lever = loop.ladder.take({ cause: failureClass, failed: loop.result, attempt });
  }

  loop.ledger.recordDecodeAttempt({ ...loopDecodeRowOf(loop, { attempt, failureClass, result: loop.result, lever }), ...(bonus ? { bonus: true } : {}) }, true);
  loop.ledger.recordFailedAttempt(failureClass);
  loop.nextCorrection = { error: loop.texts.decode[failureClass], kind: 'contract' };
  return 'retry';
}

/**
 * The read lever of one attempt, with what the repair lane did to it.
 */
interface LlmDispatchJudgedReading {
  readonly served: LlmDispatchResult;
  readonly reading: LlmReplyLeverReading;
  readonly repair?: Maybe<LlmReplyRepairSummary>;
  readonly fastFixMiss?: Maybe<LlmReplyFastFixMissReason>;
}

/**
 * A read lever — validate, then critique. A valid, accepted lever settles; a critic's rejection re-asks with a
 * critique correction (no decode row); an invalid lever re-asks with the validator's error (a decode row only when
 * the budget is spent, or when the reply was repaired).
 *
 * @param config - The attempt-stage config.
 * @param loop - The loop state.
 * @param step - The attempt's send and its judged reading.
 * @returns Whether to retry.
 */
async function runLlmDispatchLeverStep(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState, step: LlmDispatchLoopStep & LlmDispatchJudgedReading & { readonly lever: Record<string, unknown> }): Promise<LlmDispatchLoopNext> {
  const { validate, critique, baseRequest, protocol } = config;
  const { sent, attempt, budgetLeft, served, repair, lever } = step;
  const { attemptContext } = sent;
  const { ledger, ladder } = loop;
  const repairedRow = (retryLever?: Maybe<LlmRetryLever>) => llmRepairedDecodeAttemptOf({ attempt, served, summary: repair as LlmReplyRepairSummary, maxOutputTokens: loop.request.maxOutputTokens, lever: retryLever });
  const valid = validateLlmDispatchLever({ validate, lever, attemptContext });
  let next: LlmDispatchLoopNext = 'settle';

  if (valid === true) {
    const verdict =
      critique == null
        ? true
        : await attemptContext.timeAsync('critique', () => critique({ capability: baseRequest.capability, ...(baseRequest.meta == null ? {} : { meta: baseRequest.meta }), lever, replyText: loop.result.text, liveContext: config.liveContext ?? '', replyProtocol: protocol, attempt, callContext: attemptContext }));

    if (verdict === true) {
      if (repair != null) {
        ledger.recordDecodeAttempt(repairedRow(), false);
      }

      loop.recovered = ledger.decodeFailures.length > 0;
      loop.accepted = true;
      loop.acceptedLever = lever;
    } else {
      ledger.validationErrors.push(`attempt ${attempt}: ${verdict.error}`);

      if (budgetLeft) {
        loop.nextCorrection = { error: verdict.error, kind: 'critique' };
        ladder.take({ cause: 'critique', failed: loop.result, attempt });
        next = 'retry';
      } else {
        loop.critiqueFailure = verdict.error;
      }

      ledger.recordFailedAttempt('critique', verdict.error);
    }
  } else {
    ledger.validationErrors.push(`attempt ${attempt}: ${valid.error}`);
    loop.lastFailureClass = 'schema-validation';

    if (budgetLeft) {
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
 * Read one delivered reply — the protocol read, the line lift (a `line` + critique call reads a bare line as a lever)
 * and the reply-repair lane (non-`line`, degenerate). A repair substitutes the reply and patches the attempt's phase.
 *
 * @param config - The attempt-stage config.
 * @param loop - The loop state.
 * @param step - The attempt's send.
 * @returns The judged reading.
 */
async function readLlmDispatchLoopReply(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState, step: LlmDispatchLoopStep): Promise<LlmDispatchJudgedReading> {
  const { protocol, critique, envelope, fastFix } = config;
  const { sent, attempt } = step;
  const { attemptContext } = sent;
  const served = sent.result;
  const read = replyReaderOf(config, attemptContext);
  let reading = read(served.text);
  let repair: Maybe<LlmReplyRepairSummary>;
  let fastFixMiss: Maybe<LlmReplyFastFixMissReason>;

  if (critique != null && protocol === 'line' && reading.kind === 'no-json') {
    const lifted = llmLineReplyLeverOf(served.text, { field: config.lineLeverField ?? DEFAULT_LLM_LINE_LEVER_FIELD, envelope });

    if (lifted != null) {
      reading = { kind: 'lever', lever: lifted };
    }
  }

  if (protocol !== 'line' && isDegenerateLlmReplyReading(reading)) {
    const fastFixLimits = config.fastFixLimits ?? DEFAULT_LLM_REPLY_FAST_FIX_LIMITS;
    const lane = await runLlmReplyRepairLane({ served, attempt, attemptContext, read, unrepairedRefusal: config.fastFixUnavailable ?? 'fast-fix-off', fastFix, fastFixSpent: loop.fastFixCalls >= fastFixLimits.maxPerDispatch, fastFixLimits });
    loop.fastFixCalls += lane.fastFixCalled ? 1 : 0;
    fastFixMiss = lane.fastFixMiss;

    if (lane.repaired != null) {
      loop.result = lane.repaired.result;
      reading = lane.repaired.reading;
      repair = lane.repaired.summary;
      const last = loop.attemptPhases.length - 1;
      loop.attemptPhases[last] = { ...loop.attemptPhases[last], repair };
    }
  }

  return { served, reading, repair, fastFixMiss };
}

/**
 * Judge one delivered reply: read (line lift + repair lane), then a lever is validated / critiqued; a decline (or a
 * `line` reply that is not JSON) is ACCEPTED; any other degenerate reading records its classified row and re-asks
 * while the budget lasts.
 *
 * @param config - The attempt-stage config.
 * @param loop - The loop state.
 * @param step - The attempt's send.
 * @returns Whether to retry.
 */
async function runLlmDispatchReplyStep(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState, step: LlmDispatchLoopStep): Promise<LlmDispatchLoopNext> {
  const judged = await readLlmDispatchLoopReply(config, loop, step);
  const { reading, served, repair, fastFixMiss } = judged;
  const { attempt, budgetLeft } = step;
  const { ledger } = loop;
  let next: LlmDispatchLoopNext = 'settle';

  if (reading.kind === 'lever') {
    next = await runLlmDispatchLeverStep(config, loop, { ...step, ...judged, lever: reading.lever });
  } else if (reading.kind === 'declined' || (config.protocol === 'line' && isDegenerateLlmReplyReading(reading))) {
    // a decline (or a `line` reply that is not JSON) is an ANSWER, never a decode failure
    if (repair != null) {
      ledger.recordDecodeAttempt(llmRepairedDecodeAttemptOf({ attempt, served, summary: repair, maxOutputTokens: loop.request.maxOutputTokens }), false);
      loop.recovered = true;
    }

    loop.accepted = true;
  } else {
    const failureClass = classifyLlmDecodeFailure(reading.kind, loop.result);
    loop.lastFailureClass = failureClass;
    const lever = budgetLeft ? loop.ladder.take({ cause: failureClass, failed: loop.result, attempt }) : undefined;
    ledger.recordDecodeAttempt({ ...loopDecodeRowOf(loop, { attempt, failureClass, result: loop.result, lever }), ...(fastFixMiss == null ? {} : { fastFix: 'missed' as const, fastFixMiss }) }, budgetLeft);
    ledger.recordFailedAttempt(failureClass);

    if (budgetLeft) {
      loop.nextCorrection = { error: loop.texts.decode[failureClass], kind: 'contract' };
      next = 'retry';
    }
  }

  return next;
}

/**
 * Run ONE pass of the bounded loop: compose the attempt's request (the latest correction on the base request, then
 * every lever taken so far), send it, stamp its phase, and branch — the transport lane, the truncation pre-read, the
 * bonus attempt, or the reply judgement.
 *
 * @param config - The attempt-stage config.
 * @param loop - The loop state.
 * @returns Whether to retry.
 */
async function runLlmDispatchLoopPass(config: LlmDispatchAttemptsConfig, loop: LlmDispatchLoopState): Promise<LlmDispatchLoopNext> {
  const { strategy, baseRequest, protocol, callContext, signal, pause, maxAttempts } = config;
  const attempt = loop.attempts + 1;
  const { nextCorrection } = loop;
  let request = baseRequest;
  loop.sentCorrection = undefined;

  if (nextCorrection != null) {
    loop.sentCorrection = llmDispatchCorrectionTextOf({ ...nextCorrection, protocol, texts: loop.texts });
    request = withLlmDispatchCorrection(baseRequest, { text: loop.sentCorrection, kind: nextCorrection.kind, protocol, attempt, slotId: config.correctionSlotId ?? 'correction' });
  }

  loop.request = loop.ladder.apply(request);
  loop.attempts = attempt;
  const budgetLeft = attempt < maxAttempts + loop.bonusAttempts;
  const sent = await sendLlmDispatchAttempt({ strategy, request: loop.request, attempt, callContext, signal, pause });
  const retry = loop.ladder.takePending();
  loop.attemptPhases.push(llmAttemptPhaseOf({ attempt, attemptContext: sent.attemptContext, result: sent.result, retry }));
  loop.result = sent.result;
  const lengthCapped = isLlmLengthCappedFinish(sent.result);
  loop.lengthCapped = loop.lengthCapped || lengthCapped;
  const step: LlmDispatchLoopStep = { sent, attempt, budgetLeft };
  let next: LlmDispatchLoopNext;

  if (sent.fault != null) {
    next = await runLlmDispatchFaultStep(config, loop, step);
  } else if (lengthCapped && budgetLeft) {
    next = runLlmDispatchTruncatedStep(loop, { ...step, bonus: false });
  } else if (lengthCapped && strategy.supportsReasoningParam !== false && loop.bonusAttempts < LLM_RETRY_INDUCED_BONUS_ATTEMPTS && retry?.lever === 'reasoning-low') {
    next = runLlmDispatchTruncatedStep(loop, { ...step, bonus: true });
  } else {
    next = await runLlmDispatchReplyStep(config, loop, step);
  }

  return next;
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
 * The VALIDATED path (a `validate` or a `critique` is set) — the BOUNDED retry loop, up to `maxAttempts` attempts (plus
 * at most one bonus attempt).
 *
 * - **Transport lane.** An abort records a `timeout` row, a retryable transport error a `transport` row (with its
 *   summary); either resends identical bytes (a transport resend after the backoff) unless the budget is spent or the
 *   dispatch is cancelled. Any other throw propagates.
 * - **Truncation.** A length-capped reply is never parsed while budget remains; it re-asks with a raised budget.
 * - **Reply.** A delivered reply is read, repaired (deterministic tier, then the bound fast fix), validated and
 *   critiqued. Every rejection re-asks with a `## Correction` block naming only the latest failure, and moves ONE
 *   lever of the ladder.
 *
 * Every rejected attempt records its failed-attempt row (with the correction it was sent with and the retry it
 * bought); decode rows follow the decode-failure population rules. The result is stamped `attempts`, `decodeStatus`,
 * `decodeOutcome`, `lengthCapped?`, `lever?` and `validationErrors?`.
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
      recordFailedAttempt(cause, error) {
        // reads the CURRENT attempt: its (possibly repaired) reply, the cap it was sent with, its correction, and the retry this failure bought
        failedAttempts.push(llmFailedAttemptOf({ attempt: loop.attempts, cause, result: loop.result, maxOutputTokens: loop.request.maxOutputTokens, error, correction: loop.sentCorrection, retry: ladder.pending() }));
      }
    },
    attemptPhases: [],
    texts: config.corrections ?? DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS,
    attempts: 0,
    bonusAttempts: 0,
    fastFixCalls: 0,
    request: baseRequest,
    result: { text: '', strategyId: strategy.id, capability: baseRequest.capability },
    lengthCapped: false,
    accepted: false,
    recovered: false
  };

  while ((await runLlmDispatchLoopPass(config, loop)) === 'retry') {
    // each pass sends one attempt
  }

  const { result, accepted, recovered, acceptedLever, attempts, lengthCapped, critiqueFailure, attemptPhases } = loop;
  const decodeStatus = llmDecodeStatusOf(accepted, attempts);
  const decodeOutcome = classifyLlmReplyOutcome(result, accepted ? undefined : (loop.lastFailureClass ?? undefined));
  const lever = acceptedLever === undefined ? undefined : JSON.stringify(acceptedLever);

  return {
    result: { ...result, attempts, decodeStatus, decodeOutcome, ...(lengthCapped ? { lengthCapped: true } : {}), ...(lever == null ? {} : { lever }), ...(validationErrors.length > 0 ? { validationErrors } : {}) },
    finalRequest: loop.request,
    attemptPhases,
    decodeFailures,
    failedAttempts,
    recovered,
    ...(critiqueFailure == null ? {} : { critiqueFailure })
  };
}
