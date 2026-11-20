/**
 * Usage rates — the cache-hit rate over CACHEABLE prompt tokens, the reasoning share, the per-capability cache rows,
 * the decision lane's "not applicable" treatment, and the one shared cache line.
 *
 * Not ported here: the per-run fold and its markdown renders (the budget block, the ledger table and their notes)
 * stay with the host that owns the fold; these cases re-express its numbers against the primitives.
 */

import { describe, it, expect } from 'vitest';
import type { LlmUsage } from '../strategy/llm.usage';
import { accumulateLlmUsageCell, addLlmUsageCells, emptyLlmUsageCell, llmKeyedUsageCellsOf, llmUsageCellOf, type LlmUsageCell } from './llm.usage.cell';
import { formatLlmUsageRate, isUncacheableLlmCall, llmCacheablePromptTokensOf, llmCacheHitRateOf, llmCapabilityCacheRowsOf, llmReasoningShareOf, renderLlmCacheHitLine } from './llm.usage.rate';

const KINDS: ReadonlySet<string> = new Set(['vendor-decisions']);

describe('llmCacheHitRateOf / llmReasoningShareOf', () => {
  it('answers undefined rather than 0 when a cell has no denominator', () => {
    const empty: LlmUsageCell = { calls: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, reasoningTokens: 0, cost: 0 };

    expect(llmCacheHitRateOf(empty)).toBeUndefined();
    expect(llmReasoningShareOf(empty)).toBeUndefined();
  });

  it('measures the reasoning share of completion tokens', () => {
    expect(llmReasoningShareOf({ calls: 2, promptTokens: 8200, completionTokens: 480, cachedTokens: 6000, reasoningTokens: 100, cost: 0.0011 })).toBeCloseTo(0.2083, 4);
  });
});

describe('formatLlmUsageRate', () => {
  it('renders n/a with no denominator and a one-decimal percentage otherwise', () => {
    expect(formatLlmUsageRate(undefined)).toBe('n/a');
    expect(formatLlmUsageRate(0.7317)).toBe('73.2%');
  });
});

describe('llmCapabilityCacheRowsOf / renderLlmCacheHitLine', () => {
  const SUMMARIZE: LlmUsageCell = { calls: 1, promptTokens: 8000, completionTokens: 400, cachedTokens: 6000, reasoningTokens: 100, cost: 0.001 };
  const CLASSIFY: LlmUsageCell = { calls: 1, promptTokens: 200, completionTokens: 80, cachedTokens: 0, reasoningTokens: 0, cost: 0.0001 };

  it('ranks capability rows by prompt-token denominator, heaviest first', () => {
    const rows = llmCapabilityCacheRowsOf([
      { key: 'classify', cell: CLASSIFY },
      { key: 'summarize', cell: SUMMARIZE }
    ]);

    expect(rows.map((row) => row.capability)).toEqual(['summarize', 'classify']);
    expect(rows[0].cacheHitRate).toBeCloseTo(0.75, 5);
    expect(rows[0].promptTokens).toBe(8000);
    expect(rows[1].cacheHitRate).toBe(0);
  });

  it('breaks a tie on the capability key by code unit — the same order llmKeyedUsageCellsOf gives', () => {
    const byCapability = new Map<string, LlmUsageCell>([
      ['summarize', CLASSIFY],
      ['CritiqueReply', CLASSIFY]
    ]);
    const keyed = llmKeyedUsageCellsOf(byCapability);
    const rows = llmCapabilityCacheRowsOf(keyed);

    expect(keyed.map((entry) => entry.key)).toEqual(['CritiqueReply', 'summarize']);
    expect(rows.map((row) => row.capability)).toEqual(['CritiqueReply', 'summarize']);
  });

  it('renders one shared cache line, marking a partial fold a LOWER bound', () => {
    const total: LlmUsageCell = { calls: 2, promptTokens: 8200, completionTokens: 480, cachedTokens: 6000, reasoningTokens: 100, cost: 0.0011 };

    expect(renderLlmCacheHitLine({ cell: total })).toBe('cache 73.2% hit (6,000/8,200 prompt tok) · reasoning 20.8% of completion (100 tok)');
    expect(renderLlmCacheHitLine({ cell: total, cachePartial: true })).toContain('cache ≥73.2% hit');
  });
});

