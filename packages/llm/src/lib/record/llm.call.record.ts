/**
 * The **LLM call records**: what a dispatcher hands a host to persist about each call — the send-time start record,
 * the completed call record and the decode-failure record — plus the supporting per-attempt, phase and supplement
 * shapes, and the event-type tags a host's log files records under.
 *
 * THE EXTENSION RULE. A host's own fields — attribution (a tenant, a session, a request), correlation ids, a routing
 * reason — sit at the TOP LEVEL of every record, beside the library's fields, never nested. A host declares them once
 * as `H` and passes that one type to every record and tap event:
 *
 * ```ts
 * type AppCallRecord = LlmCallRecord<{ readonly requestId?: string; readonly region?: string }>;
 * ```
 *
 * so its readers keep reading `record.requestId`. Because each record is an intersection (`…Base & H`), `H` may also
 * NARROW a library field with a subtype (e.g. `{ readonly result: AppDispatchResult }`), and a tap event adds its own
 * fields by intersection, never by redeclaring a record field. The library never reads or names a host field.
 */

import type { FetchErrorClassification } from '@dereekb/util/fetch';
import type { Milliseconds, PercentDecimal, HexString } from '@dereekb/util';
import type { LlmCapabilityKey, LlmModelId, LlmModelTierKey, LlmStrategyId, LlmTokenCount } from '../model/llm.value';
import type { LlmPromptSegment } from '../prompt/llm.prompt.segment';
import type { LlmDispatchResult, LlmReplyRepairSummary } from '../strategy/llm.strategy';
import type { LlmCallTelemetry } from './llm.call.telemetry';
import type { LlmDecodeFailurePayload, LlmRetryCause } from './llm.decode.failure';
import { type LlmDecisionKey } from '../decision/llm.decision.question';

/**
 * The event type a host records a completed call ({@link LlmCallRecord}) under.
 */
export const LLM_CALL_EVENT_TYPE = 'llm_call';

/**
 * The SEND-TIME sibling of {@link LLM_CALL_EVENT_TYPE} — the event type a host records an {@link LlmCallStartRecord}
 * under the instant a request is dispatched (before the model replies), so a live feed can show "a message went out"
 * while the call is in flight. No usage or latency (those land on the completed call); a liveness signal, not a cost
 * row.
 */
export const LLM_CALL_START_EVENT_TYPE = 'llm_call_start';

/**
 * The event type a host records an {@link LlmDecodeFailureRecord} under — one per dispatch that hit any decode
 * failure.
 */
export const LLM_DECODE_FAILURE_EVENT_TYPE = 'llm_decode_failure';

/**
 * The host's own TOP-LEVEL record fields — attribution (a tenant, a session, a request), correlation ids, a routing
 * reason. A host declares them once as `H` and every record and tap event carries them BESIDE the library's fields,
 * never nested, so its readers keep reading `record.<field>`. The library never reads or names them.
 */
export type LlmCallHostFields = object;

/**
 * The retry DECISION stamped on the attempt it produced ({@link LlmCallAttemptPhase.retry}).
 *
 * Read-side typing: `lever`, `cause` and `induced` are plain strings, because a persisted row may name a rung or a
 * cause a later build added.
 */
export interface LlmCallAttemptRetry {
  /**
   * The rung the ladder moved (an `LlmRetryLeverKind`), `'none'` included.
   */
  readonly lever: string;
  /**
   * The value the FAILED attempt carried, rendered.
   */
  readonly from: string;
  /**
   * The value THIS attempt carries. Equals {@link from} only for `lever: 'none'`.
   */
  readonly to: string;
  /**
   * The failure class of the attempt before this one (an {@link LlmRetryCause}: a decode-failure class, or
   * `'critique'` when a judge rejected a well-formed answer).
   */
  readonly cause: string;
  /**
   * The completion cap this attempt was raised to as PART of its own rung — set only by `reasoning-low`, whose
   * reasoning tokens come out of `maxOutputTokens` and which would otherwise ask for less answer than the attempt
   * that just failed had. Omit-when-absent, so every other rung's phase is byte-identical.
   */
  readonly headroom?: LlmTokenCount;
  /**
   * `true` when this attempt is the ONE bonus attempt a dispatcher grants past its attempt cap — the final attempt
   * was cap-ended by the `reasoning-low` rung the ladder had just taken, and the bonus undoes it (`induced` names
   * that rung). The ladder paying for its own lever; never granted twice per dispatch.
   */
  readonly bonus?: true;
  /**
   * The rung whose failure the bonus attempt undoes (`'reasoning-low'`). Present iff {@link bonus}.
   */
  readonly induced?: string;
}

