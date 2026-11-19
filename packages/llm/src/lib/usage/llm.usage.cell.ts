/**
 * The **usage cell**: the calls / tokens / cost summed over one slice of a run (a capability, a model, a tier, the
 * whole run), plus the five primitives every usage fold is built from — the zero cell, the sum, one call's cell, the
 * keyed accumulator and the key-sorted projection.
 *
 * Cells are plain JSON. A host persists them, re-reads them from an older build and adds them again, so every read is
 * tolerant of a missing field and every optional field is omitted at zero: a re-fold of persisted cells is
 * byte-stable.
 */

import { type DollarAmount, type Maybe } from '@dereekb/util';
import { llmCostOf, type LlmUsage } from '../strategy/llm.usage';

/**
 * One aggregated usage cell — the calls / tokens / cost summed over some (model, capability, …) slice.
 */
export interface LlmUsageCell {
  /**
   * How many calls the cell folds.
   */
  readonly calls: number;
  /**
   * Summed billed prompt tokens.
   */
  readonly promptTokens: number;
  /**
   * Summed billed completion tokens.
   */
  readonly completionTokens: number;
  /**
   * Summed prompt tokens served from a warm provider cache ({@link LlmUsage.cachedTokens}) — a subset of
   * {@link promptTokens}. `0` when no call in the slice reported one: read it alongside the enclosing fold's
   * `cachePartial` flag, which says whether `0` means "none" or "unknown" (absence is not a 0% hit rate).
   */
  readonly cachedTokens: number;
  /**
   * Summed prompt tokens of calls on a lane with NO prompt cache (the decision lane, `isUncacheableLlmCall`) — a
   * subset of {@link promptTokens}, exactly as {@link cachedTokens} is. They stay in every spend figure but leave every
   * cache-hit DENOMINATOR (`llmCacheablePromptTokensOf`): a decision call's `0` cached is "not applicable", not a miss.
   * OMITTED when 0, so a cell with no decision calls (and every persisted cell from before the field existed)
   * serializes byte-identically; read it with `?? 0`.
   */
  readonly uncacheablePromptTokens?: number;
  /**
   * Summed HIDDEN reasoning tokens ({@link LlmUsage.reasoningTokens}) a hybrid-reasoning model billed — a subset of
   * {@link completionTokens}, exactly as {@link cachedTokens} is a subset of {@link promptTokens}. `0` when no call in
   * the slice reported one: read it alongside the enclosing fold's `reasoningPartial` flag (absence is not "no
   * reasoning").
   */
  readonly reasoningTokens: number;
  /**
   * Summed provider cost. `0` when no call in the slice reported one: read it alongside the enclosing fold's
   * `costPartial` flag.
   */
  readonly cost: DollarAmount;
}

/**
 * A usage cell keyed by some dimension value (a capability or a model id) — the JSON-friendly stand-in for a `Map`
 * entry.
 */
export interface LlmKeyedUsageCell<K extends string> {
  /**
   * The dimension value.
   */
  readonly key: K;
  /**
   * The cell summed under it.
   */
  readonly cell: LlmUsageCell;
}

/**
 * The zero cell.
 *
 * @returns An empty {@link LlmUsageCell}.
 *
 * @example
 * ```ts
 * emptyLlmUsageCell(); // { calls: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, reasoningTokens: 0, cost: 0 }
 * ```
 */
export function emptyLlmUsageCell(): LlmUsageCell {
  return { calls: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, reasoningTokens: 0, cost: 0 };
}

/**
 * Add two usage cells component-wise.
 *
 * `cachedTokens`, `reasoningTokens` and `uncacheablePromptTokens` are read with `?? 0`, so folding a persisted cell
 * written before one of those fields existed can never NaN-poison the running totals. The uncacheable count is omitted
 * at 0, so a fold with no decision calls serializes byte-identically.
 *
 * @param a - The first cell.
 * @param b - The second cell.
 * @returns The summed cell.
 *
 * @example
 * ```ts
 * const total = addLlmUsageCells(emptyLlmUsageCell(), llmUsageCellOf({ promptTokens: 100, completionTokens: 20 }));
 * ```
 */