describe('the decision lane (cache NOT APPLICABLE, not a miss)', () => {
  const DECISION_MODEL = 'vendor-decisions/model-jev';

  /**
   * A usage block with its total filled in.
   *
   * @param promptTokens - The prompt tokens.
   * @param completionTokens - The completion tokens.
   * @param rest - Any further usage fields.
   * @returns The usage.
   */
  function usageOf(promptTokens: number, completionTokens: number, rest?: Partial<LlmUsage>): LlmUsage {
    return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, ...rest };
  }

  // A completion that reported its cache detail, beside a decision call filed under the SAME capability that — by
  // design — reports none.
  const completion = llmUsageCellOf(usageOf(4000, 200, { cost: 0.001, cachedTokens: 3000, reasoningTokens: 0 }), isUncacheableLlmCall({ strategyKind: 'vendor' }, KINDS));
  const decision = llmUsageCellOf(usageOf(1000, 10, { cost: 0.0002 }), isUncacheableLlmCall({ decision: 'pick-route' }, KINDS));

  /**
   * Fold the two calls into a total plus by-capability and by-model cells.
   *
   * @returns The fold.
   */
  function fold(): { readonly total: LlmUsageCell; readonly byCapability: Map<string, LlmUsageCell>; readonly byModel: Map<string, LlmUsageCell> } {
    const byCapability = new Map<string, LlmUsageCell>();
    const byModel = new Map<string, LlmUsageCell>();
    accumulateLlmUsageCell(byCapability, 'summarize', completion);
    accumulateLlmUsageCell(byModel, 'vendor-a/model-small', completion);
    accumulateLlmUsageCell(byCapability, 'summarize', decision);
    accumulateLlmUsageCell(byModel, DECISION_MODEL, decision);
    return { total: addLlmUsageCells(addLlmUsageCells(emptyLlmUsageCell(), completion), decision), byCapability, byModel };
  }

  it('recognizes a decision row by its decision id or its decision transport', () => {
    expect(isUncacheableLlmCall({ decision: 'pick-route' })).toBe(true);
    expect(isUncacheableLlmCall({ strategyKind: 'vendor-decisions' }, KINDS)).toBe(true);
    expect(isUncacheableLlmCall({ strategyKind: 'vendor-decisions' })).toBe(false);
    expect(isUncacheableLlmCall({ strategyKind: 'vendor' }, KINDS)).toBe(false);
    expect(isUncacheableLlmCall({}, KINDS)).toBe(false);
  });

  it('reads the lane from strategyKind only, never a pre-split strategyId', () => {
    expect(isUncacheableLlmCall({ strategyId: 'vendor-decisions' } as never, KINDS)).toBe(false);
  });

  it('keeps decision prompt tokens out of every cache denominator', () => {
    const { total, byCapability, byModel } = fold();

    expect(total.promptTokens).toBe(5000);
    expect(total.uncacheablePromptTokens).toBe(1000);
    expect(llmCacheablePromptTokensOf(total)).toBe(4000);
    expect(llmCacheHitRateOf(total)).toBeCloseTo(0.75, 5);

    const [summarize] = llmCapabilityCacheRowsOf(llmKeyedUsageCellsOf(byCapability));

    expect(summarize.capability).toBe('summarize');
    expect(summarize.promptTokens).toBe(5000);
    expect(summarize.uncacheablePromptTokens).toBe(1000);
    expect(summarize.cacheHitRate).toBeCloseTo(0.75, 5);

    // A decision-only cell has no cacheable denominator: its rate is unmeasurable, not 0%.
    const decisionCell = byModel.get(DECISION_MODEL);

    expect(decisionCell?.uncacheablePromptTokens).toBe(1000);
    expect(decisionCell == null ? 0 : llmCacheHitRateOf(decisionCell)).toBeUndefined();
  });

  it('names the decision lane in the shared cache line, over the cacheable denominator', () => {
    expect(renderLlmCacheHitLine({ cell: fold().total })).toBe('cache 75.0% hit (3,000/4,000 prompt tok) · decision lane n/a (1,000 prompt tok, no prompt cache) · reasoning 0.0% of completion (0 tok)');
  });

  it('leaves a cell with no decision calls without the decision-lane clause', () => {
    expect(renderLlmCacheHitLine({ cell: completion })).toBe('cache 75.0% hit (3,000/4,000 prompt tok) · reasoning 0.0% of completion (0 tok)');
  });
});
