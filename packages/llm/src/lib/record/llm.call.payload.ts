/**
 * The **persisted call payload**: the read-side view of what a host's recorder writes for each completed call
 * ({@link LlmCallRecord}) under {@link LLM_CALL_EVENT_TYPE}. The in-memory record nests its result and always carries
 * the prompt; a persisted row is flat, and its heavy keys (the prompt, the reply, the failed attempts) are the host's
 * choice to keep. Every reader in the library (`readLlmCallPrompt`, `readLlmCallFailedAttempts`, the bill reconcile,
 * the tape) reads this shape. The write side and the read side cannot drift: {@link toLlmCallLogPayload} is the one
 * writer, and the type-level spec in `llm.call.payload.spec.ts` (run by `llm:typecheck`) fails when its
 * {@link LlmCallLogPayloadWrite} writes a key this read type does not declare.
 *
 * {@link toLlmCallLogPayload}`(record, { keepIo, keepPhases })` writes the row, in this key order (a decision record's
 * `stamp` keys lead it):
 *
 * | payload key(s) | from the record | kept when |
 * |---|---|---|
 * | `capability` | `record.capability` | always |
 * | `promptSegments` | `record.segments` | `keepIo` |
 * | `text` | `record.result.repair?.originalText ?? record.result.text` — the MODEL's bytes | `keepIo` |
 * | `failedAttempts` | `record.failedAttempts` | `keepIo`, and only when non-empty |
 * | `strategyId`, `strategyKind`, `model`, `provider`, `usage`, `latencyMs`, `generationId`, `finishReason`, `repair` | `llmCallTelemetry(record.result)` | always |
 * | `tier` | `record.tier` | always |
 * | `schemaEnforced`, `attempts`, `decodeStatus`, `decodeOutcome`, `lengthCapped` | `record.result` | always |
 * | `lever` | `record.result.valueJson` — the accepted reply value | `keepIo` |
 * | `validationErrors` | `record.result` | always |
 * | `subject`, `decision` | the record's own fields | always |
 * | `supplements` | `record.supplements` | only when non-empty |
 * | `reasoningOff`, `estimatedPromptTokens` | the record's own fields | always |
 * | `phases` | `record.phases` | `keepPhases` |
 *
 * Every key is written only when its value is present. The projector writes no host field: a host places its own,
 * either in the payload (the `H` of {@link LlmCallLogPayload}) or on its event envelope.
 *
 * `text` is the model's own bytes, not the repaired reply: a tape built from the row then replays what the model said,
 * and the deterministic repair re-runs on replay.
 */

import { filterMaybeValues, type Maybe, type Milliseconds, type Count } from '@dereekb/util';
import type { LlmCapabilityKey, LlmModelId, LlmModelTierKey, LlmStrategyId, LlmTokenCount, LlmGenerationId } from '../model/llm.value';
import type { LlmPromptSegment } from '../prompt/llm.prompt.segment';
import type { LlmDispatchResult, LlmReplyRepairSummary } from '../strategy/llm.strategy';
import type { LlmUsage } from '../strategy/llm.usage';
import type { LlmCallFailedAttempt, LlmCallHostFields, LlmCallPhases, LlmCallRecordBase, LlmCallSupplement } from './llm.call.record';
import { llmCallTelemetry, type LlmCallTelemetry } from './llm.call.telemetry';
import { type LlmDecisionKey } from '../decision/llm.decision.question';

/**
 * The library's fields of a persisted call payload ({@link LlmCallLogPayload}). Every field is optional except the
 * capability, because a row may come from any build: a reader answers for a key a later build added and for one an
 * older build never wrote.
 */
