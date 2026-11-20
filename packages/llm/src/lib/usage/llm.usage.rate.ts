/**
 * **Usage rates**: the prompt-cache hit rate and the hidden-reasoning share of a usage cell, the per-capability cache
 * rows a run summary persists, and the one-line cache readout every surface prints.
 *
 * A rate is `undefined` when there is nothing to divide by — "nothing was asked" reads very differently from a
 * measured 0% and is never rendered as one.
 */

import { compareStringsByCodeUnit, type Maybe } from '@dereekb/util';
import type { LlmCapabilityKey, LlmStrategyId } from '../model/llm.value';
import type { LlmCallLogPayloadBase } from '../record/llm.call.payload';
import type { LlmKeyedUsageCell, LlmUsageCell } from './llm.usage.cell';

/**
 * Is this `llm_call` on a lane with NO prompt cache — a decision-lane call? True when the row carries a
 * {@link LlmCallLogPayloadBase.decision} id (every dispatcher-recorded decision does, the scripted backend included) or
 * rode a decision transport (its `strategyKind` is in `decisionStrategyKinds`). Such a call never reports
 * `cachedTokens` by design, so its prompt tokens are cache-not-applicable: out of every hit-rate denominator, and never
 * a `cachePartial` trip. Old rows already carry `decision`, so a re-fold over old logs corrects past runs too.
 *
 * The lane read here is `strategyKind` ONLY — unlike `isDecisionLlmCallRow`, there is no `strategyId` fallback. A row
 * written before `strategyKind` existed counts as uncacheable only through its `decision` id. The difference is kept
 * on purpose: it moves ledger numbers on old rows.
 *
 * @param payload - The call payload.
 * @param decisionStrategyKinds - The decision transports' strategy kinds, built once with
 *   `llmDecisionStrategyKinds(adapters)`; absent ⇒ only a `decision` id marks the call.
 * @returns Whether the call's prompt tokens are uncacheable.
 *
 * @example
 * ```ts
 * const kinds = llmDecisionStrategyKinds(adapters);
 * const cell = llmUsageCellOf(payload.usage, isUncacheableLlmCall(payload, kinds));
 * ```
 */
export function isUncacheableLlmCall(payload: Pick<LlmCallLogPayloadBase, 'decision' | 'strategyKind'>, decisionStrategyKinds?: Maybe<ReadonlySet<LlmStrategyId>>): boolean {
  return payload.decision != null || (payload.strategyKind != null && decisionStrategyKinds?.has(payload.strategyKind) === true);
}

/**
 * The cache-hit DENOMINATOR of one cell — its prompt tokens minus the {@link LlmUsageCell.uncacheablePromptTokens} of
 * calls on a lane with no prompt cache. The ONE subtraction every hit rate divides by.
 *
 * @param cell - The usage cell.
 * @returns The prompt tokens a prompt cache could have served.
 *
 * @example
 * ```ts
 * llmCacheablePromptTokensOf({ promptTokens: 5000, uncacheablePromptTokens: 1000 }); // 4000
 * ```
 */
export function llmCacheablePromptTokensOf(cell: Pick<LlmUsageCell, 'promptTokens' | 'uncacheablePromptTokens'>): number {
  return cell.promptTokens - (cell.uncacheablePromptTokens ?? 0);
}

/**
 * The prompt-cache HIT RATE of one cell — `cachedTokens / cacheable prompt tokens` ({@link llmCacheablePromptTokensOf}),
 * the share of cacheable input a warm provider cache served. `undefined` when the cell billed no CACHEABLE prompt
 * tokens: a zero denominator is "nothing was asked" (or "only the decision lane, which has no cache"), which reads very
 * differently from a measured 0% miss rate and must not be rendered as one.
 *
 * The rate is a LOWER BOUND wherever the enclosing fold's `cachePartial` is set — a provider that reports no cache
 * detail is indistinguishable from one that served nothing warm, so the qualifier travels with the number.
 *
 * @param cell - The usage cell.
 * @returns The hit rate in `[0, 1]`, or `undefined` when the cell has no cacheable denominator.
 *
 * @example
 * ```ts
 * llmCacheHitRateOf({ promptTokens: 8000, cachedTokens: 6000 }); // 0.75
 * ```
 */
