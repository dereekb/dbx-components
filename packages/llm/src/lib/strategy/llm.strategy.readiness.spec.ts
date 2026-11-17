/**
 * The readiness aggregators — proves `verifyLlmStrategies` is the single loud-failure channel: an empty required set
 * is a true no-op (no strategy touched), all-ready resolves a report (with `onReport` invoked), and any
 * unready/unregistered/throwing required strategy makes it throw ONE aggregated error naming every failing id — while
 * a `ready:true` strategy carrying only a warning, or one with no `healthCheck`, never trips the gate. And proves
 * `probeLlmCredentials` reports the same shape for the live-credential seam without ever throwing. Tiny fake
 * strategies only.
 */

import { describe, it, expect, vi } from 'vitest';
import { type LlmStrategy } from './llm.strategy';
import { type LlmStrategyHealth } from './llm.strategy.health';
import { llmCredentialReportErrorText, probeLlmCredentials, verifyLlmStrategies } from './llm.strategy.readiness';
import { makeLlmStrategyRegistry } from './llm.strategy.registry';

/**
 * Build a tiny fake {@link LlmStrategy} — `complete` is an unused stub (the aggregator never calls it); an
 * optional `healthCheck` drives the readiness path under test.
 *
 * @param id - The strategy id.
 * @param healthCheck - The optional readiness probe.
 * @returns The fake strategy.
 */
function fakeStrategy(id: string, healthCheck?: () => Promise<LlmStrategyHealth>): LlmStrategy {
  return {
    id,
    describe: `fake ${id}`,
    caching: 'none',
    complete: async (request) => ({ text: '', strategyId: id, capability: request.capability }),
    ...(healthCheck == null ? {} : { healthCheck })
  };
}

/**
 * Build a tiny fake {@link LlmStrategy} carrying only a {@link LlmStrategy.credentialProbe} — the live-credential
 * aggregator's subject. Its `healthCheck` is deliberately ABSENT, so a spec cannot pass by accident through the
 * other seam.
 *
 * @param id - The strategy id.
 * @param credentialProbe - The credential probe.
 * @returns The fake strategy.
 */
function fakeProbeStrategy(id: string, credentialProbe: () => Promise<LlmStrategyHealth>): LlmStrategy {
  return { id, describe: `fake ${id}`, caching: 'none', complete: async (request) => ({ text: '', strategyId: id, capability: request.capability }), credentialProbe };
}