export interface LlmCallLogPayloadBase {
  /**
   * The capability the call served — the REQUEST TYPE a usage ledger breaks down by.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The strategy INSTANCE id that served the call — the ATTRIBUTION axis (which account / which keyed instance).
   */
  readonly strategyId?: LlmStrategyId;
  /**
   * The transport LANE the call rode (`LlmStrategy.kind ?? id`, e.g. `'openrouter-systemone'`) — the A/B axis a
   * per-strategy fold keys on. A row without it folds by {@link strategyId}; a row with it separates the lane from the
   * account that served it.
   */
  readonly strategyKind?: LlmStrategyId;
  /**
   * The DECLARED decision id a decision-lane row answered — stamped on every dispatcher-recorded decision, absent on
   * every completion. Its presence is what `isUncacheableLlmCall` keys on: the decision lane has no prompt cache, so
   * its prompt tokens are cache-NOT-APPLICABLE rather than a miss.
   */
  readonly decision?: LlmDecisionKey;
  /**
   * The capability this call was a JUDGEMENT of — present only on a critique dispatch's row.
   */
  readonly subject?: LlmCapabilityKey;
  /**
   * Every supplement the prompt seam placed on the call ({@link LlmCallSupplement}), then every one it matched and
   * CUT (`cut` set) — written ungated (whether or not the host keeps the prompt) on every root dispatch that placed or
   * cut one; absent on a follow-up, a decision-lane row and a prompt that placed and cut nothing.
   */
  readonly supplements?: ReadonlyArray<LlmCallSupplement>;
  /**
   * The UPSTREAM endpoint that served the call, when the transport reported one (OpenRouter's response `provider`
   * field) — read-side only, never folded. Recorded so a later "which endpoints honour a reasoning-off request"
   * decision can be made from evidence rather than a blind allowlist. Absent on a transport / response that echoes
   * none.
   */
  readonly provider?: string;
  /**
   * The model that served the call; absent on an injected (scripted) seam that names none.
   */
  readonly model?: LlmModelId;
  /**
   * The model-tier KEY the dispatcher resolved this call to (`fast` / `strong` / …) — the NAMED axis a by-tier report
   * attributes spend against (distinct from the served {@link model} id). Absent for a raw-model override and on a row
   * without a tier; a by-tier fold counts those under a host-chosen bucket.
   */
  readonly tier?: LlmModelTierKey;
  /**
   * Whether the call SENT `response_format` json_schema/strict ({@link LlmDispatchResult.schemaEnforced}) — a request,
   * not a claim the provider honoured it. Absent on a row from a strategy that states none.
   */
  readonly schemaEnforced?: boolean;
  /**
   * Token usage (+ optional provider cost) for the call.
   */
  readonly usage?: LlmUsage;
  /**
   * Wall-clock ms around the call.
   */
  readonly latencyMs?: Milliseconds;
  /**
   * The provider's generation id for the call — read-side only (a full log dump surfaces it, and the bill reconcile
   * asks the provider about it); a usage fold never folds it. Absent on an injected seam.
   */
  readonly generationId?: LlmGenerationId;
  /**
   * Why generation stopped (e.g. `'length'` when the runaway cap truncated) — read-side only. Absent on an injected
   * seam.
   */
  readonly finishReason?: string;
  /**
   * How many `strategy.complete` attempts the bounded validate-and-retry made (present iff the loop ran). ABSENT is
   * read as `1` everywhere a fold uses it — the single-shot (no validator) path stamps none, and a row without it
   * was single-shot. Do NOT "fix" that into an omission.
   */
  readonly attempts?: Count;
  /**
   * The schema summaries of each schema-invalid attempt (present when any attempt was invalid).
   */
  readonly validationErrors?: ReadonlyArray<string>;
  /**
   * The SHAPE of the reply the dispatch ended on — `reasoning-only`, `empty-content`, `length-capped`, `malformed`,
   * `schema-invalid`, `transport`, or `ok`. Present iff the bounded retry loop ran. A plain `string` on the read
   * side, because a persisted row may name a value a later build added.
   */
  readonly decodeOutcome?: string;
  /**
   * How the dispatch's decode ENDED — `clean` / `retried` / `dropped`. Present iff the bounded retry loop ran. A plain
   * `string` on the read side, for {@link decodeOutcome}'s reason.
   */
  readonly decodeStatus?: string;
  /**
   * STICKY: SOME attempt of this dispatch was cut off by the completion cap, INCLUDING one a later attempt recovered
   * from. The only durable trace of a recovered truncation — hence ungated.
   */
  readonly lengthCapped?: boolean;
  /**
   * How the reply-repair lane repaired the reply this dispatch ENDED on ({@link LlmReplyRepairSummary}) — bounded and
   * UNGATED (the {@link lengthCapped} precedent). Absent when no repair ran.
   */
  readonly repair?: LlmReplyRepairSummary;
  /**
   * The per-dispatch phase timing block ({@link LlmCallPhases}) — the render / assemble / per-attempt breakdown a
   * timing panel reads. Present only when the dispatch's call context timed (`callContext.enabled`) and the host kept
   * it (`keepPhases`); absent otherwise (byte-stable absence).
   */
  readonly phases?: LlmCallPhases;
  /**
   * Whether the dispatcher's RESOLVED reasoning config for this call was OFF (`{ enabled: false }`) — the denominator
   * of a reasoning-floor check. Threaded so a capability that legitimately opts INTO reasoning per invocation is not
   * counted as a floor violation. A row omitting it is read as OFF (`!== false`).
   */
  readonly reasoningOff?: boolean;
  /**
   * The dispatcher's ESTIMATE of the attempt-1 prompt (the replayed thread and the billed schema included), on every
   * completion row so a ledger can report estimate-vs-served drift against the served {@link LlmUsage.promptTokens}.
   * Absent on a decision-lane row and on a row projected from a record built outside a dispatcher.
   */
  readonly estimatedPromptTokens?: LlmTokenCount;
  /**
   * The prompt as its provenance-tagged {@link LlmPromptSegment}s — the ONLY prompt key a new row carries, and only
   * when the host keeps prompts. NEVER dereference it directly: go through `readLlmCallPrompt` /
   * `readLlmCallPromptSegments`, which also answer for the flat shape below.
   */
  readonly promptSegments?: ReadonlyArray<LlmPromptSegment>;
  /**
   * The flat assembled prompt — a row with only `prompt` (no `promptSegments`). The dispatcher writes
   * {@link promptSegments} instead; `readLlmCallPrompt` reads whichever is there.
   */
  readonly prompt?: string;
  /**
   * The model's own reply bytes (before any repair) — written alongside the prompt when the host keeps prompts.
   */
  readonly text?: string;
  /**
   * The ACCEPTED reply value, JSON-encoded ({@link LlmDispatchResult.valueJson}) — the reply as the caller read it,
   * written beside {@link text} when the host keeps I/O; absent on a dropped or declined decode. The key is `lever`,
   * the name existing rows already carry.
   */
  readonly lever?: string;
  /**
   * Every attempt the bounded retry loop REJECTED, with its reply in full ({@link LlmCallFailedAttemptRow}) — written
   * beside {@link text} when the host keeps prompts, and only when the loop rejected one. {@link text} is still the
   * FINAL reply (a dropped dispatch's last row repeats it) and {@link promptSegments} still attempt 1's. Read it
   * through `readLlmCallFailedAttempts`, which drops a malformed row and answers `undefined` for a clean call, a host
   * that keeps no prompts, or a row without attempt rows.
   */
  readonly failedAttempts?: ReadonlyArray<LlmCallFailedAttemptRow>;
}

