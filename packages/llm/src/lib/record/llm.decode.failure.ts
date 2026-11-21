/**
 * The **LLM decode-failure model**: the classes, classifiers and bounded excerpts for the DEGENERATE completions a
 * reply reader or schema validator could not turn into a usable answer.
 *
 * A dispatcher classifies each decode failure ({@link classifyLlmDecodeFailure}), records a degeneration-safe excerpt
 * ({@link collapseDegenerateRuns}), and emits ONE decode-failure record per dispatch that hit any, so the question
 * "which dispatches emitted malformed / truncated / unparseable completions, and did the bounded retry recover them"
 * has durable evidence. Without it, a reply that degenerated into a whitespace loop, ran into the `max_tokens` cap and
 * was discarded leaves no trace that it ever happened.
 *
 * Every excerpt is collapsed BEFORE it is cut, so a whitespace runaway cannot blow the excerpt budget while its shape
 * and size stay visible.
 */

import { cutString, isNotBlankString, sliceStringFunction, type Maybe, type Milliseconds, type HexString, type PercentDecimal, type Count } from '@dereekb/util';
import type { FetchErrorClassification } from '@dereekb/util/fetch';
import type { LlmCapabilityKey, LlmModelId, LlmModelTierKey, LlmTokenCount } from '../model/llm.value';
import type { LlmCallMeta, LlmCompletion, LlmReplyOutcomeClass, LlmReplyRepairTier } from '../strategy/llm.strategy';

/**
 * The synthetic {@link LlmCompletion.finishReason} a dispatcher stamps on the envelope it fabricates for an ABORTED
 * call (the per-request timeout signal fired) — a value no real provider returns, so {@link classifyLlmDecodeFailure}
 * maps it to `'timeout'` without touching the real finish-reason paths.
 *
 * The value is persisted as a record's `finishReason`, so it never changes.
 */
export const LLM_TIMEOUT_FINISH_REASON = '__timeout__';

/**
 * The synthetic `finishReason` stamped on a RETRYABLE TRANSPORT failure — the call never reached the model at all
 * (connection reset, rate limit, gateway 5xx), so there is no reply to read and nothing the model did wrong.
 *
 * Kept APART from {@link LLM_TIMEOUT_FINISH_REASON} on purpose: a deadline says the model was too SLOW, this says it
 * was never ASKED. Folding the two would book a provider outage as model latency in every record, and the retry
 * ladders differ — a timeout may usefully turn reasoning off, a connection error may only wait and resend.
 *
 * The value is persisted as a record's `finishReason`, so it never changes.
 */
export const LLM_TRANSPORT_FINISH_REASON = '__transport__';

/**
 * The synthetic `finishReason` stamped on an UNRETRYABLE send failure — the send threw an error the retry policy does
 * not resend (a `permanent` one, or an `unknown` one the host did not vouch for), so the call fails at once. Like
 * {@link LLM_TRANSPORT_FINISH_REASON}, no reply came back.
 *
 * The value is persisted as a record's `finishReason`, so it never changes.
 */
export const LLM_UNRETRYABLE_FINISH_REASON = '__unretryable__';

/**
 * The three synthetic send-failure `finishReason`s — {@link LLM_TIMEOUT_FINISH_REASON},
 * {@link LLM_TRANSPORT_FINISH_REASON} and {@link LLM_UNRETRYABLE_FINISH_REASON}.
 *
 * A dispatcher records every failed send, on either lane, as a call row carrying one of these. A ledger therefore
 * counts send failures by these rows ({@link isLlmSendFailureFinishReason}), not by unpaired start records: a pairing
 * count misses `__unretryable__`, which is filed as a call row.
 */
export const LLM_SEND_FAILURE_FINISH_REASONS = [LLM_TIMEOUT_FINISH_REASON, LLM_TRANSPORT_FINISH_REASON, LLM_UNRETRYABLE_FINISH_REASON] as const;

/**
 * One of the {@link LLM_SEND_FAILURE_FINISH_REASONS}.
 */
export type LlmSendFailureFinishReason = (typeof LLM_SEND_FAILURE_FINISH_REASONS)[number];

/**
 * Whether a record's `finishReason` is one of the synthetic send-failure sentinels
 * ({@link LLM_SEND_FAILURE_FINISH_REASONS}) — the row of a send that never brought a reply back.
 *
 * @param finishReason - The record's `finishReason`.
 * @returns `true` for `__timeout__`, `__transport__` and `__unretryable__`.
 */