/**
 * One retry attempt's phase timing — the per-attempt wall clock (the `strategy.complete` call a dispatcher wrapped)
 * and the provider-reported `latencyMs` of THAT attempt (otherwise lost: only the final attempt's usage survives on
 * the result). `wallMs − latencyMs ≈ client overhead` for the attempt.
 */
export interface LlmCallAttemptPhase {
  /**
   * The 1-based attempt ordinal.
   */
  readonly attempt: number;
  /**
   * The wall-clock time a dispatcher measured around this attempt's `strategy.complete`.
   */
  readonly wallMs: Milliseconds;
  /**
   * The provider-reported latency of this attempt ({@link LlmDispatchResult.latencyMs}), when the attempt captured
   * it.
   */
  readonly latencyMs?: Milliseconds;
  /**
   * WHAT CHANGED to produce this attempt — the retry LEVER the ladder moved after the attempt before it failed, plus
   * that attempt's failure `cause`. ABSENT on attempt 1 (nothing preceded it), so a retried dispatch reads as a
   * sequence of decisions rather than as a repetition: `{ lever: 'budget', from: '4096', to: '16384', cause:
   * 'length-truncation' }`.
   *
   * `lever: 'none'` is a legitimate value (the transport lane resends identical, cache-hot bytes; a genuinely
   * exhausted ladder has nothing left to move) and is recorded rather than omitted — the whole point of the block is
   * that an unchanged retry is stated out loud.
   */
  readonly retry?: LlmCallAttemptRetry;
  /**
   * How the reply-repair lane REPAIRED this attempt's malformed JSON reply before any re-ask — absent on an attempt
   * nothing repaired.
   */
  readonly repair?: LlmReplyRepairSummary;
}

/**
 * ONE attempt the bounded retry loop REJECTED, with its reply in full, so a later reader can study WHY a prompt
 * failed rather than only that it did.
 *
 * Its own type rather than a widened `LlmDecodeFailureAttempt`: that stream is an always-on,
 * excerpt-bounded QUALITY-METRIC input whose population must not grow (an intermediate schema / critic rejection
 * mints none), where this holds the whole reply. Field names mirror it (`rawLength`, `maxOutputTokens`,
 * `finishReason`, `latencyMs`) so a reader moves between the two by name.
 *
 * The telemetry block is THIS attempt's own (`llmCallTelemetry` over its result), so `usage` is the tokens it billed
 * and `model` names a `model` lever it rode. Read-side only: a ledger still folds the final attempt's usage alone
 * (the {@link LlmCallPhases} undercount note).
 */
