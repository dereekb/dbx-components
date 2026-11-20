/**
 * The **persisted call payload**: the read-side view of what a host's recorder writes for each completed call
 * ({@link LlmCallRecord}) under {@link LLM_CALL_EVENT_TYPE}. The in-memory record nests its result and always carries
 * the prompt; a persisted row is flat, and its heavy keys (the prompt, the reply, the failed attempts) are the host's
 * choice to keep. Every reader in the library (`readLlmCallPrompt`, `readLlmCallFailedAttempts`, the bill reconcile,
 * the tape) reads this shape, so the write side and the read side cannot drift.
 *
 * THE MAPPING a recorder follows when it persists an {@link LlmCallRecord}:
 *
 * | payload key(s) | from the record |
 * |---|---|
 * | `capability`, `tier`, `decision`, `supplements` (only when non-empty), `reasoningOff`, `estimatedPromptTokens`, `phases` | the record's own fields |
 * | `strategyId`, `strategyKind`, `model`, `provider`, `usage`, `latencyMs`, `generationId`, `finishReason`, `repair` | `llmCallTelemetry(record.result)` |
 * | `attempts`, `validationErrors`, `decodeStatus`, `decodeOutcome`, `lengthCapped` | `record.result` |
 * | `promptSegments` (heavy; persisting it is the host's choice) | `record.segments` |
 * | `text` (heavy) | `record.result.repair?.originalText ?? record.result.text` — the MODEL's bytes |
 * | `failedAttempts` (heavy; only when non-empty) | `record.failedAttempts` |
 * | host fields | beside the library's, never nested |
 *
 * `text` is the model's own bytes, not the repaired reply: a tape built from the row then replays what the model said,
 * and the deterministic repair re-runs on replay.
 */

import type { Milliseconds, Count } from '@dereekb/util';
import type { LlmCapabilityKey, LlmModelId, LlmModelTierKey, LlmStrategyId, LlmTokenCount, LlmGenerationId } from '../model/llm.value';
import type { LlmPromptSegment } from '../prompt/llm.prompt.segment';
import type { LlmReplyRepairSummary } from '../strategy/llm.strategy';
import type { LlmUsage } from '../strategy/llm.usage';
import type { LlmCallFailedAttempt, LlmCallHostFields, LlmCallPhases, LlmCallSupplement } from './llm.call.record';
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
   * timing panel reads. Present only when the dispatcher captured timing; absent otherwise (byte-stable absence).
   */
  readonly phases?: LlmCallPhases;
  /**
   * Whether the dispatcher's RESOLVED reasoning config for this call was OFF (`{ enabled: false }`) — the denominator
   * of a reasoning-floor check. Threaded so a capability that legitimately opts INTO reasoning per invocation is not
   * counted as a floor violation. A row omitting it is read as OFF (`!== false`).
   */
  readonly reasoningOff?: boolean;
  /**
   * The dispatcher's ESTIMATED prompt-token count — written only when the caller pinned a prompt-token budget, so a
   * ledger can report estimate-vs-served drift against the served {@link LlmUsage.promptTokens}. Absent for every
   * call without a pinned prompt-token budget.
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
   * Every attempt the bounded retry loop REJECTED, with its reply in full ({@link LlmCallFailedAttempt}) — written
   * beside {@link text} when the host keeps prompts, and only when the loop rejected one. {@link text} is still the
   * FINAL reply (a dropped dispatch's last row repeats it) and {@link promptSegments} still attempt 1's. Read it
   * through `readLlmCallFailedAttempts`, which drops a malformed row and answers `undefined` for a clean call, a host
   * that keeps no prompts, or a row without attempt rows.
   */
  readonly failedAttempts?: ReadonlyArray<LlmCallFailedAttempt>;
}

/**
 * A persisted call payload: the library's fields ({@link LlmCallLogPayloadBase}) beside the host's own fields `H`
 * (attribution, correlation ids, a routing reason), never nested — the same extension rule as {@link LlmCallRecord}.
 */
export type LlmCallLogPayload<H extends LlmCallHostFields = LlmCallHostFields> = LlmCallLogPayloadBase & H;