export function isLlmSendFailureFinishReason(finishReason: Maybe<string>): finishReason is LlmSendFailureFinishReason {
  return finishReason != null && (LLM_SEND_FAILURE_FINISH_REASONS as ReadonlyArray<string>).includes(finishReason);
}

/**
 * The family of decode failure one attempt hit — `parse-error` (a `{…}` block that would not parse, or a reply with
 * no JSON object at all), `length-truncation` (the completion hit the `max_tokens` cap mid-object),
 * `schema-validation` (a parsed-but-invalid answer the capability validator rejected), `empty-result` (a blank
 * completion), `timeout` (the per-request abort signal fired — the call exceeded its wall and never returned, now
 * caught and retried instead of hanging), `transport` (the call never reached the model), or `unretryable` (the send
 * threw an error the retry policy does not resend — a `permanent` one, or an `unknown` one the host did not vouch
 * for; the call fails at once).
 */
export type LlmDecodeFailureClass = 'parse-error' | 'length-truncation' | 'schema-validation' | 'empty-result' | 'timeout' | 'transport' | 'unretryable';

/**
 * WHY a retry was needed — a decode-failure class, or `'critique'` (the reply decoded, but a judge rejected it).
 *
 * Declared beside {@link LlmDecodeFailureClass} because both the call records and the retry ladder key on it.
 */
export type LlmRetryCause = LlmDecodeFailureClass | 'critique';

/**
 * The two DEGENERATE reply readings {@link classifyLlmDecodeFailure} refines — passed by a dispatcher so a blank
 * `no-json` reply is distinguished from a broken-`{…}` `parse-error`.
 */
export type LlmDecodeReadingKind = 'no-json' | 'parse-error';

/**
 * The maximum length a recorded excerpt (a raw-reply excerpt or the volatile-suffix context tail) is kept at —
 * bounded by construction so the record stays lean whether or not the host captures reply text. A degenerate run is
 * collapsed FIRST ({@link collapseDegenerateRuns}), so this rarely bites.
 */
export const LLM_DECODE_FAILURE_EXCERPT_MAX_LENGTH = 500;

/**
 * The shortest repeated-character run {@link collapseDegenerateRuns} collapses — a run of one char strictly LONGER
 * than this is replaced with the first {@link DEGENERATE_RUN_KEEP} chars plus a `«×N»` count annotation.
 */
export const DEGENERATE_RUN_THRESHOLD: Count = 8;

/**
 * How many chars of a collapsed degenerate run are kept before the `«×N»` annotation.
 */
export const DEGENERATE_RUN_KEEP: Count = 8;

/**
 * The most chars one failed attempt's reply keeps as a failed-attempt row's `text` — far above any real reply, so a
 * real reply is always kept VERBATIM, while a 16–32k-token whitespace runaway stays bounded.
 */
export const LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH = 16_000;

/**
 * How many chars a reply's {@link llmDecodeFailureTailExcerpt} keeps.
 */
export const LLM_DECODE_FAILURE_TAIL_EXCERPT_MAX_LENGTH = 200;

/**
 * One recorded decode-failure attempt — the per-`strategy.complete` diagnostic a retry loop pushes for every attempt
 * that failed to decode / validate (the accepted final attempt is NOT pushed).
 */
