/**
 * ONE attempt's stages — send (one `strategy.complete` in an `attempt-N` child context), decode (read the reply, then
 * the reply-repair lane on a degenerate JSON reading) and validate (the request's lever validator).
 */

import { type Maybe } from '@dereekb/util';
import { LLM_REPLY_REPAIR_FAST_FIX_SWALLOW_SITE } from '../capability/llm.capability.repair.reply.json';
import { type LlmCallContext } from '../record/llm.call.context';
import { isLlmCleanStopFinish } from '../record/llm.decode.failure';
import { DEFAULT_LLM_REPLY_ENVELOPE_KEYS, type LlmReplyEnvelopeKeys, type LlmReplyLeverReading, readLlmReplyLever } from '../reply/llm.reply.envelope';
import { DEFAULT_LLM_REPLY_FAST_FIX_LIMITS, LLM_REPAIR_REPLY_JSON_CAPABILITY, type LlmReplyFastFixer, type LlmReplyFastFixLimits, type LlmReplyFastFixMissReason, type LlmReplyFastFixOutcome } from '../reply/llm.reply.fast.fix';
import { type LlmReplyJsonShape } from '../reply/llm.reply.json.shape';
import { type LlmReplyProtocol } from '../reply/llm.reply.protocol';
import { repairLlmReplyJson } from '../reply/llm.reply.repair';
import { type LlmLeverValidator } from '../reply/llm.reply.validator';
import { type LlmSwallowSink } from '../record/llm.swallow';
import { isAbortError, isRetryableLlmError, llmErrorSummaryOf } from '../strategy/llm.error';
import { type LlmDispatchResult, type LlmReplyRepairSummary, type LlmRequest, type LlmStrategy } from '../strategy/llm.strategy';
import { type LlmDispatchPauseSignal, parkLlmDispatchWhilePaused } from './llm.dispatch.control';
import { llmTimeoutResultOf, llmTransportResultOf, roundLlmReplyRepairScore } from './llm.dispatch.outcome';
import { type LlmDispatchRequest } from './llm.dispatch.request';

/**
 * Why a send did not reach a reply: the call was aborted (`timeout`) or its transport failed retryably (`transport`).
 */
export type LlmDispatchAttemptFault = 'timeout' | 'transport';

/**
 * The inputs of {@link sendLlmDispatchAttempt}.
 */
export interface SendLlmDispatchAttemptConfig {
  /**
   * The strategy to call.
   */
  readonly strategy: LlmStrategy;
  /**
   * The request this attempt sends.
   */
  readonly request: LlmRequest;
  /**
   * The 1-based attempt ordinal — names the child context (`attempt-N`).
   */
  readonly attempt: number;
  /**
   * The dispatch's call context.
   */
  readonly callContext: LlmCallContext;
  /**
   * The forwarded cancellation signal.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * The host pause gate — parked on QUIETLY (span only) before the send.
   */
  readonly pause?: Maybe<LlmDispatchPauseSignal>;
}

/**
 * What one send produced.
 */
export interface LlmDispatchAttemptSend {
  /**
   * The attempt's child context.
   */
  readonly attemptContext: LlmCallContext;
  /**
   * The reply envelope — the synthetic timeout / transport envelope when {@link fault} is set.
   */
  readonly result: LlmDispatchResult;
  /**
   * Why the send failed, when it did.
   */
  readonly fault?: LlmDispatchAttemptFault;
  /**
   * The caught error, when {@link fault} is set — a caller that does not absorb the fault rethrows it.
   */
  readonly error?: unknown;
  /**
   * The bounded summary of a transport error.
   */
  readonly transportError?: string;
}

/**
 * Send one attempt: park quietly on the host gate, then run `strategy.complete` inside a `complete` span on a fresh
 * `attempt-N` child context. An abort (tested FIRST, so an error matching both reads as an abort) becomes a `timeout`
 * fault; a retryable transport error a `transport` fault; any other throw propagates.
 *
 * @param config - The strategy, the request, the attempt ordinal, the contexts and the control signals.
 * @returns The send's envelope (or fault).
 */
