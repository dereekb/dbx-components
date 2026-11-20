/**
 * Cost honesty — `formatLlmUsageCost` / `resolveLlmUsageCostMarker` / `isLlmUsageCostUnavailable` / `readLlmUsageCostFlags`.
 * A hole must never read as free and a list price must never read as a bill.
 *
 * Not ported here: the per-run fold and its markdown renders (gate reasons, the reasoning floor, quality, the dispatch
 * axis, craft, completion samples, build stamping) stay with the host that owns the fold.
 */

import { describe, it, expect } from 'vitest';
import { formatLlmUsageCost, isLlmUsageCostUnavailable, LLM_USAGE_COST_UNAVAILABLE_CELL, readLlmUsageCostFlags, resolveLlmUsageCostMarker } from './llm.usage.cost';

describe('isLlmUsageCostUnavailable / formatLlmUsageCost', () => {
  it('never throws on a malformed cost: a numeric string renders as its number, anything else as unavailable', () => {
    expect(formatLlmUsageCost({ cost: '0.5' as unknown as number, calls: 1, partial: false })).toBe('$0.500000');
    expect(formatLlmUsageCost({ cost: '00.250.5' as unknown as number, calls: 2, partial: false })).toBe(LLM_USAGE_COST_UNAVAILABLE_CELL);
    expect(formatLlmUsageCost({ cost: Number.NaN, calls: 1, partial: false })).toBe(LLM_USAGE_COST_UNAVAILABLE_CELL);
  });

  it('separates an UNKNOWN cost from a measured zero across the four branches', () => {
    // UNKNOWN: calls were counted, >=1 reported no cost, and NONE reported any — the sum is a hole.
    expect(isLlmUsageCostUnavailable({ cost: 0, calls: 19, partial: true })).toBe(true);
    expect(formatLlmUsageCost({ cost: 0, calls: 19, partial: true })).toBe(LLM_USAGE_COST_UNAVAILABLE_CELL);

    // A LOWER BOUND: some call priced itself, so the sum is real but understated.
    expect(isLlmUsageCostUnavailable({ cost: 0.0123, calls: 19, partial: true })).toBe(false);
    expect(formatLlmUsageCost({ cost: 0.0123, calls: 19, partial: true })).toBe('>=$0.012300');

    // MEASURED: every call priced itself.
    expect(isLlmUsageCostUnavailable({ cost: 0.0123, calls: 19, partial: false })).toBe(false);
    expect(formatLlmUsageCost({ cost: 0.0123, calls: 19, partial: false })).toBe('$0.012300');

    // ZERO CALLS is an honest $0, never `n/a` — a never-called capability row and a tape replay both land here.
    expect(isLlmUsageCostUnavailable({ cost: 0, calls: 0, partial: true })).toBe(false);
    expect(formatLlmUsageCost({ cost: 0, calls: 0, partial: true })).toBe('$0.000000');
    expect(formatLlmUsageCost({ cost: 0, calls: 4, partial: false })).toBe('$0.000000');
  });

  it('honours the digits + boundMarker knobs', () => {
    expect(formatLlmUsageCost({ cost: 0.0123, calls: 2, partial: false, digits: 4 })).toBe('$0.0123');
    expect(formatLlmUsageCost({ cost: 0.0123, calls: 2, partial: true, digits: 4, boundMarker: '≥' })).toBe('≥$0.0123');
  });

  it('renders a LIST-priced sum as an UPPER bound, and a partial-and-listed one as neither bound', () => {
    // ZenMux's synchronous cost is the pre-discount list price: the bill is at most that.
    expect(formatLlmUsageCost({ cost: 0.03, calls: 40, partial: false, listed: true })).toBe('<=$0.030000');
    expect(formatLlmUsageCost({ cost: 0.03, calls: 40, partial: true, listed: true })).toBe('~$0.030000');
    expect(formatLlmUsageCost({ cost: 0.03, calls: 40, partial: false, listed: true, digits: 4, listedMarker: '≤' })).toBe('≤$0.0300');
    // A zero-call slice is exactly zero whatever the run's flags say.
    expect(formatLlmUsageCost({ cost: 0, calls: 0, partial: true, listed: true })).toBe('$0.000000');
    // Unknown still wins: nothing priced is `n/a`, listed or not.
    expect(formatLlmUsageCost({ cost: 0, calls: 3, partial: true, listed: true })).toBe(LLM_USAGE_COST_UNAVAILABLE_CELL);
  });

  it('resolveLlmUsageCostMarker decides the one marker every surface prints', () => {
    expect(resolveLlmUsageCostMarker({ calls: 2, partial: false })).toBe('');
    expect(resolveLlmUsageCostMarker({ calls: 2, partial: true })).toBe('>=');
    expect(resolveLlmUsageCostMarker({ calls: 2, partial: false, listed: true })).toBe('<=');
    expect(resolveLlmUsageCostMarker({ calls: 2, partial: true, listed: true })).toBe('~');
    expect(resolveLlmUsageCostMarker({ calls: 2, partial: false, listed: true }, { upper: '≤' })).toBe('≤');
    expect(resolveLlmUsageCostMarker({ calls: 0, partial: true, listed: true })).toBe('');
  });
});

describe('readLlmUsageCostFlags', () => {
  it('threads the listed flag when set', () => {
    expect(readLlmUsageCostFlags({ costPartial: false, costListed: true })).toEqual({ partial: false, listed: true });
  });

  it('omits the listed key entirely when it is not set', () => {
    const flags = readLlmUsageCostFlags({ costPartial: true });

    expect(flags).toEqual({ partial: true });
    expect(Object.keys(flags)).toEqual(['partial']);
  });
});