export interface LlmDecodeFailureAttempt {
  /**
   * The 1-based attempt ordinal.
   */
  readonly attempt: number;
  /**
   * The failure family this attempt hit.
   */
  readonly class: LlmDecodeFailureClass;
  /**
   * A degeneration-safe, length-bounded excerpt of the raw reply ({@link collapseDegenerateRuns} then head-cut).
   */
  readonly excerpt: string;
  /**
   * The raw reply length (chars) BEFORE collapse — so a runaway is visible even though the excerpt is bounded.
   */
  readonly rawLength: number;
  /**
   * Why generation stopped ({@link LlmCompletion.finishReason}), when the provider echoed one.
   */
  readonly finishReason?: string;
  /**
   * The completion token count for this attempt, when the provider reported usage.
   */
  readonly completionTokens?: LlmTokenCount;
  /**
   * The provider latency for this attempt, when reported.
   */
  readonly latencyMs?: Milliseconds;
  /**
   * The completion budget (`max_tokens`) this attempt was SENT with — the raised cap on a `length-truncation`
   * re-ask, so a ledger shows the budget being raised across attempts. A dispatched request always carries its cap,
   * so every dispatcher row has it; omitted only for a request that named none (a row built outside a dispatcher).
   */
  readonly maxOutputTokens?: LlmTokenCount;
  /**
   * The capability validator's error summary — present only on a `schema-validation` attempt.
   */
  readonly validatorError?: string;
  /**
   * WHAT the transport threw — `"<class> <status>: <message>"` (e.g. `RateLimitError 429: Rate limit exceeded`),
   * present on a `transport` or `unretryable` attempt. The reply envelope is synthesized EMPTY on that lane, so
   * without this the record cannot tell an exhausted key (429) from a network outage from a gateway 5xx.
   */
  readonly transportError?: string;
  /**
   * The send error's classification when it was NOT transient — present on every `unretryable` attempt
   * (`permanent` / `unknown`), and on a `transport` attempt only when the host approved an `unknown` error. Absent
   * means transient, so an ordinary transport row and every timeout row stay byte-identical.
   */
  readonly errorClassification?: Exclude<FetchErrorClassification, 'transient'>;
  /**
   * WHICH RETRY LEVER this failure BOUGHT — the rung the ladder moved for the attempt that followed (an
   * `LlmRetryLeverKind`), or `'none'` when nothing could change a sent byte. Absent on the FINAL failed attempt
   * (nothing followed it), so a ledger and the per-attempt phase block read the same decision from two directions
   * and cannot drift.
   */
  readonly lever?: string;
  /**
   * `true` when the retry this failure bought is a dispatcher's ONE bonus attempt past its attempt cap — the
   * cap-ended reply was induced by the `reasoning-low` rung the ladder had just taken, and the bonus undoes it.
   */
  readonly bonus?: true;
  /**
   * Which reply-repair tier FIXED this attempt's malformed reply, so the dispatch did not re-ask for it — the row
   * stays class `parse-error` (the model's malformed-output rate stays visible for model choice) and the record
   * reads `recovered: true`. Absent on an attempt nothing repaired.
   */
  readonly repaired?: LlmReplyRepairTier;
  /**
   * The deterministic repair ops applied (deterministic tier only).
   */
  readonly repairOps?: Readonly<Record<string, Count>>;
  /**
   * The reply-repair scorer's reading of a `parse-error` reply — its verdict and JSON-likeness score — so a log reader
   * reads verdicts without re-parsing. Present on every `parse-error` attempt.
   */
  readonly shape?: { readonly verdict: string; readonly score: PercentDecimal };
  /**
   * `'missed'` when the fast fix was called for this attempt and produced no usable answer.
   */
  readonly fastFix?: 'missed';
  /**
   * Why the fast fix missed (present with {@link fastFix}).
   */
  readonly fastFixMiss?: string;
  /**
   * The fast fixer's `meta` on a miss — host data of the fixer's own call (the fix call's id, say), so a host can link
   * this row to the fix call it paid for. Present only with `fastFix: 'missed'`, and only when the fixer returned one.
   * A fix's `meta` rides the call record's `repair.meta` instead.
   */
  readonly fastFixMeta?: LlmCallMeta;
  /**
   * A degeneration-safe TAIL excerpt ({@link llmDecodeFailureTailExcerpt}) of a `parse-error` / `length-truncation`
   * reply longer than the head {@link excerpt} — JSON slips concentrate at the END, and a head excerpt alone leaves
   * the next slip unmeasurable.
   */
  readonly tailExcerpt?: string;
}

/**
 * The payload of one decode-failure record — ONE per dispatch that hit any decode failure (never more). Carries the
 * dispatch attribution, the prompt fingerprint `cachePrefixHash`, the volatile-suffix context tail (which carries the live request
 * fragment for free), whether the bounded retry `recovered`, and the per-attempt `failures`.
 */
