/**
 * The provider-neutral account-status vocabulary — proves the three rules a consumer of the metering seam leans
 * on: a used/max pair DERIVES the throttle fraction (and a degenerate maximum derives nothing rather than a
 * division artifact), the "tightest" window is the max over KNOWN fractions with unknowns skipped, and an
 * unavailable status renders as an explicit no-information line rather than a zero.
 *
 * All pure — no seams needed.
 */

import { describe, it, expect } from 'vitest';
import { formatLlmProviderStatusLines, makeLlmQuotaWindow, tightestLlmQuotaWindow, type LlmProviderStatus } from './llm.provider.status';

/**
 * Build a status carrying the passed windows, with no balance and no issues.
 *
 * @param windows - The windows.
 * @returns The status.
 */
function statusOf(windows: LlmProviderStatus['windows']): LlmProviderStatus {
  return { providerId: 'zenmux', available: windows.length > 0, windows, issues: [] };
}

describe('makeLlmQuotaWindow', () => {
  it('derives usedFraction from a used/max pair', () => {
    const window = makeLlmQuotaWindow({ id: 'rolling-5h', label: 'rolling 5 hours', usedUnits: 200, maxUnits: 800 });
    expect(window.usedFraction).toBe(0.25);
  });

  it('prefers a provider-reported usedFraction over the derivable one', () => {
    // The provider's own percentage is authoritative — it may apply holdbacks the raw pair does not show.
    const window = makeLlmQuotaWindow({ id: 'rolling-5h', label: 'rolling 5 hours', usedFraction: 0.4, usedUnits: 200, maxUnits: 800 });
    expect(window.usedFraction).toBe(0.4);
  });

  it('derives NOTHING from a zero maximum, so a mid-rollover window cannot present as spent', () => {
    const window = makeLlmQuotaWindow({ id: 'monthly', label: 'monthly', usedUnits: 0, maxUnits: 0 });
    expect(window.usedFraction).toBeUndefined();
  });

  it('derives nothing when the provider reported only a ceiling', () => {
    const window = makeLlmQuotaWindow({ id: 'monthly', label: 'monthly', maxUnits: 34560 });
    expect(window.usedFraction).toBeUndefined();
  });
});

describe('tightestLlmQuotaWindow', () => {
  it('returns the window closest to exhaustion, not the first', () => {
    const status = statusOf([makeLlmQuotaWindow({ id: 'rolling-5h', label: '5h', usedFraction: 0.1 }), makeLlmQuotaWindow({ id: 'rolling-7d', label: '7d', usedFraction: 0.93 })]);
    expect(tightestLlmQuotaWindow(status)?.id).toBe('rolling-7d');
  });

  it('SKIPS a window carrying no fraction: unknown is not zero, and not a candidate either', () => {
    const status = statusOf([makeLlmQuotaWindow({ id: 'monthly', label: 'monthly', maxUnits: 34560 }), makeLlmQuotaWindow({ id: 'rolling-5h', label: '5h', usedFraction: 0.5 })]);
    expect(tightestLlmQuotaWindow(status)?.id).toBe('rolling-5h');
  });

  it('returns undefined when no window carries a fraction', () => {
    expect(tightestLlmQuotaWindow(statusOf([makeLlmQuotaWindow({ id: 'monthly', label: 'monthly', maxUnits: 1 })]))).toBeUndefined();
  });

  it('returns undefined for a status with no windows at all', () => {
    expect(tightestLlmQuotaWindow(statusOf([]))).toBeUndefined();
  });
});

describe('formatLlmProviderStatusLines', () => {
  it('renders a window with its percentage, units, USD and reset time', () => {
    const status = statusOf([makeLlmQuotaWindow({ id: 'rolling-5h', label: 'rolling 5 hours', usedFraction: 0.0715, usedUnits: 57.2, maxUnits: 800, unit: 'flow', usedUsd: 1.88, maxUsd: 26.27, resetsAt: '2026-08-25T08:35:09.000Z' })]);
    const lines = formatLlmProviderStatusLines(status);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('rolling 5 hours: 7.1% used (57.2/800 flow) ≈ $1.88/$26.27, resets 2026-08-25T08:35:09.000Z');
  });

  it('renders a balance with its provenance parts', () => {
    const status: LlmProviderStatus = {
      providerId: 'zenmux',
      available: true,
      windows: [],
      balance: {
        currency: 'usd',
        total: 482.74,
        parts: [
          { label: 'top-up', amount: 35 },
          { label: 'bonus', amount: 447.74 }
        ]
      },
      issues: []
    };
    expect(formatLlmProviderStatusLines(status)).toEqual(['balance: 482.74 usd (top-up 35, bonus 447.74)']);
  });

  it('says explicitly that nothing is known for an unavailable status, and never implies zero usage', () => {
    const status: LlmProviderStatus = { providerId: 'zenmux', available: false, windows: [], issues: [{ severity: 'error', message: 'no ZenMux management key configured' }] };
    const lines = formatLlmProviderStatusLines(status);
    expect(lines[0]).toBe('zenmux: no account usage available');
    expect(lines[1]).toBe('[error] no ZenMux management key configured');
    expect(lines.join('\n')).not.toContain('0.0%');
  });
});