export async function sendLlmDispatchAttempt(config: SendLlmDispatchAttemptConfig): Promise<LlmDispatchAttemptSend> {
  const { strategy, request, attempt, callContext, signal, pause } = config;
  await parkLlmDispatchWhilePaused({ pause, signal, callContext });
  const attemptContext = callContext.child(`attempt-${attempt}`);
  let send: LlmDispatchAttemptSend;

  try {
    const result = await attemptContext.timeAsync('complete', () => strategy.complete(request, signal == null ? undefined : { signal }));
    send = { attemptContext, result };
  } catch (error) {
    if (isAbortError(error)) {
      send = { attemptContext, result: llmTimeoutResultOf(request, strategy.id), fault: 'timeout', error };
    } else if (isRetryableLlmError(error)) {
      send = { attemptContext, result: llmTransportResultOf(request, strategy.id), fault: 'transport', error, transportError: llmErrorSummaryOf(error) };
    } else {
      throw error;
    }
  }

  return send;
}

/**
 * How {@link readLlmDispatchReply} reads a reply.
 */
export interface ReadLlmDispatchReplyConfig {
  /**
   * The call's reply protocol — `json-envelope` reads through the envelope keys.
   */
  readonly protocol: LlmReplyProtocol;
  /**
   * The host's envelope keys. Defaults to {@link DEFAULT_LLM_REPLY_ENVELOPE_KEYS} on a `json-envelope` read.
   */
  readonly envelope?: Maybe<LlmReplyEnvelopeKeys>;
  /**
   * Where an unparseable block is counted.
   */
  readonly swallow?: Maybe<LlmSwallowSink>;
}

/**
 * Read a reply's lever by the call's protocol.
 *
 * @param text - The reply text.
 * @param config - The protocol, the envelope keys and the swallow sink.
 * @returns The reading.
 */
export function readLlmDispatchReply(text: string, config: ReadLlmDispatchReplyConfig): LlmReplyLeverReading {
  const { protocol, envelope, swallow } = config;
  return readLlmReplyLever(text, { envelope: protocol === 'json-envelope' ? (envelope ?? DEFAULT_LLM_REPLY_ENVELOPE_KEYS) : undefined, swallow });
}

/**
 * Whether a reading is degenerate — no JSON, or JSON that did not parse.
 *
 * @param reading - The reading.
 * @returns `true` for `no-json` / `parse-error`.
 */
export function isDegenerateLlmReplyReading(reading: LlmReplyLeverReading): boolean {
  return reading.kind === 'no-json' || reading.kind === 'parse-error';
}

/**
 * Why the reply-repair lane left an object-led malformed reply for the ordinary re-ask / drop — the published
 * `reply-repair-refused` diag vocabulary.
 */
export type LlmReplyRepairRefusal = 'unclean-finish' | 'truncated-looking' | 'mangled' | 'fast-fix-off' | 'fast-fix-spent' | 'too-long' | 'low-score' | 'no-schema';

/**
 * The inputs of one {@link runLlmReplyRepairLane} pass.
 */
export interface RunLlmReplyRepairLaneConfig {
  /**
   * The reply as SERVED (before any substitution).
   */
  readonly served: LlmDispatchResult;
  /**
   * The 1-based attempt it answered.
   */
  readonly attempt: number;
  /**
   * The attempt's context — the diag rows land here.
   */
  readonly attemptContext: LlmCallContext;
  /**
   * Re-reads a repaired reply (the same protocol / envelope / swallow as the first read).
   */
  readonly read: (text: string) => LlmReplyLeverReading;
  /**
   * The refusal when no fast fix is bound (`fast-fix-off`, `no-schema`, or the single-shot path's `mangled`) — the
   * reason an object-led, clean-stopped reply the deterministic walk could not repair is left alone.
   */
  readonly unrepairedRefusal: LlmReplyRepairRefusal;
  /**
   * The bound fast fix — absent ⇒ the deterministic tier only.
   */
  readonly fastFix?: Maybe<LlmBoundReplyFastFix>;
  /**
   * Whether this dispatch already spent its fast-fix calls.
   */
  readonly fastFixSpent?: Maybe<boolean>;
  /**
   * The fast-fix gates (`maxChars` / `minScore`), defaulting to `DEFAULT_LLM_REPLY_FAST_FIX_LIMITS`. Read only when
   * {@link fastFix} is bound.
   */
  readonly fastFixLimits?: Maybe<Pick<LlmReplyFastFixLimits, 'maxChars' | 'minScore'>>;
}

