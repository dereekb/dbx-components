/**
 * The quota gate + its aggregator — proves the ONE property the whole seam rests on: **it fails OPEN in every
 * ambiguous case.**
 *
 * That asymmetry is deliberate. A false REFUSAL blocks an operator from work they have already paid for, on the
 * word of a diagnostic; a false ALLOW costs one `402`, which is exactly the status quo this improves on. So an
 * unmetered backend, an unreadable account, a missing management key, and a window carrying no fraction must all
 * allow — and only a MEASURED fraction above the ceiling may refuse.
 *
 * Network-free: the aggregator reads a registry of hand-built strategies.
 */

import { describe, it, expect } from 'vitest';
import { makeLlmQuotaWindow, type LlmProviderStatus } from './llm.provider.status';
import { type LlmStrategy } from './llm.strategy';
import { evaluateLlmQuotaGate, parseLlmQuotaMaxUsed, readLlmProviderStatus, type LlmProviderStatusReport } from './llm.strategy.readiness';
import { makeLlmStrategyRegistry } from './llm.strategy.registry';

/**
 * Build a minimal strategy, optionally carrying a `providerStatus` that resolves the passed status.
 *
 * @param config - The id and the optional status to answer with (`throws` to violate the never-throw contract).
 * @returns The strategy.
 */
function strategyOf(config: { readonly id: string; readonly status?: LlmProviderStatus; readonly throws?: boolean }): LlmStrategy {
  const base = { id: config.id, describe: 'test', caching: 'none' as const, complete: async () => ({ text: '', strategyId: config.id, capability: 'summarize', schemaEnforced: false }) };
  return config.throws === true
    ? {
        ...base,
        providerStatus: async () => {
          throw new Error('boom');
        }
      }
    : config.status == null
      ? base
      : { ...base, providerStatus: async () => config.status as LlmProviderStatus };
}

/**
 * Build a one-entry report from a status.
 *
 * @param status - The status.
 * @returns The report.
 */
function reportOf(status: LlmProviderStatus): LlmProviderStatusReport {
  return { checked: [{ id: 'openai', metered: true, status }] };
}

/**
 * A status whose tightest window sits at the passed fraction.
 *
 * @param usedFraction - The fraction.
 * @returns The status.
 */
function spentTo(usedFraction: number): LlmProviderStatus {
  return { providerId: 'zenmux', available: true, windows: [makeLlmQuotaWindow({ id: 'rolling-7d', label: 'rolling 7 days', usedFraction, resetsAt: '2026-08-27T02:15:05.000Z' })], issues: [] };
}

describe('readLlmProviderStatus', () => {
  it('reports a strategy with NO providerStatus as unmetered rather than as a failure', async () => {
    const report = await readLlmProviderStatus({ strategies: makeLlmStrategyRegistry([strategyOf({ id: 'openai' })]), required: ['openai'] });
    expect(report.checked).toEqual([{ id: 'openai', metered: false }]);
  });

  it('reports an UNREGISTERED id as unmetered rather than throwing', async () => {
    const report = await readLlmProviderStatus({ strategies: makeLlmStrategyRegistry([]), required: ['openai'] });
    expect(report.checked).toEqual([{ id: 'openai', metered: false }]);
  });

  it('carries a status through when the strategy meters', async () => {
    const report = await readLlmProviderStatus({ strategies: makeLlmStrategyRegistry([strategyOf({ id: 'openai', status: spentTo(0.5) })]), required: ['openai'] });
    expect(report.checked[0]?.metered).toBe(true);
    expect(report.checked[0]?.status?.windows[0]?.usedFraction).toBe(0.5);
  });

  it('RECORDS a contract-violating throw as an unavailable status instead of propagating it', async () => {
    const report = await readLlmProviderStatus({ strategies: makeLlmStrategyRegistry([strategyOf({ id: 'openai', throws: true })]), required: ['openai'] });
    expect(report.checked[0]?.status?.available).toBe(false);
    expect(report.checked[0]?.status?.issues[0]?.message).toContain('providerStatus threw');
  });

  it('is a no-op for an empty required set', async () => {
    const report = await readLlmProviderStatus({ strategies: makeLlmStrategyRegistry([]), required: [] });
    expect(report.checked).toEqual([]);
  });

  it('reads ONE account ONCE when two instances share it, and names who is quoting whom', async () => {
    // The shipped `zenmux` / `zenmux-payg` pair: one gateway, one account, two inference keys. Both instances
    // must still appear — an operator who bound a slug to the PAYG one needs to see it — but the account behind
    // them has a single quota window, so asking it twice buys nothing and reporting it twice reads as two.
    let reads = 0;
    const account = (id: string): LlmStrategy => ({
      ...strategyOf({ id }),
      providerStatusId: 'zenmux',
      providerStatus: async () => {
        reads += 1;
        return spentTo(0.5);
      }
    });

    const report = await readLlmProviderStatus({ strategies: makeLlmStrategyRegistry([account('zenmux'), account('zenmux-payg')]), required: ['zenmux', 'zenmux-payg'] });

    expect(reads).toBe(1);
    expect(report.checked.map((entry) => entry.id)).toEqual(['zenmux', 'zenmux-payg']);
    expect(report.checked[0]?.sharedWithId).toBeUndefined();
    expect(report.checked[1]?.sharedWithId).toBe('zenmux');
    // Both still carry the numbers, so the gate's reduce needs no knowledge of the fold.
    expect(report.checked[1]?.status?.windows[0]?.usedFraction).toBe(0.5);
  });

  it('reads each account SEPARATELY when two instances meter different ones', async () => {
    let zenmuxReads = 0;
    let otherReads = 0;

    const report = await readLlmProviderStatus({
      strategies: makeLlmStrategyRegistry([
        {
          ...strategyOf({ id: 'zenmux' }),
          providerStatusId: 'zenmux',
          providerStatus: async () => {
            zenmuxReads += 1;
            return spentTo(0.5);
          }
        },
        {
          ...strategyOf({ id: 'gateway' }),
          providerStatusId: 'other',
          providerStatus: async () => {
            otherReads += 1;
            return spentTo(0.9);
          }
        }
      ]),
      required: ['zenmux', 'gateway']
    });

    expect([zenmuxReads, otherReads]).toEqual([1, 1]);
    expect(report.checked.every((entry) => entry.sharedWithId == null)).toBe(true);
  });

  it('does NOT fold two instances that expose no account id, because nothing says they are the same account', async () => {
    let reads = 0;
    const unlabelled = (id: string): LlmStrategy => ({
      ...strategyOf({ id }),
      providerStatus: async () => {
        reads += 1;
        return spentTo(0.5);
      }
    });

    await readLlmProviderStatus({ strategies: makeLlmStrategyRegistry([unlabelled('a'), unlabelled('b')]), required: ['a', 'b'] });

    // Folding on an ABSENT key would silently merge two genuinely different accounts, which is the one error
    // this whole mechanism must not make: it would hide a spent window behind a healthy one.
    expect(reads).toBe(2);
  });
});