export interface LlmCallFailedAttempt extends LlmCallTelemetry {
  /**
   * The 1-based attempt ordinal — joins `phases.attempts[].attempt` and the `attempt N:` prefix of
   * `validationErrors`.
   */
  readonly attempt: number;
  /**
   * Why the loop rejected it — a decode-failure class, or `'critique'` when a judge rejected a schema-valid answer.
   */
  readonly cause: LlmRetryCause;
  /**
   * The words of the rejection — the validator's error (`schema-validation`), the judge's feedback (`critique`), or
   * the transport summary (`transport` / `unretryable`). Absent for `parse-error` / `empty-result` /
   * `length-truncation` / `timeout`, whose {@link cause} + `finishReason` + full {@link text} are the whole story.
   */
  readonly error?: string;
  /**
   * The send error's classification when it was NOT transient — present on every `unretryable` row
   * (`permanent` / `unknown`), and on a `transport` row only when the host approved an `unknown` error. Absent means
   * transient, so an ordinary transport row and every timeout row stay byte-identical.
   */
  readonly errorClassification?: Exclude<FetchErrorClassification, 'transient'>;
  /**
   * The MODEL's reply — verbatim up to `LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH`, collapsed + cut past it
   * ({@link clipped}). The model's own bytes even when the reply-repair lane substituted a repaired reply (the
   * bounded `repair` summary rides the telemetry block). `''` for a `timeout` / `transport` attempt, which never got
   * one.
   */
  readonly text: string;
  /**
   * The reply's length before any clip.
   */
  readonly rawLength: number;
  /**
   * Present iff {@link text} is not the verbatim reply (it ran past the cap).
   */
  readonly clipped?: true;
  /**
   * The completion cap this attempt was SENT with (after its levers), when the request carried one.
   */
  readonly maxOutputTokens?: LlmTokenCount;
  /**
   * The correction block this attempt's request CARRIED — the bytes, not a re-derivation (the wording is
   * code-versioned). Attempt N ≥ 2 was sent the attempt-1 segments plus this block, with its levers applied. Absent
   * when the attempt carried none (attempt 1; a transport resend of a correction-less request).
   */
  readonly correction?: string;
  /**
   * The retry decision this failure BOUGHT — the same object the next attempt's `phases.attempts[].retry` carries.
   * Absent on the last failed attempt (nothing followed it).
   */
  readonly retry?: LlmCallAttemptRetry;
}

/**
 * The per-dispatch phase timing block — the whole-dispatch wall, the root-only render / assemble spans, the summed
 * `strategy.complete` wall, and the per-attempt breakdown, plus the prompt / cache-prefix sizes.
 *
 * NOTE — the retry undercount: only the FINAL attempt's `usage` survives on the result, so {@link attempts} exposes
 * the count and time of the discarded attempts but NOT their billed tokens. Each failed attempt's own usage rides its
 * {@link LlmCallFailedAttempt} row.
 */
export interface LlmCallPhases {
  /**
   * The whole-dispatch wall clock (render → assemble → attempts → record).
   */
  readonly totalMs: Milliseconds;
  /**
   * The live-context render span (root dispatch only; a follow-up has none).
   */
  readonly renderMs?: Milliseconds;
  /**
   * The prompt-assembly span (root dispatch only).
   */
  readonly assembleMs?: Milliseconds;
  /**
   * The summed `strategy.complete` wall across every attempt.
   */
  readonly completeMs: Milliseconds;
  /**
   * The per-attempt phase breakdown ({@link LlmCallAttemptPhase}), when captured.
   */
  readonly attempts?: ReadonlyArray<LlmCallAttemptPhase>;
  /**
   * The assembled prompt's char count.
   */
  readonly promptChars?: number;
  /**
   * The stable cache-prefix char count, when the call was segmented.
   */
  readonly cachePrefixChars?: number;
  /**
   * The HASH of that stable cache prefix (the 16-hex-char `sha256HexPrefix` from `@dereekb/util`), when the call was segmented — the
   * identity two consecutive records of the same call site are compared on. Stamped on EVERY segmented dispatch, not
   * only on a changed one: a reader diffing two call records must be able to conclude "unchanged" from the record
   * rather than from the ABSENCE of a breadcrumb (which a level gate can swallow).
   */
  readonly cachePrefixHash?: HexString;
}

/**
 * ONE supplement a prompt seam placed on a call — which contributor offered it, the slot and segment it landed as,
 * and the bytes' hash and size (never the bytes). Always recorded, so what a prompt held is countable from any log.
 *
 * Plain strings on purpose: a persisted row may name a contributor or slot a later build added.
 */