/**
 * The inputs of one bound fast-fix call — the subject reply, its shape, its attempt and the attempt's context.
 */
export interface LlmBoundReplyFastFixInput {
  /**
   * The subject's served reply text.
   */
  readonly text: string;
  /**
   * The scorer's read of it.
   */
  readonly shape: LlmReplyJsonShape;
  /**
   * The 1-based subject attempt.
   */
  readonly attempt: number;
  /**
   * The subject attempt's context — the fixer's own dispatch nests under it.
   */
  readonly callContext: LlmCallContext;
}

/**
 * A fast fix BOUND to one dispatch (its request, schema hint and self-dispatch already applied).
 */
export type LlmBoundReplyFastFix = (input: LlmBoundReplyFastFixInput) => Promise<LlmReplyFastFixOutcome>;

/**
 * The inputs of {@link llmBoundReplyFastFixOf}.
 */
export interface LlmBoundReplyFastFixConfig<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult> {
  /**
   * The host's fast fixer, when configured.
   */
  readonly replyFastFix?: Maybe<LlmReplyFastFixer<R, X>>;
  /**
   * The subject request.
   */
  readonly request: R;
  /**
   * The subject's RESOLVED reply protocol.
   */
  readonly protocol: LlmReplyProtocol;
  /**
   * The subject's resolved response-schema hint.
   */
  readonly schemaHint?: unknown;
  /**
   * The dispatcher's own dispatch (the fixer call is an ordinary, recorded dispatch).
   */
  readonly dispatch: (request: R) => Promise<X>;
}

/**
 * The fast-fix binding of one dispatch.
 */
export interface LlmBoundReplyFastFixBinding {
  /**
   * The bound fix — present only when a fixer is configured, the call is eligible and a schema resolved.
   */
  readonly fastFix?: LlmBoundReplyFastFix;
  /**
   * The repair-lane refusal when no fix is bound: `no-schema` when the call was eligible but had no schema, else
   * `fast-fix-off`.
   */
  readonly fastFixUnavailable: LlmReplyRepairRefusal;
}

/**
 * Bind the host's fast fixer to one dispatch. Never binds on the repair capability itself (the recursion guard), on a
 * `line` call, or without a configured fixer; an eligible call with no schema hint binds nothing either (`no-schema`).
 *
 * @param config - The fixer, the request, the resolved protocol, the schema hint and the self-dispatch.
 * @returns The binding.
 */
export function llmBoundReplyFastFixOf<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult>(config: LlmBoundReplyFastFixConfig<R, X>): LlmBoundReplyFastFixBinding {
  const { replyFastFix, request, protocol, schemaHint, dispatch } = config;
  const bindable = replyFastFix != null && request.capability !== LLM_REPAIR_REPLY_JSON_CAPABILITY && protocol !== 'line';
  let binding: LlmBoundReplyFastFixBinding;

  if (bindable && schemaHint != null) {
    binding = { fastFix: (input) => replyFastFix({ ...input, request, subjectCapability: request.capability, schemaHint, dispatch }), fastFixUnavailable: 'no-schema' };
  } else {
    binding = { fastFixUnavailable: bindable ? 'no-schema' : 'fast-fix-off' };
  }

  return binding;
}

/**
 * A reply the lane repaired.
 */
