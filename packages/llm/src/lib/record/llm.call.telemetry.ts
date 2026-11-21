/**
 * The ONE shared projector of a completion into the uniform per-call telemetry block every record a host writes about
 * an LLM call spreads (the cost-observability surface), so a reader can attribute cost and tier per call regardless
 * of which call site produced the record.
 *
 * It is ALSO the one block a dispatch tap reads: a tap is handed the dispatch's raw {@link LlmDispatchResult} on the
 * complete event and calls this projector on it, rather than receiving a second, hand-built copy of the same fields.
 * That is the whole anti-drift rule — the object handed to a tap is the record handed to the host's log, so a tap
 * payload and a logged payload can never become two hand-maintained projections of one call.
 */

import { filterUndefinedValues, type Milliseconds } from '@dereekb/util';
import type { LlmModelId, LlmStrategyId, LlmGenerationId } from '../model/llm.value';
import type { LlmDispatchResult, LlmReplyRepair, LlmReplyRepairSummary } from '../strategy/llm.strategy';
import type { LlmUsage } from '../strategy/llm.usage';

/**
 * The uniform LLM-call telemetry block spread into a record's payload — `strategyId` always, plus the cost and tier
 * fields ({@link LlmDispatchResult.model} / {@link LlmDispatchResult.usage} / {@link LlmDispatchResult.latencyMs})
 * when the producing call captured them (a client strategy does; a scripted or tape strategy carries none).
 */
export interface LlmCallTelemetry {
  /**
   * The strategy INSTANCE that served the call (always present) — e.g. `'openrouter'`, `'account-a'`.
   */
  readonly strategyId: LlmStrategyId;
  /**
   * The transport LANE that served the call (`LlmStrategy.kind ?? id`) — e.g. `'openrouter-decisions'`. The A/B axis
   * a usage ledger folds by strategy on. Absent ⇒ the fold uses
   * {@link strategyId}.
   */
  readonly strategyKind?: LlmStrategyId;
  /**
   * The model that actually served the call; absent on a strategy with no provider completion to read.
   */
  readonly model?: LlmModelId;
  /**
   * The upstream endpoint that served the call ({@link LlmDispatchResult.provider}) — the routing evidence a later
   * "which endpoints honour the reasoning floor" decision needs. Absent on a strategy with no provider completion to
   * read, or when not echoed.
   */
  readonly provider?: string;
  /**
   * Token usage (+ optional provider dollar cost) for the call; absent on a strategy with no provider completion to
   * read.
   */
  readonly usage?: LlmUsage;
  /**
   * Wall-clock time around the model call; absent on a strategy with no provider completion to read.
   */
  readonly latencyMs?: Milliseconds;
  /**
   * The provider's generation id ({@link LlmDispatchResult.generationId}); absent on a strategy with no provider
   * completion to read, or when not echoed.
   */
  readonly generationId?: LlmGenerationId;
  /**
   * Why generation stopped ({@link LlmDispatchResult.finishReason}, e.g. `'stop'` / `'length'`); absent on a
   * strategy with no provider completion to read, or when not echoed.
   */
  readonly finishReason?: string;
  /**
   * How the dispatcher's reply-repair lane repaired this reply ({@link LlmDispatchResult.repair}) — the BOUNDED
   * summary, never the original text. Absent when no repair ran, so an unrepaired row stays byte-identical.
   */
  readonly repair?: LlmReplyRepairSummary;
}

/**
 * The bounded summary of a reply repair — every field but the original text (the fixer's `meta` included, when set).
 *
 * @param repair - The repair riding a result.
 * @returns Its bounded summary.
 */
function llmReplyRepairSummaryOf(repair: LlmReplyRepair): LlmReplyRepairSummary {
  return filterUndefinedValues({ tier: repair.tier, attempt: repair.attempt, verdict: repair.verdict, score: repair.score, ops: repair.ops, meta: repair.meta }, true);
}

/**
 * Project a completion into the uniform {@link LlmCallTelemetry} block — `strategyId` always, and every other field
 * only when present (conditionally omitted, never `undefined`, so a field-less result stays byte-stable when spread
 * into a record). A plain `LlmCompletion` fits the parameter too.
 *
 * @param raw - The completion to project.
 * @returns The uniform telemetry block to spread into a record's payload.
 */
export function llmCallTelemetry(raw: LlmDispatchResult): LlmCallTelemetry {
  const { strategyId, strategyKind, model, provider, usage, latencyMs, generationId, finishReason } = raw;
  // `true` also drops a wire `null`, as the `== null` checks did; key order is kept.
  return filterUndefinedValues({ strategyId, strategyKind, model, provider, usage, latencyMs, generationId, finishReason, repair: raw.repair == null ? undefined : llmReplyRepairSummaryOf(raw.repair) }, true);
}