export interface LlmCallSupplement {
  /**
   * The contributor that offered it.
   */
  readonly contributor: string;
  /**
   * The slot it occupied.
   */
  readonly slot: string;
  /**
   * The segment id it was placed as.
   */
  readonly id: string;
  /**
   * The placed segment's diffing identity (a template key, a model slug, a context block key), when it has one.
   */
  readonly key?: string;
  /**
   * The 16-hex-char `sha256HexPrefix` (`@dereekb/util`) of the contributed bytes (separator excluded).
   */
  readonly hash: HexString;
  /**
   * The contributed text's length in UTF-16 code units (`.length`, separator excluded). The persisted key keeps its
   * name, `bytes`, although the unit is code units, not bytes.
   */
  readonly bytes: number;
  /**
   * The tier of the source the supplement came from.
   */
  readonly tier?: string;
  /**
   * How a selected supplement was chosen.
   */
  readonly by?: string;
  /**
   * A judge's probability for a judged supplement.
   */
  readonly p?: PercentDecimal;
  /**
   * Present ⇒ the supplement was MATCHED but NOT placed, and why. `hash` / `bytes` are of the bytes it would have
   * placed. A craft cut is one of `LLM_CRAFT_NOTE_CUT_REASONS`; its `'max-bytes'` keeps its persisted name although
   * the budget it names counts UTF-16 code units.
   */
  readonly cut?: string;
}

/**
 * The library's fields of one completed LLM call — the capability, the assembled prompt and its provenance, and the
 * dispatch result, plus the optional routing, decision and timing columns. A host's own fields ride beside these
 * through {@link LlmCallRecord}'s `H`.
 */
export interface LlmCallRecordBase {
  /**
   * The capability the call served — the request type a usage ledger breaks down by.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The fully assembled prompt sent — the ATTEMPT-1 bytes (a retry's correction rides the volatile suffix and is
   * summarized by `validationErrors`). `joinLlmPromptSegments(segments) === prompt`, so a host persisting a record
   * needs to write only the {@link segments}.
   */
  readonly prompt: string;
  /**
   * The PROVENANCE breakdown of {@link prompt} — the ordered segments a dispatcher joined to build it.
   *
   * REQUIRED, not optional: a record that carries bytes without the provenance explaining them is exactly the state
   * this seam exists to end. A spec fixture that hand-builds a record builds a segment list rather than omitting the
   * field.
   */
  readonly segments: ReadonlyArray<LlmPromptSegment>;
  /**
   * The dispatch result — its telemetry (model / usage / latency / attempts / validationErrors) and its raw `text`.
   * Whether the text is persisted is the host's choice.
   */
  readonly result: LlmDispatchResult;
  /**
   * The resolved model-tier KEY this call routed to, so a usage report attributes spend by tier NAME (not just the
   * served model id). Absent for a raw-slug override or a scripted strategy that resolves no tier.
   */
  readonly tier?: LlmModelTierKey;
  /**
   * The capability this call was a JUDGEMENT OF — set only by a critique dispatch. It makes judge spend attributable
   * to what it judged from the call record alone. Absent on every ordinary dispatch, so the recorded payload is
   * byte-identical for them.
   */
  readonly subject?: LlmCapabilityKey;
  /**
   * The DECLARED decision id this call answered — set only on a decision-lane row, whose `capability` is the
   * CONSUMER's and so cannot say which of its decisions this was. Absent on every completion, so their payload is
   * byte-identical.
   */
  readonly decision?: LlmDecisionKey;
  /**
   * A decision consumer's own read of its answers. A host writing a payload spreads it BEFORE every core field so it
   * can never override one. Absent on a completion and on every decision that states none, so their payload is
   * byte-identical.
   */
  readonly stamp?: Readonly<Record<string, unknown>>;
  /**
   * Every supplement a prompt seam placed on this call ({@link LlmCallSupplement}) — hashes and sizes, never bytes.
   * Absent when none was placed, so a supplement-free payload is byte-identical.
   */
  readonly supplements?: ReadonlyArray<LlmCallSupplement>;
  /**
   * Whether the dispatcher's RESOLVED reasoning config for this call was OFF (`{ enabled: false }`). Threaded exactly
   * as {@link tier} is, so a usage ledger can tell an unrequested reasoning burn from a capability's legitimate
   * opt-in when it judges whether the transport honoured the floor.
   */
  readonly reasoningOff?: boolean;
  /**
   * The dispatcher's estimated prompt-token count — recorded only when the caller pinned a prompt-token budget, so a
   * usage ledger can show estimate-vs-actual drift against the served `usage.promptTokens`. Absent for every call
   * with no budget (byte-identical).
   */
  readonly estimatedPromptTokens?: LlmTokenCount;
  /**
   * The per-dispatch phase timing block ({@link LlmCallPhases}). Collected on every dispatch; persisting it is the
   * host's choice.
   */
  readonly phases?: LlmCallPhases;
  /**
   * Every attempt the bounded retry loop REJECTED, with its reply in full ({@link LlmCallFailedAttempt}). Collected
   * on every dispatch (so a tap sees every failed attempt, the intermediate schema / critic rejections included);
   * persisting it is the host's choice, since the failed replies are as heavy as the prompt. Absent on a clean call.
   */
  readonly failedAttempts?: ReadonlyArray<LlmCallFailedAttempt>;
}