export function addLlmUsageCells(a: LlmUsageCell, b: LlmUsageCell): LlmUsageCell {
  const uncacheable = (a.uncacheablePromptTokens ?? 0) + (b.uncacheablePromptTokens ?? 0);
  return {
    calls: a.calls + b.calls,
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    cachedTokens: (a.cachedTokens ?? 0) + (b.cachedTokens ?? 0),
    ...(uncacheable > 0 ? { uncacheablePromptTokens: uncacheable } : {}),
    reasoningTokens: (a.reasoningTokens ?? 0) + (b.reasoningTokens ?? 0),
    cost: a.cost + b.cost
  };
}

/**
 * The cell contribution of one call's usage (a call always counts as one, tokens/cost when present).
 *
 * The cost is read through {@link llmCostOf} because the usage comes out of a LOGGED row: a row written before the
 * entry-side coercion can hold a gateway's string cost, which a plain `+` would concatenate.
 *
 * @param usage - The call's usage block (absent on an injected seam).
 * @param uncacheable - Whether the call rode a lane with no prompt cache (`isUncacheableLlmCall`); its prompt tokens
 *   are then all {@link LlmUsageCell.uncacheablePromptTokens}.
 * @returns The single-call cell.
 *
 * @example
 * ```ts
 * const cell = llmUsageCellOf(payload.usage, isUncacheableLlmCall(payload, decisionStrategyKinds));
 * ```
 */
export function llmUsageCellOf(usage: Maybe<LlmUsage>, uncacheable = false): LlmUsageCell {
  const promptTokens = usage?.promptTokens ?? 0;
  return { calls: 1, promptTokens, completionTokens: usage?.completionTokens ?? 0, cachedTokens: usage?.cachedTokens ?? 0, ...(uncacheable && promptTokens > 0 ? { uncacheablePromptTokens: promptTokens } : {}), reasoningTokens: usage?.reasoningTokens ?? 0, cost: llmCostOf(usage?.cost) ?? 0 };
}

/**
 * Accumulate a keyed cell into a `Map` (creating the zero cell on first sight).
 *
 * @param map - The accumulator.
 * @param key - The dimension value.
 * @param cell - The contribution.
 *
 * @example
 * ```ts
 * const byModel = new Map<string, LlmUsageCell>();
 * accumulateLlmUsageCell(byModel, payload.model ?? '(unknown model)', llmUsageCellOf(payload.usage));
 * ```
 */
export function accumulateLlmUsageCell<K extends string>(map: Map<K, LlmUsageCell>, key: K, cell: LlmUsageCell): void {
  map.set(key, addLlmUsageCells(map.get(key) ?? emptyLlmUsageCell(), cell));
}

/**
 * Project a keyed-cell `Map` to a stable, key-sorted array (so renders and goldens are deterministic). Keys compare
 * with `<` / `>`, never a locale.
 *
 * @param map - The keyed cells.
 * @returns The sorted array of keyed cells.
 *
 * @example
 * ```ts
 * const rows = llmKeyedUsageCellsOf(byModel); // [{ key: 'vendor-a/model-small', cell }, …]
 * ```
 */
export function llmKeyedUsageCellsOf<K extends string>(map: ReadonlyMap<K, LlmUsageCell>): ReadonlyArray<LlmKeyedUsageCell<K>> {
  return Array.from(map.entries())
    .map(([key, cell]) => ({ key, cell }))
    .sort((a, b) => compareLlmUsageCellKeys(a.key, b.key));
}

/**
 * Compare two cell keys by code-unit order (`<` / `>`), never a locale.
 *
 * @param a - The first key.
 * @param b - The second key.
 * @returns A negative, zero or positive sort result.
 */
function compareLlmUsageCellKeys(a: string, b: string): number {
  let result = 0;

  if (a < b) {
    result = -1;
  } else if (a > b) {
    result = 1;
  }

  return result;
}
