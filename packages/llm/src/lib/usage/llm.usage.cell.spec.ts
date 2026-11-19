/**
 * The usage-cell primitives — `emptyLlmUsageCell`, `addLlmUsageCells`, `llmUsageCellOf`, `accumulateLlmUsageCell` and
 * `llmKeyedUsageCellsOf`. These cases re-express a per-run fold's assertions against the primitives, with its numbers.
 *
 * Not ported here: the per-run fold itself (gate reasons, the reasoning floor, quality, the dispatch axis, craft,
 * completion samples, build stamping and every markdown render) stays with the host that owns the fold.
 */

import { describe, it, expect } from 'vitest';
import type { LlmUsage } from '../strategy/llm.usage';
import { accumulateLlmUsageCell, addLlmUsageCells, emptyLlmUsageCell, llmKeyedUsageCellsOf, llmUsageCellOf, type LlmUsageCell } from './llm.usage.cell';

const ZERO: LlmUsageCell = { calls: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, reasoningTokens: 0, cost: 0 };

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

describe('emptyLlmUsageCell', () => {
  it('is the zero cell, in the persisted key order', () => {
    const cell = emptyLlmUsageCell();

    expect(cell).toEqual(ZERO);
    expect(Object.keys(cell)).toEqual(['calls', 'promptTokens', 'completionTokens', 'cachedTokens', 'reasoningTokens', 'cost']);
  });
});

describe('llmUsageCellOf', () => {
  it('counts a call with no usage as one call of zeros', () => {
    expect(llmUsageCellOf(undefined)).toEqual({ ...ZERO, calls: 1 });
  });

  it('coerces a logged string cost so it adds instead of concatenating', () => {
    const cells = [llmUsageCellOf({ ...usageOf(1, 1), cost: '0.25' as unknown as number }), llmUsageCellOf({ ...usageOf(1, 1), cost: '0.5' as unknown as number }), llmUsageCellOf({ ...usageOf(1, 1), cost: 'n/a' as unknown as number })];
    const total = cells.reduce(addLlmUsageCells, emptyLlmUsageCell());

    expect(total.cost).toBe(0.75);
    expect(typeof total.cost).toBe('number');
  });

  it('marks an uncacheable call’s prompt tokens, keyed between cachedTokens and reasoningTokens', () => {
    const cell = llmUsageCellOf(usageOf(1000, 10), true);

    expect(cell.uncacheablePromptTokens).toBe(1000);
    expect(Object.keys(cell)).toEqual(['calls', 'promptTokens', 'completionTokens', 'cachedTokens', 'uncacheablePromptTokens', 'reasoningTokens', 'cost']);
  });

  it('leaves no uncacheable key for an uncacheable call with no prompt tokens', () => {
    expect('uncacheablePromptTokens' in llmUsageCellOf(usageOf(0, 10), true)).toBe(false);
  });
});

describe('accumulateLlmUsageCell / llmKeyedUsageCellsOf', () => {
  it('folds calls into the total and the per-capability / per-model cells, key-sorted', () => {
    const calls: ReadonlyArray<{ readonly capability: string; readonly model: string; readonly usage: LlmUsage }> = [
      { capability: 'extract', model: 'vendor/model-a', usage: usageOf(100, 20, { cost: 10, cachedTokens: 64 }) },
      { capability: 'summarize', model: 'vendor/model-b', usage: usageOf(50, 10, { cost: 2, cachedTokens: 0 }) },
      // the third call reports NO cache detail
      { capability: 'summarize', model: 'vendor/model-b', usage: usageOf(40, 8, { cost: 1 }) }
    ];
    const byCapability = new Map<string, LlmUsageCell>();
    const byModel = new Map<string, LlmUsageCell>();
    let total = emptyLlmUsageCell();

    calls.forEach((call) => {
      const cell = llmUsageCellOf(call.usage);
      total = addLlmUsageCells(total, cell);
      accumulateLlmUsageCell(byCapability, call.capability, cell);
      accumulateLlmUsageCell(byModel, call.model, cell);
    });

    expect(total).toEqual({ calls: 3, promptTokens: 190, completionTokens: 38, cachedTokens: 64, reasoningTokens: 0, cost: 13 });
    expect(llmKeyedUsageCellsOf(byCapability)).toEqual([
      { key: 'extract', cell: { calls: 1, promptTokens: 100, completionTokens: 20, cachedTokens: 64, reasoningTokens: 0, cost: 10 } },
      { key: 'summarize', cell: { calls: 2, promptTokens: 90, completionTokens: 18, cachedTokens: 0, reasoningTokens: 0, cost: 3 } }
    ]);
    expect(llmKeyedUsageCellsOf(byModel)).toEqual([
      { key: 'vendor/model-a', cell: { calls: 1, promptTokens: 100, completionTokens: 20, cachedTokens: 64, reasoningTokens: 0, cost: 10 } },
      { key: 'vendor/model-b', cell: { calls: 2, promptTokens: 90, completionTokens: 18, cachedTokens: 0, reasoningTokens: 0, cost: 3 } }
    ]);
  });

  it('buckets calls by tier key, a host-chosen bucket first by code-unit order', () => {
    const byTier = new Map<string, LlmUsageCell>();
    accumulateLlmUsageCell(byTier, 'strong', llmUsageCellOf(usageOf(100, 20, { cost: 10 })));
    accumulateLlmUsageCell(byTier, 'fast', llmUsageCellOf(usageOf(50, 10, { cost: 2 })));
    accumulateLlmUsageCell(byTier, 'fast', llmUsageCellOf(usageOf(40, 8, { cost: 1 })));
    accumulateLlmUsageCell(byTier, '(untiered)', llmUsageCellOf(usageOf(10, 2, { cost: 0.5 })));

    expect(llmKeyedUsageCellsOf(byTier)).toEqual([
      { key: '(untiered)', cell: { calls: 1, promptTokens: 10, completionTokens: 2, cachedTokens: 0, reasoningTokens: 0, cost: 0.5 } },
      { key: 'fast', cell: { calls: 2, promptTokens: 90, completionTokens: 18, cachedTokens: 0, reasoningTokens: 0, cost: 3 } },
      { key: 'strong', cell: { calls: 1, promptTokens: 100, completionTokens: 20, cachedTokens: 0, reasoningTokens: 0, cost: 10 } }
    ]);
  });
});

describe('addLlmUsageCells', () => {
  it('reads a legacy cell missing the cache / reasoning fields as zero, never NaN', () => {
    const sum = addLlmUsageCells(emptyLlmUsageCell(), { calls: 1, promptTokens: 10, completionTokens: 2, cost: 0.1 } as unknown as LlmUsageCell);

    expect(sum.cachedTokens).toBe(0);
    expect(sum.reasoningTokens).toBe(0);
    expect(Number.isNaN(sum.cachedTokens)).toBe(false);
    expect(Number.isNaN(sum.reasoningTokens)).toBe(false);
  });

  it('keeps a cell with no uncacheable tokens byte-stable across a JSON round trip and a re-fold', () => {
    const cell = [llmUsageCellOf(usageOf(4000, 200, { cost: 0.001, cachedTokens: 3000 })), llmUsageCellOf(usageOf(100, 5))].reduce(addLlmUsageCells, emptyLlmUsageCell());
    const json = JSON.stringify(cell);

    expect(json).not.toContain('uncacheablePromptTokens');
    expect(JSON.stringify(addLlmUsageCells(emptyLlmUsageCell(), JSON.parse(json) as LlmUsageCell))).toBe(json);
  });
});