/**
 * One `failedAttempts` row as a READER receives it — {@link LlmCallFailedAttempt} with read-side typing: only the three
 * fields `readLlmCallFailedAttempts` checks are promised; `cause` and `errorClassification` are plain strings (a later
 * build may add a value), and the telemetry block and every other field may be absent on an older or foreign row.
 */
export interface LlmCallFailedAttemptRow extends Partial<Omit<LlmCallFailedAttempt, 'attempt' | 'cause' | 'text' | 'errorClassification'>> {
  /**
   * The 1-based attempt number the retry loop rejected.
   */
  readonly attempt: number;
  /**
   * Why the attempt was rejected — a plain `string` on the read side, because a persisted row may name a cause a later
   * build added.
   */
  readonly cause: string;
  /**
   * The rejected reply, in full.
   */
  readonly text: string;
  /**
   * How the failure was classified, when it was — a plain `string` for {@link cause}'s reason.
   */
  readonly errorClassification?: string;
}

/**
 * A persisted call payload: the library's fields ({@link LlmCallLogPayloadBase}) beside the host's own fields `H`
 * (attribution, correlation ids, a routing reason), never nested — the same extension rule as {@link LlmCallRecord}.
 * The host fields are the host's to place: {@link toLlmCallLogPayload} writes the library's keys only.
 */
export type LlmCallLogPayload<H extends LlmCallHostFields = LlmCallHostFields> = LlmCallLogPayloadBase & H;

/**
 * What {@link toLlmCallLogPayload} keeps of a completed call beyond its always-on telemetry.
 */
export interface LlmCallLogPayloadConfig {
  /**
   * Keep the heavy I/O — `promptSegments`, `text` (the MODEL's own bytes), a non-empty `failedAttempts` and the accepted
   * reply value (`lever`). Default false: the row keeps only the bounded telemetry.
   */
  readonly keepIo?: Maybe<boolean>;
  /**
   * Keep the `phases` block (it exists only when the dispatch's call context timed). Default false.
   */
  readonly keepPhases?: Maybe<boolean>;
}