export interface LlmDecodeFailurePayload {
  /**
   * The capability the dispatch served.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The model that served the (final) attempt, when known.
   */
  readonly model?: LlmModelId;
  /**
   * The resolved tier key, when the dispatch resolved one (absent for a raw-slug override or a scripted strategy).
   */
  readonly tier?: LlmModelTierKey;
  /**
   * Whether the dispatch SENT `response_format` json_schema/strict (generation-time enforcement was requested).
   */
  readonly schemaEnforced?: boolean;
  /**
   * The prompt fingerprint — the SAME 16-hex `llmPromptCacheHash` (a `sha256HexPrefix`) the prompt cache watch stamps
   * on the call record's top-level `cachePrefixHash`, so a decode failure groups with its call rows on
   * one key name and one value. Groups repeat failures of the SAME prompt without recording the (heavy) prompt itself.
   *
   * On a ROOT dispatch it is the watch's hash of the stable cache prefix (the whole prompt when no segment is
   * volatile). A chained FOLLOW-UP has no cache prefix and no watch hash, so it falls back to the `llmPromptCacheHash`
   * of the whole prompt the follow-up sent — a follow-up's call record carries no `cachePrefixHash` to match it.
   */
  readonly cachePrefixHash: HexString;
  /**
   * The prompt length (chars) sent.
   */
  readonly promptChars: number;
  /**
   * A degeneration-safe, length-bounded TAIL of the volatile suffix ({@link llmDecodeContextExcerpt}) — the live
   * context the dispatch was decoding, captured for free (bounded by construction, so it rides whether or not the
   * host captures reply text).
   */
  readonly contextExcerpt: string;
  /**
   * How many `strategy.complete` attempts the bounded retry made.
   */
  readonly attempts: Count;
  /**
   * Whether a LATER attempt recovered into a usable, valid answer (`true`) or the dispatch dropped it (`false`).
   */
  readonly recovered: boolean;
  /**
   * The per-attempt failure diagnostics (every failed attempt; the accepted final attempt is not included).
   */
  readonly failures: ReadonlyArray<LlmDecodeFailureAttempt>;
}

/**
 * Collapse every degenerate repeated-character run in `text` — any run of one char strictly longer than
 * {@link DEGENERATE_RUN_THRESHOLD} is replaced with its first {@link DEGENERATE_RUN_KEEP} chars plus a `«×N»`
 * total-length annotation (`\t\t…«×4096»`). This is what keeps a whitespace-loop runaway ("length" degeneration) from
 * blowing the excerpt budget while still recording the SHAPE and magnitude of the degeneration.
 *
 * @param text - The raw text (a reply / a prompt suffix).
 * @returns The text with every over-threshold run collapsed.
 */
export function collapseDegenerateRuns(text: string): string {
  return text.replaceAll(new RegExp(String.raw`([\s\S])\1{${DEGENERATE_RUN_THRESHOLD},}`, 'g'), (run: string, char: string) => `${char.repeat(DEGENERATE_RUN_KEEP)}«×${run.length}»`);
}

/**
 * Build a degeneration-safe, length-bounded HEAD excerpt of a raw reply — {@link collapseDegenerateRuns} then cut to
 * {@link LLM_DECODE_FAILURE_EXCERPT_MAX_LENGTH}. Used for a per-attempt reply excerpt (the reply's start plus the
 * now-collapsed degenerate run).
 *
 * @param text - The raw reply text.
 * @returns The bounded excerpt (empty string for blank input).
 */
export function llmDecodeFailureExcerpt(text: string): string {
  return cutString(collapseDegenerateRuns(text), LLM_DECODE_FAILURE_EXCERPT_MAX_LENGTH) ?? '';
}

/**
 * A failed attempt's reply as it is persisted — the text plus whether it was clipped.
 */
export interface LlmFailedAttemptReplyClip {
  /**
   * The reply as persisted.
   */
  readonly text: string;
  /**
   * Present iff {@link text} is not the verbatim reply.
   */
  readonly clipped?: true;
}

/**
 * Clip a failed attempt's reply for persistence. A reply that fits {@link LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH} is
 * returned VERBATIM — never collapsed, since pretty-printed JSON legitimately carries long space runs and the point of
 * the row is the exact bytes. Past the cap the degenerate runs are collapsed ({@link collapseDegenerateRuns}) and the
 * head is cut, stamped `clipped`.
 *
 * @param raw - The reply as the model sent it.
 * @returns The persisted text and its clip flag.
 */
export function clipLlmFailedAttemptReply(raw: string): LlmFailedAttemptReplyClip {
  return raw.length <= LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH ? { text: raw } : { text: cutString(collapseDegenerateRuns(raw), LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH) ?? '', clipped: true };
}

/**
 * Keep the last {@link LLM_DECODE_FAILURE_TAIL_EXCERPT_MAX_LENGTH} chars of a collapsed reply.
 */
const sliceLlmDecodeFailureTail = sliceStringFunction({ fromEnd: LLM_DECODE_FAILURE_TAIL_EXCERPT_MAX_LENGTH });

/**
 * Keep the last {@link LLM_DECODE_FAILURE_EXCERPT_MAX_LENGTH} chars of a collapsed prompt suffix — the whole suffix when
 * it is shorter.
 */