describe('evaluateLlmQuotaGate', () => {
  it('REFUSES only above the ceiling', () => {
    expect(evaluateLlmQuotaGate({ report: reportOf(spentTo(0.95)) }).allowed).toBe(false);
    expect(evaluateLlmQuotaGate({ report: reportOf(spentTo(0.5)) }).allowed).toBe(true);
  });

  it('treats the ceiling itself as allowed (refuse strictly ABOVE)', () => {
    expect(evaluateLlmQuotaGate({ report: reportOf(spentTo(0.9)), maxUsedFraction: 0.9 }).allowed).toBe(true);
  });

  it('honours a custom ceiling', () => {
    expect(evaluateLlmQuotaGate({ report: reportOf(spentTo(0.6)), maxUsedFraction: 0.5 }).allowed).toBe(false);
  });

  it('names the window and its reset time in the refusal reason', () => {
    const verdict = evaluateLlmQuotaGate({ report: reportOf(spentTo(0.99)) });
    expect(verdict.reason).toContain('rolling 7 days');
    expect(verdict.reason).toContain('2026-08-27T02:15:05.000Z');
    expect(verdict.usedFraction).toBe(0.99);
  });

  it('FAILS OPEN for an unmetered backend', () => {
    const verdict = evaluateLlmQuotaGate({ report: { checked: [{ id: 'openai', metered: false }] } });
    expect(verdict).toEqual({ allowed: true, reason: '' });
  });

  it('FAILS OPEN for an UNAVAILABLE status: a missing management key is not evidence of a spent quota', () => {
    const unavailable: LlmProviderStatus = { providerId: 'zenmux', available: false, windows: [], issues: [{ severity: 'error', message: 'no ZenMux management key configured' }] };
    const verdict = evaluateLlmQuotaGate({ report: reportOf(unavailable) });
    expect(verdict.allowed).toBe(true);
    expect(verdict.usedFraction).toBeUndefined();
  });

  it('FAILS OPEN when the only window carries no fraction', () => {
    const ceilingOnly: LlmProviderStatus = { providerId: 'zenmux', available: true, windows: [makeLlmQuotaWindow({ id: 'monthly', label: 'monthly', maxUnits: 34560 })], issues: [] };
    expect(evaluateLlmQuotaGate({ report: reportOf(ceilingOnly) }).allowed).toBe(true);
  });

  it('FAILS OPEN for an empty report', () => {
    expect(evaluateLlmQuotaGate({ report: { checked: [] } }).allowed).toBe(true);
  });

  it('refuses on the TIGHTEST window across several providers', () => {
    const report: LlmProviderStatusReport = {
      checked: [
        { id: 'a', metered: true, status: spentTo(0.2) },
        { id: 'b', metered: true, status: spentTo(0.97) }
      ]
    };
    const verdict = evaluateLlmQuotaGate({ report });
    expect(verdict.allowed).toBe(false);
    expect(verdict.usedFraction).toBe(0.97);
  });
});

describe('parseLlmQuotaMaxUsed()', () => {
  it('should accept a 0–1 fraction', () => {
    expect(parseLlmQuotaMaxUsed('0.75')).toBe(0.75);
    expect(parseLlmQuotaMaxUsed('1')).toBe(1);
  });

  it('should REJECT a percent-shaped value, which would silently disable the gate it was meant to tighten', () => {
    expect(parseLlmQuotaMaxUsed('90')).toBeUndefined();
  });

  it('should reject a non-number, a negative, a zero, and an absent value', () => {
    expect(parseLlmQuotaMaxUsed('tight')).toBeUndefined();
    expect(parseLlmQuotaMaxUsed('-0.5')).toBeUndefined();
    expect(parseLlmQuotaMaxUsed('0')).toBeUndefined();
    expect(parseLlmQuotaMaxUsed(undefined)).toBeUndefined();
  });
});