/**
 * One completed LLM call to record — the library's {@link LlmCallRecordBase} fields plus the host's own top-level
 * fields `H` ({@link LlmCallHostFields}).
 */
export type LlmCallRecord<H extends LlmCallHostFields = LlmCallHostFields> = LlmCallRecordBase & H;

/**
 * The library's fields of one SEND-TIME dispatch — the capability plus the resolved model, tier and strategy,
 * recorded before the model replies (its completion is the separate {@link LlmCallRecord}). No usage or latency —
 * those are only known at completion.
 */
export interface LlmCallStartRecordBase {
  /**
   * The capability the call serves.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The CONCRETE slug this call asks the provider for — always present, so a run that died on its first request
   * still records what it had asked for. The dispatcher sends the same slug as the request's `model`.
   */
  readonly model: LlmModelId;
  /**
   * The resolved model-tier key, when the dispatch resolved one.
   */
  readonly tier?: LlmModelTierKey;
  /**
   * The PROVIDER INSTANCE this call was sent to — the strategy `id`.
   *
   * Carried so the dispatch stream is attributable on its own: on a run that mixes providers, a call that never came
   * back must still say WHERE it had gone, which is the exact run that needs the answer. Optional so a hand-rolled
   * fake keeps compiling.
   */
  readonly strategyId?: LlmStrategyId;
  /**
   * The transport LANE this call was sent on (`LlmStrategy.kind ?? id`) — the sibling of {@link strategyId}, and the
   * axis a usage ledger folds by strategy on. Optional for the same reason {@link strategyId} is.
   */
  readonly strategyKind?: LlmStrategyId;
}

/**
 * One send-time dispatch to record — the library's {@link LlmCallStartRecordBase} fields plus the host's own
 * top-level fields `H`.
 */
export type LlmCallStartRecord<H extends LlmCallHostFields = LlmCallHostFields> = LlmCallStartRecordBase & H;

/**
 * The library's fields of one decode-failure record — the payload a dispatcher's retry loop assembled.
 */
export interface LlmDecodeFailureRecordBase {
  /**
   * The decode-failure payload (capability / model / promptId / context excerpt / recovered / per-attempt
   * failures).
   */
  readonly payload: LlmDecodeFailurePayload;
}

/**
 * One decode failure to record — the library's {@link LlmDecodeFailureRecordBase} fields plus the host's own
 * top-level fields `H`, so the failure joins the dispatch that raised it (and the retry that fixed it).
 */
export type LlmDecodeFailureRecord<H extends LlmCallHostFields = LlmCallHostFields> = LlmDecodeFailureRecordBase & H;