const sliceLlmDecodeContextTail = sliceStringFunction({ fromEnd: LLM_DECODE_FAILURE_EXCERPT_MAX_LENGTH });

/**
 * Build a degeneration-safe TAIL excerpt of a raw reply — {@link collapseDegenerateRuns} then the LAST
 * {@link LLM_DECODE_FAILURE_TAIL_EXCERPT_MAX_LENGTH} chars. `undefined` when the head {@link llmDecodeFailureExcerpt}
 * already covers the whole (collapsed) reply. JSON slips concentrate at the END of a reply, which is why the tail is
 * kept apart from the head.
 *
 * @param text - The raw reply text.
 * @returns The tail excerpt, or `undefined` when the head excerpt is the whole reply.
 */
export function llmDecodeFailureTailExcerpt(text: string): string | undefined {
  const collapsed = collapseDegenerateRuns(text);
  return collapsed.length <= LLM_DECODE_FAILURE_EXCERPT_MAX_LENGTH ? undefined : sliceLlmDecodeFailureTail(collapsed);
}

/**
 * Build a degeneration-safe, length-bounded TAIL excerpt of a prompt's volatile suffix — collapse the runs then keep
 * the LAST {@link LLM_DECODE_FAILURE_EXCERPT_MAX_LENGTH} chars, so the live context the dispatch was decoding (which
 * sits at the END of the prompt, after the stable preamble) is carried for free.
 *
 * @param suffix - The volatile suffix (or whole prompt when un-segmented).
 * @returns The bounded tail excerpt.
 */
export function llmDecodeContextExcerpt(suffix: string): string {
  return sliceLlmDecodeContextTail(collapseDegenerateRuns(suffix));
}

/**
 * The provider `finishReason` values that mean the completion CAP ended the reply — `length` (OpenAI-shaped) and
 * `max_tokens` (Anthropic-shaped). Named because two callers must agree on it: {@link classifyLlmDecodeFailure}
 * LABELS the failure, and a dispatcher decides whether to RAISE the completion budget for the re-ask.
 */
const LENGTH_CAPPED_FINISH_REASON = /^(length|max_tokens)$/i;

/**
 * The provider `finishReason` values that mean the MODEL chose to stop — `stop` (OpenAI-shaped), `end_turn` /
 * `stop_sequence` (Anthropic-shaped). Named because two callers must agree on it: a dispatcher's reply-repair lane
 * runs only on a clean stop, and an offline pass over archived records applies the same gate.
 */
const CLEAN_STOP_FINISH_REASON = /^(stop|end_turn|stop_sequence)$/i;

/**
 * Whether the completion cap ended this reply (`finishReason` is `length` / `max_tokens`).
 *
 * READ THIS APART FROM THE FAILURE CLASS. A reply that spends its whole budget on REASONING tokens and emits no
 * visible text classifies as `empty-result` — it has no text to parse — yet it is length-capped just the same, and is
 * MORE truncated than a `length-truncation`, not less. The class names what the READER saw; this names what the
 * PROVIDER did, and it is the budget-raise trigger. Folding the two loses every reasoning-tier truncation, each one
 * re-asked at the same ceiling it had just exhausted.
 *
 * @param result - The completion (only its `finishReason` is read).
 * @returns True when the completion cap ended the reply.
 */
export function isLlmLengthCappedFinish(result: Pick<LlmCompletion, 'finishReason'>): boolean {
  return LENGTH_CAPPED_FINISH_REASON.test(result.finishReason ?? '');
}

/**
 * Whether the model ended this reply ITSELF — a clean-stop `finishReason`, or none at all (a scripted or tape strategy,
 * or a provider that echoed none). The reply-repair gate: a truncation (`length` / `max_tokens`), a
 * `repetition_truncation`, an `error`, a synthetic transport / timeout sentinel or anything else is never repaired,
 * because repairing cut content would invent the end of a value.
 *
 * @param result - The completion (only its `finishReason` is read).
 * @returns True when the reply ended on a clean stop.
 */
export function isLlmCleanStopFinish(result: Pick<LlmCompletion, 'finishReason'>): boolean {
  const finishReason = result.finishReason ?? '';
  return finishReason === '' || CLEAN_STOP_FINISH_REASON.test(finishReason);
}