export interface LlmRepairedReply {
  /**
   * The substituted envelope — `text` is the repaired JSON, `repair.originalText` the model's bytes.
   */
  readonly result: LlmDispatchResult;
  /**
   * The re-read of the repaired text.
   */
  readonly reading: LlmReplyLeverReading;
  /**
   * The bounded repair summary.
   */
  readonly summary: LlmReplyRepairSummary;
}

/**
 * What one {@link runLlmReplyRepairLane} pass produced.
 */
export interface LlmReplyRepairLaneResult {
  /**
   * The repair — present iff the reply was repaired.
   */
  readonly repaired?: LlmRepairedReply;
  /**
   * Whether the lane spent a fast-fix call.
   */
  readonly fastFixCalled: boolean;
  /**
   * Why the fast fix missed, when it was called and missed.
   */
  readonly fastFixMiss?: LlmReplyFastFixMissReason;
}

/**
 * Substitute a repaired reply into the served envelope — `text` becomes the repaired JSON, and the model's own bytes
 * ride `repair.originalText`.
 *
 * @param served - The served envelope.
 * @param summary - The bounded repair summary.
 * @param text - The repaired JSON text.
 * @returns The substituted envelope.
 */
export function withRepairedLlmReply(served: LlmDispatchResult, summary: LlmReplyRepairSummary, text: string): LlmDispatchResult {
  return { ...served, text, repair: { ...summary, originalText: served.text } };
}

/**
 * The fast-fix tier of the reply-repair lane — one call of the bound fixer. A throw is swallowed at
 * `llm/reply-repair.fast-fix` and reads as a `error` miss.
 *
 * @param config - The lane config (with a bound {@link RunLlmReplyRepairLaneConfig.fastFix}).
 * @param shape - The scorer's read of the served reply.
 * @returns The lane outcome.
 */
async function runLlmReplyFastFixTier(config: RunLlmReplyRepairLaneConfig & { readonly fastFix: LlmBoundReplyFastFix }, shape: LlmReplyJsonShape): Promise<LlmReplyRepairLaneResult> {
  const { served, attempt, attemptContext, read, fastFix } = config;
  const capability = served.capability;
  let fixed: LlmReplyFastFixOutcome;
  let outcome: LlmReplyRepairLaneResult;

  try {
    fixed = await attemptContext.timeAsync('fast-fix', () => fastFix({ text: served.text, shape, attempt, callContext: attemptContext }));
  } catch (error) {
    attemptContext.swallow(LLM_REPLY_REPAIR_FAST_FIX_SWALLOW_SITE, error);
    fixed = { kind: 'missed', reason: 'error' };
  }

  if (fixed.kind === 'fixed') {
    const score = roundLlmReplyRepairScore(shape.score);
    const summary: LlmReplyRepairSummary = { tier: 'fast-fix', attempt, verdict: shape.verdict, score, ...(fixed.meta == null ? {} : { meta: fixed.meta }) };
    const result = withRepairedLlmReply(served, summary, fixed.text);
    attemptContext.diag({ level: 'info', code: 'reply-repaired', fields: { capability, attempt, tier: 'fast-fix', verdict: shape.verdict, score }, message: 'mangled JSON reply repaired by one fast-fix call before any re-ask' });
    outcome = { repaired: { result, reading: read(result.text), summary }, fastFixCalled: true };
  } else {
    attemptContext.diag({ level: 'warn', code: 'reply-fast-fix-miss', fields: { capability, attempt, reason: fixed.reason }, message: 'the fast fix produced no usable lever; falling through to the re-ask / drop' });
    outcome = { fastFixCalled: true, fastFixMiss: fixed.reason };
  }

  return outcome;
}