describe('verifyLlmStrategies', () => {
  it('is a true no-op for an empty required set; touches no strategy, resolves an empty ready report', async () => {
    const probe = vi.fn(async (): Promise<LlmStrategyHealth> => ({ ready: true, issues: [] }));
    const strategies = makeLlmStrategyRegistry([fakeStrategy('a', probe)]);

    const report = await verifyLlmStrategies({ strategies, required: [] });

    expect(report).toEqual({ ready: true, checked: [] });
    expect(probe).not.toHaveBeenCalled();
  });

  it('resolves a ready report (and invokes onReport) when every required strategy is ready', async () => {
    const strategies = makeLlmStrategyRegistry([fakeStrategy('a', async () => ({ ready: true, issues: [] })), fakeStrategy('b', async () => ({ ready: true, issues: [] }))]);
    const onReport = vi.fn();

    const report = await verifyLlmStrategies({ strategies, required: ['a', 'b'], onReport });

    expect(report.ready).toBe(true);
    expect(report.checked).toHaveLength(2);
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport).toHaveBeenCalledWith(report);
  });

  it('throws (naming the id + its error) when a required strategy is not ready; onReport saw the full report first', async () => {
    const strategies = makeLlmStrategyRegistry([fakeStrategy('a', async () => ({ ready: false, issues: [{ severity: 'error', message: 'boom' }] }))]);
    const onReport = vi.fn();

    await expect(verifyLlmStrategies({ strategies, required: ['a'], onReport })).rejects.toThrow(/a: boom/);
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport.mock.calls[0]?.[0]?.ready).toBe(false);
  });

  it('throws when a required id is not registered', async () => {
    const strategies = makeLlmStrategyRegistry([fakeStrategy('a', async () => ({ ready: true, issues: [] }))]);

    await expect(verifyLlmStrategies({ strategies, required: ['ghost'] })).rejects.toThrow(/no LLM strategy registered for 'ghost'/);
  });

  it('does NOT throw for a ready strategy that carries only a warning; onReport carries the warning', async () => {
    const strategies = makeLlmStrategyRegistry([fakeStrategy('a', async () => ({ ready: true, issues: [{ severity: 'warning', message: 'using default model' }] }))]);
    const onReport = vi.fn();

    const report = await verifyLlmStrategies({ strategies, required: ['a'], onReport });

    expect(report.ready).toBe(true);
    expect(report.checked[0]?.health.issues).toEqual([{ severity: 'warning', message: 'using default model' }]);
    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it('treats a required strategy with no healthCheck as ready', async () => {
    const strategies = makeLlmStrategyRegistry([fakeStrategy('a')]);

    const report = await verifyLlmStrategies({ strategies, required: ['a'] });

    expect(report.ready).toBe(true);
    expect(report.checked[0]).toEqual({ id: 'a', registered: true, health: { ready: true, issues: [] } });
  });

  it('catches a contract-violating healthCheck throw and aggregates it (never propagates raw)', async () => {
    const strategies = makeLlmStrategyRegistry([
      fakeStrategy('a', async () => {
        throw new Error('kaboom');
      })
    ]);

    await expect(verifyLlmStrategies({ strategies, required: ['a'] })).rejects.toThrow(/a: healthCheck threw: kaboom/);
  });

  it('calls each seam as a method, so a class-based strategy keeps its `this`', async () => {
    class ClassStrategy {
      readonly id = 'a';
      readonly describe = 'class a';
      readonly caching = 'none' as const;
      private readonly verdict: LlmStrategyHealth = { ready: false, issues: [{ severity: 'error', message: 'from this' }] };

      async complete(): Promise<never> {
        throw new Error('unused');
      }

      async healthCheck(): Promise<LlmStrategyHealth> {
        return this.verdict;
      }

      async credentialProbe(): Promise<LlmStrategyHealth> {
        return this.verdict;
      }
    }

    const strategies = makeLlmStrategyRegistry([new ClassStrategy()]);

    await expect(verifyLlmStrategies({ strategies, required: ['a'] })).rejects.toThrow('required LLM strategy is not ready:\n  - a: from this');
    expect((await probeLlmCredentials({ strategies, required: ['a'] })).checked[0]?.health.issues[0]?.message).toBe('from this');
  });

  it('aggregates EVERY unready required strategy into one error', async () => {
    const strategies = makeLlmStrategyRegistry([fakeStrategy('a', async () => ({ ready: false, issues: [{ severity: 'error', message: 'aerr' }] })), fakeStrategy('b', async () => ({ ready: false, issues: [{ severity: 'error', message: 'berr' }] }))]);

    let message = '';

    try {
      await verifyLlmStrategies({ strategies, required: ['a', 'b'] });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('a: aerr');
    expect(message).toContain('b: berr');
  });
});

describe('probeLlmCredentials', () => {
  it('is a true no-op for an empty required set; touches no strategy, opens no socket', async () => {
    const probe = vi.fn(async (): Promise<LlmStrategyHealth> => ({ ready: true, issues: [] }));
    const strategies = makeLlmStrategyRegistry([fakeProbeStrategy('a', probe)]);

    const report = await probeLlmCredentials({ strategies, required: [] });

    expect(report).toEqual({ ready: true, checked: [] });
    expect(probe).not.toHaveBeenCalled();
  });

  it('resolves a ready report (and invokes onReport) when every probed credential is live', async () => {
    const strategies = makeLlmStrategyRegistry([fakeProbeStrategy('a', async () => ({ ready: true, issues: [] }))]);
    const onReport = vi.fn();

    const report = await probeLlmCredentials({ strategies, required: ['a'], onReport });

    expect(report.ready).toBe(true);
    expect(onReport).toHaveBeenCalledWith(report);
  });

  it('reports an unready credential WITHOUT throwing (the gate decides, not the probe)', async () => {
    const strategies = makeLlmStrategyRegistry([fakeProbeStrategy('openrouter', async () => ({ ready: false, issues: [{ severity: 'error', message: 'rejected the configured credential: HTTP 401: User not found.' }] }))]);

    const report = await probeLlmCredentials({ strategies, required: ['openrouter'] });

    expect(report.ready).toBe(false);
    expect(llmCredentialReportErrorText(report)).toContain('User not found.');
  });

  it('treats a strategy with no credentialProbe as ready (the seam is opt-in)', async () => {
    const strategies = makeLlmStrategyRegistry([fakeStrategy('a')]);

    const report = await probeLlmCredentials({ strategies, required: ['a'] });

    expect(report.ready).toBe(true);
    expect(report.checked[0]).toEqual({ id: 'a', registered: true, health: { ready: true, issues: [] } });
  });

  it('reports an unregistered id as unready', async () => {
    const report = await probeLlmCredentials({ strategies: makeLlmStrategyRegistry([]), required: ['ghost'] });

    expect(report.ready).toBe(false);
    expect(llmCredentialReportErrorText(report)).toContain(`no LLM strategy registered for 'ghost'`);
  });

  it('catches a contract-violating probe throw and records it (never propagates raw)', async () => {
    const strategies = makeLlmStrategyRegistry([
      fakeProbeStrategy('a', async () => {
        throw new Error('kaboom');
      })
    ]);

    const report = await probeLlmCredentials({ strategies, required: ['a'] });

    expect(report.ready).toBe(false);
    expect(llmCredentialReportErrorText(report)).toContain('credentialProbe threw: kaboom');
  });

  it('threads the external cancellation signal to every probe', async () => {
    const seen: Array<AbortSignal | undefined> = [];
    const strategies = makeLlmStrategyRegistry([
      {
        id: 'a',
        describe: 'fake a',
        caching: 'none',
        complete: async (request) => ({ text: '', strategyId: 'a', capability: request.capability }),
        credentialProbe: async (options) => {
          seen.push(options?.signal);
          return { ready: true, issues: [] };
        }
      }
    ]);
    const controller = new AbortController();

    await probeLlmCredentials({ strategies, required: ['a'], signal: controller.signal });

    expect(seen).toEqual([controller.signal]);
  });
});

describe('llmCredentialReportErrorText', () => {
  it('renders nothing for a ready report and joins every error for an unready one', () => {
    expect(llmCredentialReportErrorText({ ready: true, checked: [{ id: 'a', registered: true, health: { ready: true, issues: [{ severity: 'warning', message: 'advisory' }] } }] })).toBe('');
    expect(
      llmCredentialReportErrorText({
        ready: false,
        checked: [
          {
            id: 'a',
            registered: true,
            health: {
              ready: false,
              issues: [
                { severity: 'error', message: 'aerr' },
                { severity: 'warning', message: 'noise' }
              ]
            }
          },
          { id: 'b', registered: true, health: { ready: false, issues: [{ severity: 'error', message: 'berr' }] } }
        ]
      })
    ).toBe('a: aerr; b: berr');
  });
});