export function llmCacheHitRateOf(cell: Pick<LlmUsageCell, 'promptTokens' | 'cachedTokens' | 'uncacheablePromptTokens'>): Maybe<number> {
  const cacheable = llmCacheablePromptTokensOf(cell);
  return cacheable > 0 ? (cell.cachedTokens ?? 0) / cacheable : undefined;
}

/**
 * The hidden-REASONING share of one cell — `reasoningTokens / completionTokens`. The sibling of
 * {@link llmCacheHitRateOf} and rendered beside it everywhere: cache-hit is the share of INPUT nobody paid full price
 * for, reasoning share is the share of OUTPUT nobody asked for. `undefined` on a zero denominator, for that helper's
 * reason exactly.
 *
 * @param cell - The usage cell.
 * @returns The share in `[0, 1]`, or `undefined` when the cell has no denominator.
 *
 * @example
 * ```ts
 * llmReasoningShareOf(total); // e.g. 0.2083 for 100 reasoning of 480 completion tokens
 * ```
 */
export function llmReasoningShareOf(cell: LlmUsageCell): Maybe<number> {
  return cell.completionTokens > 0 ? (cell.reasoningTokens ?? 0) / cell.completionTokens : undefined;
}

/**
 * One capability's CACHE row — the per-capability cache-hit readout a run summary persists so a later run can be
 * compared against it without re-reading a log. The denominators ride ALONGSIDE the rates on purpose: a rate over 300
 * prompt tokens and a rate over 300,000 are not the same evidence, and a summary that recorded only the ratio cannot
 * tell them apart afterwards.
 */
export interface LlmCapabilityCacheRow {
  /**
   * The capability.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * How many calls the row folds.
   */
  readonly calls: number;
  /**
   * Billed prompt tokens (minus {@link uncacheablePromptTokens}, the {@link cacheHitRate} denominator).
   */
  readonly promptTokens: number;
  /**
   * Prompt tokens served warm.
   */
  readonly cachedTokens: number;
  /**
   * Prompt tokens of the row's decision-lane calls, which have no prompt cache
   * ({@link LlmUsageCell.uncacheablePromptTokens}); omitted when 0.
   */
  readonly uncacheablePromptTokens?: number;
  /**
   * `cachedTokens / (promptTokens − uncacheablePromptTokens)`; absent when the row billed no cacheable prompt tokens.
   */
  readonly cacheHitRate?: number;
  /**
   * Billed completion tokens (the {@link reasoningShare} denominator).
   */
  readonly completionTokens: number;
  /**
   * Completion tokens billed as hidden reasoning.
   */
  readonly reasoningTokens: number;
  /**
   * `reasoningTokens / completionTokens`; absent when the row billed no completion tokens.
   */
  readonly reasoningShare?: number;
}

/**
 * Project a fold's by-capability cells into {@link LlmCapabilityCacheRow}s, ranked by CACHEABLE prompt tokens
 * descending ({@link llmCacheablePromptTokensOf}) — the capability with the most input to cache leads, because it is the
 * one whose prefix is worth moving (decision-lane input has no cache to move it into). Ties break on the capability
 * key.
 *
 * @param cells - The by-capability cells of a fold (e.g. `llmKeyedUsageCellsOf(byCapability)`).
 * @returns The cache rows, heaviest denominator first.
 *
 * @example
 * ```ts
 * const rows = llmCapabilityCacheRowsOf(llmKeyedUsageCellsOf(byCapability));
 * ```
 */