/**
 * THE REPLY-REPAIR LANE — runs on a degenerate (`no-json` / `parse-error`) JSON reading before any re-ask.
 *
 * 1. A prose-led reply is never touched and files nothing.
 * 2. An object-led reply that did not end on a clean stop is refused (`unclean-finish`).
 * 3. A `near-miss` is repaired by the free deterministic walk (`reply-repaired` diag).
 * 4. A `truncated-looking` reply is refused as such; a `not-json` one as `low-score`.
 * 5. With no bound fast fix, anything else is refused with {@link RunLlmReplyRepairLaneConfig.unrepairedRefusal}.
 * 6. Otherwise the fast-fix tier: refused as `fast-fix-spent` once the dispatch spent its calls, `too-long` past
 *    `maxChars`, `low-score` under `minScore`; else ONE fixer call — a fix substitutes the reply (`reply-repaired`), a
 *    miss files `reply-fast-fix-miss` and falls through.
 *
 * A refusal files one `reply-repair-refused` diag.
 *
 * @param config - The served reply, its attempt, its context, the re-read, the refusal and the fast-fix binding.
 * @returns The repair (when one landed) and the fast-fix accounting.
 */
export async function runLlmReplyRepairLane(config: RunLlmReplyRepairLaneConfig): Promise<LlmReplyRepairLaneResult> {
  const { served, attempt, attemptContext, read, unrepairedRefusal, fastFix, fastFixSpent } = config;
  const fastFixLimits = config.fastFixLimits ?? DEFAULT_LLM_REPLY_FAST_FIX_LIMITS;
  const { shape, repaired } = repairLlmReplyJson(served.text);
  const capability = served.capability;
  const score = roundLlmReplyRepairScore(shape.score);
  let refusal: Maybe<LlmReplyRepairRefusal>;
  let outcome: LlmReplyRepairLaneResult = { fastFixCalled: false };

  if (!shape.objectLed) {
    // prose-led: never touched, files nothing
  } else if (!isLlmCleanStopFinish(served)) {
    refusal = 'unclean-finish';
  } else if (repaired != null) {
    const summary: LlmReplyRepairSummary = { tier: 'deterministic', attempt, verdict: shape.verdict, score, ops: repaired.ops };
    const result = withRepairedLlmReply(served, summary, repaired.text);
    const ops = Object.entries(repaired.ops)
      .map(([kind, count]) => `${kind}:${count}`)
      .join(',');
    attemptContext.diag({ level: 'info', code: 'reply-repaired', fields: { capability, attempt, tier: 'deterministic', verdict: shape.verdict, score, ops }, message: 'malformed JSON reply repaired deterministically before any re-ask' });
    outcome = { repaired: { result, reading: read(result.text), summary }, fastFixCalled: false };
  } else if (shape.verdict === 'truncated-looking') {
    refusal = 'truncated-looking';
  } else if (shape.verdict === 'not-json') {
    refusal = 'low-score';
  } else if (fastFix == null) {
    refusal = unrepairedRefusal;
  } else if (fastFixSpent === true) {
    refusal = 'fast-fix-spent';
  } else if (served.text.length > fastFixLimits.maxChars) {
    refusal = 'too-long';
  } else if (shape.score < fastFixLimits.minScore) {
    refusal = 'low-score';
  } else {
    outcome = await runLlmReplyFastFixTier({ ...config, fastFix }, shape);
  }

  if (refusal != null) {
    attemptContext.diag({ level: 'info', code: 'reply-repair-refused', fields: { capability, attempt, verdict: shape.verdict, score, reason: refusal }, message: 'malformed JSON reply left for the ordinary re-ask / drop' });
  }

  return outcome;
}

/**
 * The inputs of {@link validateLlmDispatchLever}.
 */
export interface ValidateLlmDispatchLeverConfig {
  /**
   * The validator — absent ⇒ every lever is valid.
   */
  readonly validate?: Maybe<LlmLeverValidator>;
  /**
   * The read lever.
   */
  readonly lever: unknown;
  /**
   * The attempt's context — the `validate` span lands here.
   */
  readonly attemptContext: LlmCallContext;
}

/**
 * Validate a read lever inside a `validate` span.
 *
 * @param config - The validator, the lever and the attempt context.
 * @returns `true`, or the validator's `{ error }`.
 */
export function validateLlmDispatchLever(config: ValidateLlmDispatchLeverConfig): true | { readonly error: string } {
  const { validate, lever, attemptContext } = config;
  return validate == null ? true : attemptContext.time('validate', () => validate(lever));
}