/**
 * Exactly what {@link toLlmCallLogPayload} writes: the library's keys, composed from the record, the telemetry block
 * and the result, so a renamed or retyped source field fails here. A decision record's `stamp` keys ride in front at
 * runtime and are not typed. The read side is {@link LlmCallLogPayloadBase}; `llm.call.payload.spec.ts` checks the two.
 */
export type LlmCallLogPayloadWrite = Pick<LlmCallRecordBase, 'capability' | 'tier' | 'subject' | 'decision' | 'supplements' | 'reasoningOff' | 'estimatedPromptTokens' | 'phases' | 'failedAttempts'> &
  LlmCallTelemetry &
  Pick<LlmDispatchResult, 'schemaEnforced' | 'attempts' | 'decodeStatus' | 'decodeOutcome' | 'lengthCapped' | 'validationErrors'> & {
    /**
     * The prompt as its provenance-tagged segments ({@link LlmCallRecordBase.segments}) — written under `keepIo`.
     */
    readonly promptSegments?: LlmCallRecordBase['segments'];
    /**
     * The MODEL's own reply bytes (`result.repair?.originalText ?? result.text`) — written under `keepIo`.
     */
    readonly text?: LlmDispatchResult['text'];
    /**
     * The accepted reply value ({@link LlmDispatchResult.valueJson}), under the row key existing logs already carry —
     * written under `keepIo`.
     */
    readonly lever?: LlmDispatchResult['valueJson'];
  };

/**
 * Project a completed call's in-memory {@link LlmCallRecord} into the flat row a host persists under
 * {@link LLM_CALL_EVENT_TYPE}. Persist this, never the record: every `usage/` reader (the usage cell, the bill
 * reconcile, the attempt summary) and the tape read the flat row, so a raw record — whose result is nested — folds to
 * zero usage and replays as an empty tape.
 *
 * The bounded telemetry is always kept. `keepIo` adds the heavy I/O (`promptSegments`, `text`, a non-empty
 * `failedAttempts`, and the accepted reply value as `lever`); `keepPhases` adds the `phases` timing block. Every key
 * is written only when its value is present (`false` and `0` are kept), `supplements` only when non-empty, and in the
 * order the module table lists. A decision record's `stamp` keys lead the row and never override a library key.
 *
 * `text` is the MODEL's own bytes, not the repaired reply, so a tape built from the row replays what the model said
 * and the deterministic repair re-runs on replay.
 *
 * The row carries the library's keys only: a host field of an `LlmCallRecord<H>` is never copied. The host places its
 * own, either in the payload (the `H` of {@link LlmCallLogPayload}) or on its event envelope.
 *
 * @param record - The completed call, as the dispatcher hands it to `recorder.recordCall`.
 * @param config - What to keep beyond the bounded telemetry; both gates default to off.
 * @returns The flat row to persist.
 *
 * @example
 * ```ts
 * recorder: {
 *   recordCall: (record) => log.write({ type: LLM_CALL_EVENT_TYPE, payload: toLlmCallLogPayload(record, { keepIo: true }) })
 * }
 * ```
 */
export function toLlmCallLogPayload(record: LlmCallRecordBase, config?: Maybe<LlmCallLogPayloadConfig>): LlmCallLogPayloadWrite {
  const { result, failedAttempts, supplements } = record;
  const keepIo = config?.keepIo === true;
  const keepPhases = config?.keepPhases === true;
  // the stamp spreads FIRST so it can never override a library key; every library key is picked by name, so a host
  // field of an `LlmCallRecord<H>` never leaks into the row
  return {
    ...record.stamp,
    ...filterMaybeValues({
      capability: record.capability,
      promptSegments: keepIo ? record.segments : undefined,
      text: keepIo ? (result.repair?.originalText ?? result.text) : undefined,
      failedAttempts: keepIo && failedAttempts != null && failedAttempts.length > 0 ? failedAttempts : undefined,
      ...llmCallTelemetry(result),
      tier: record.tier,
      schemaEnforced: result.schemaEnforced,
      attempts: result.attempts,
      decodeStatus: result.decodeStatus,
      decodeOutcome: result.decodeOutcome,
      lengthCapped: result.lengthCapped,
      lever: keepIo ? result.valueJson : undefined,
      validationErrors: result.validationErrors,
      subject: record.subject,
      decision: record.decision,
      supplements: supplements != null && supplements.length > 0 ? supplements : undefined,
      reasoningOff: record.reasoningOff,
      estimatedPromptTokens: record.estimatedPromptTokens,
      phases: keepPhases ? record.phases : undefined
    })
  };
}