/**
 * Classify one decode failure into its {@link LlmDecodeFailureClass} from the reply reading and the completion: the
 * timeout sentinel ⇒ `timeout`; the transport sentinel ⇒ `transport`; a blank `no-json` reply ⇒ `empty-result`; a
 * `length` / `max_tokens` finish reason ⇒ `length-truncation` (a completion the `max_tokens` cap cut mid-object);
 * otherwise ⇒ `parse-error` (a non-empty, non-truncated reply the reader could not decode). Schema-validation
 * failures are classified separately by a dispatcher (a parsed-but-invalid answer), not here.
 *
 * @param reading - The degenerate reply reading (`no-json` / `parse-error`) that triggered classification.
 * @param result - The completion (its `text` and `finishReason`).
 * @returns The decode-failure class.
 */
export function classifyLlmDecodeFailure(reading: LlmDecodeReadingKind, result: Pick<LlmCompletion, 'text' | 'finishReason'>): LlmDecodeFailureClass {
  const finishReason = result.finishReason ?? '';
  let failureClass: LlmDecodeFailureClass;

  if (finishReason === LLM_TIMEOUT_FINISH_REASON) {
    // The synthesized abort envelope — the per-request signal fired before the model returned (no reply to read).
    failureClass = 'timeout';
  } else if (finishReason === LLM_TRANSPORT_FINISH_REASON) {
    // The synthesized transport envelope — the call never reached the model (connection reset, rate limit,
    // gateway 5xx). Distinct from `'timeout'`: a deadline means the model was too SLOW, this means it was never
    // ASKED, and conflating them would attribute a provider outage to model latency in the record.
    failureClass = 'transport';
  } else if (finishReason === LLM_UNRETRYABLE_FINISH_REASON) {
    // The synthesized unretryable envelope — the send threw an error the retry policy does not resend.
    failureClass = 'unretryable';
  } else if (reading === 'no-json' && !isNotBlankString(result.text)) {
    failureClass = 'empty-result';
  } else if (isLlmLengthCappedFinish(result)) {
    failureClass = 'length-truncation';
  } else {
    failureClass = 'parse-error';
  }

  return failureClass;
}

/**
 * Whether a reply is REASONING-ONLY — blank visible text with billed reasoning tokens. The always-thinking shape: the
 * model spent the completion thinking and emitted nothing to read.
 *
 * Named apart from {@link classifyLlmReplyOutcome} because the retry ladder consults it directly: it is the one
 * `empty-result` whose fix is to turn reasoning OFF rather than to change model.
 *
 * @param result - The completion (its `text` and `usage`).
 * @returns True when the reply is blank and reasoning tokens were billed.
 */
export function isLlmReasoningOnlyReply(result: Pick<LlmCompletion, 'text' | 'usage'>): boolean {
  return !isNotBlankString(result.text) && (result.usage?.reasoningTokens ?? 0) > 0;
}

/**
 * Classify one reply's SHAPE ({@link LlmReplyOutcomeClass}) — the sibling of {@link classifyLlmDecodeFailure}, which
 * names the failure FAMILY. This names what the reply LOOKED like, which is what the retry ladder branches on and what
 * a record keeps.
 *
 * The precedence is deliberate: `transport` (there was no reply at all) then `length-capped` (the provider says it
 * cut the reply off, which outranks whatever the reader made of the fragment — including a fragment that happened to
 * parse) then the failure family, then `ok`.
 *
 * @param result - The completion (its `text`, `finishReason` and `usage`).
 * @param failureClass - The failure family this attempt hit, when it failed; omitted for an accepted reply.
 * @returns The reply outcome class.
 */
export function classifyLlmReplyOutcome(result: Pick<LlmCompletion, 'text' | 'finishReason' | 'usage'>, failureClass?: LlmDecodeFailureClass): LlmReplyOutcomeClass {
  const finishReason = result.finishReason ?? '';
  let outcome: LlmReplyOutcomeClass;

  if (isLlmSendFailureFinishReason(finishReason) || failureClass === 'timeout' || failureClass === 'transport' || failureClass === 'unretryable') {
    outcome = 'transport';
  } else if (isLlmLengthCappedFinish(result)) {
    outcome = 'length-capped';
  } else if (failureClass === 'empty-result') {
    outcome = isLlmReasoningOnlyReply(result) ? 'reasoning-only' : 'empty-content';
  } else if (failureClass === 'schema-validation') {
    outcome = 'schema-invalid';
  } else if (failureClass === 'parse-error' || failureClass === 'length-truncation') {
    outcome = 'malformed';
  } else {
    outcome = 'ok';
  }

  return outcome;
}