export function llmCapabilityCacheRowsOf(cells: ReadonlyArray<LlmKeyedUsageCell<LlmCapabilityKey>>): ReadonlyArray<LlmCapabilityCacheRow> {
  return [...cells]
    .sort((a, b) => llmCacheablePromptTokensOf(b.cell) - llmCacheablePromptTokensOf(a.cell) || compareStringsByCodeUnit(a.key, b.key))
    .map((entry) => {
      const hitRate = llmCacheHitRateOf(entry.cell);
      const share = llmReasoningShareOf(entry.cell);
      const uncacheable = entry.cell.uncacheablePromptTokens ?? 0;
      return {
        capability: entry.key,
        calls: entry.cell.calls,
        promptTokens: entry.cell.promptTokens,
        cachedTokens: entry.cell.cachedTokens ?? 0,
        ...(uncacheable > 0 ? { uncacheablePromptTokens: uncacheable } : {}),
        ...(hitRate == null ? {} : { cacheHitRate: hitRate }),
        completionTokens: entry.cell.completionTokens,
        reasoningTokens: entry.cell.reasoningTokens ?? 0,
        ...(share == null ? {} : { reasoningShare: share })
      };
    });
}

/**
 * Render a rate in `[0, 1]` as a one-decimal percentage, or `n/a` when there was no denominator — the ONE formatting of
 * a cache-hit / reasoning share, so every surface that prints one prints it the same way.
 *
 * @param rate - The rate, or `undefined` when unmeasurable.
 * @returns The formatted percentage.
 *
 * @example
 * ```ts
 * formatLlmUsageRate(0.7317); // '73.2%'
 * formatLlmUsageRate(undefined); // 'n/a'
 * ```
 */
export function formatLlmUsageRate(rate: Maybe<number>): string {
  return rate == null ? 'n/a' : `${(rate * 100).toFixed(1)}%`;
}

/**
 * Config for {@link renderLlmCacheHitLine}: the cell plus the fold's partiality qualifiers.
 */
export interface RenderLlmCacheHitLineConfig {
  /**
   * The folded usage cell.
   */
  readonly cell: LlmUsageCell;
  /**
   * Whether ≥1 counted call reported no cache detail (the hit rate is then a lower bound).
   */
  readonly cachePartial?: boolean;
  /**
   * Whether ≥1 counted call reported no reasoning detail (the reasoning share is then a lower bound).
   */
  readonly reasoningPartial?: boolean;
}

/**
 * The compact one-line cache readout for a fold — `cache 41.2% hit (12,004/29,140 prompt tok) · reasoning 3.1% of
 * completion (…)`, with a `≥` marker when the fold lacked cache detail on some call (the number is then a LOWER bound,
 * not a measurement). The shared fragment a budget line, a run summary and a timing panel each print, so a reader
 * comparing three outputs is comparing one number.
 *
 * The denominator is the CACHEABLE prompt tokens ({@link llmCacheablePromptTokensOf}); when the fold carries
 * decision-lane input a `· decision lane n/a (N prompt tok, no prompt cache)` clause names what was left out.
 *
 * @param config - The cell plus the fold's partiality qualifiers.
 * @returns The rendered fragment.
 *
 * @example
 * ```ts
 * renderLlmCacheHitLine({ cell: total, cachePartial: fold.cachePartial });
 * // 'cache 73.2% hit (6,000/8,200 prompt tok) · reasoning 20.8% of completion (100 tok)'
 * ```
 */
export function renderLlmCacheHitLine(config: RenderLlmCacheHitLineConfig): string {
  const { cell, cachePartial, reasoningPartial } = config;
  const cacheMark = cachePartial === true ? '≥' : '';
  const reasoningMark = reasoningPartial === true ? '≥' : '';
  const cached = cell.cachedTokens ?? 0;
  const uncacheable = cell.uncacheablePromptTokens ?? 0;
  const reasoning = cell.reasoningTokens ?? 0;
  const decisionLane = uncacheable > 0 ? ` · decision lane n/a (${uncacheable.toLocaleString('en-US')} prompt tok, no prompt cache)` : '';
  return `cache ${cacheMark}${formatLlmUsageRate(llmCacheHitRateOf(cell))} hit (${cached.toLocaleString('en-US')}/${llmCacheablePromptTokensOf(cell).toLocaleString('en-US')} prompt tok)${decisionLane} · reasoning ${reasoningMark}${formatLlmUsageRate(llmReasoningShareOf(cell))} of completion (${reasoning.toLocaleString('en-US')} tok)`;
}
