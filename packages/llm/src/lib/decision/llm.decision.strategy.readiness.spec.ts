/**
 * The decision lane's readiness aggregators — proves `verifyLlmDecisionStrategies` and `probeLlmDecisionCredentials`
 * run the completion aggregators' per-strategy verdict logic over an `LlmDecisionStrategyRegistry`: a healthy
 * strategy is ready, a failing one blocks (verify throws, probe reports), a throwing one is caught and recorded, one
 * without the seam is ready, an unregistered id is not — and every synthesized issue and error names a DECISION
 * strategy. Tiny fake decision strategies only; no network.
 */

import { describe, expect, it, vi } from 'vitest';
import { type LlmCredentialProbeOptions } from '../strategy/llm.strategy';
import { type LlmStrategyHealth } from '../strategy/llm.strategy.health';
import { verifyLlmStrategies } from '../strategy/llm.strategy.readiness';
import { type LlmDecisionStrategy, makeLlmDecisionStrategyRegistry } from './llm.decision.strategy';
import { LLM_DECISION_STRATEGY_READINESS_LANE, probeLlmDecisionCredentials, verifyLlmDecisionStrategies } from './llm.decision.strategy.readiness';

/**
 * The readiness seams one fake decision strategy declares.
 */
interface FakeDecisionStrategySeams {
  readonly healthCheck?: () => Promise<LlmStrategyHealth>;
  readonly credentialProbe?: (options?: LlmCredentialProbeOptions) => Promise<LlmStrategyHealth>;
}

/**
 * Build a tiny fake {@link LlmDecisionStrategy} — `decide` is an unused stub (the aggregators never call it); only
 * the seams it is given are declared, so a missing seam is genuinely absent.
 *
 * @param id - The strategy id.
 * @param seams - The readiness seams to declare.
 * @returns The fake strategy.
 */
function fakeDecisionStrategy(id: string, seams: FakeDecisionStrategySeams = {}): LlmDecisionStrategy {
  return { id, describe: `fake:${id}`, decide: async () => ({ model: 'm', answers: {} as never }), ...seams };
}

const HEALTHY: LlmStrategyHealth = { ready: true, issues: [] };
const FAILING: LlmStrategyHealth = { ready: false, issues: [{ severity: 'error', message: 'decision key missing' }] };

describe('verifyLlmDecisionStrategies', () => {
  it('is a true no-op for an empty required set; touches no strategy', async () => {
    const healthCheck = vi.fn(async () => HEALTHY);
    const strategies = makeLlmDecisionStrategyRegistry([fakeDecisionStrategy('a', { healthCheck })]);

    const report = await verifyLlmDecisionStrategies({ strategies, required: [] });

    expect(report).toEqual({ ready: true, checked: [] });
    expect(healthCheck).not.toHaveBeenCalled();
  });

  it('resolves a ready report (and invokes onReport) when every required decision strategy is healthy', async () => {
    const strategies = makeLlmDecisionStrategyRegistry([fakeDecisionStrategy('a', { healthCheck: async () => HEALTHY }), fakeDecisionStrategy('b', { healthCheck: async () => ({ ready: true, issues: [{ severity: 'warning', message: 'default model' }] }) })]);
    const onReport = vi.fn();

    const report = await verifyLlmDecisionStrategies({ strategies, required: ['a', 'b'], onReport });

    expect(report.ready).toBe(true);
    expect(report.checked.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(report.checked[1]?.health.issues[0]?.severity).toBe('warning');
    expect(onReport).toHaveBeenCalledWith(report);
  });

  it('throws one decision-worded error for a failing strategy; onReport saw the full report first', async () => {
    const strategies = makeLlmDecisionStrategyRegistry([fakeDecisionStrategy('a', { healthCheck: async () => FAILING })]);
    const onReport = vi.fn();

    await expect(verifyLlmDecisionStrategies({ strategies, required: ['a'], onReport })).rejects.toThrow('required LLM decision strategy is not ready:\n  - a: decision key missing');
    expect(onReport.mock.calls[0]?.[0]?.ready).toBe(false);
  });

  it('records a throwing healthCheck as an error issue instead of propagating it raw', async () => {
    const strategies = makeLlmDecisionStrategyRegistry([
      fakeDecisionStrategy('a', {
        healthCheck: async () => {
          throw new Error('kaboom');
        }
      })
    ]);
    const onReport = vi.fn();

    await expect(verifyLlmDecisionStrategies({ strategies, required: ['a'], onReport })).rejects.toThrow(/a: healthCheck threw: kaboom/);
    expect(onReport.mock.calls[0]?.[0]?.checked[0]).toEqual({ id: 'a', registered: true, health: { ready: false, issues: [{ severity: 'error', message: 'healthCheck threw: kaboom' }] } });
  });

  it('treats a decision strategy with no healthCheck as ready', async () => {
    const strategies = makeLlmDecisionStrategyRegistry([fakeDecisionStrategy('a')]);

    const report = await verifyLlmDecisionStrategies({ strategies, required: ['a'] });

    expect(report).toEqual({ ready: true, checked: [{ id: 'a', registered: true, health: HEALTHY }] });
  });

  it('names an unregistered id as a missing decision strategy, and aggregates every failure into one error', async () => {
    const strategies = makeLlmDecisionStrategyRegistry([fakeDecisionStrategy('a', { healthCheck: async () => FAILING }), fakeDecisionStrategy('b', { healthCheck: async () => HEALTHY })]);

    const error = await verifyLlmDecisionStrategies({ strategies, required: ['a', 'b', 'gone'] }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("required LLM decision strategies are not ready:\n  - a: decision key missing\n  - gone: no LLM decision strategy registered for 'gone'");
  });

  it('is the completion aggregator with the decision wording — the reports match apart from the wording', async () => {
    const strategies = makeLlmDecisionStrategyRegistry([fakeDecisionStrategy('a', { healthCheck: async () => HEALTHY })]);

    const decision = await verifyLlmDecisionStrategies({ strategies, required: ['a'] });
    const generic = await verifyLlmStrategies({ strategies, required: ['a'], lane: LLM_DECISION_STRATEGY_READINESS_LANE });

    expect(decision).toEqual(generic);
  });
});

describe('probeLlmDecisionCredentials', () => {
  it('is a true no-op for an empty required set; opens no socket', async () => {
    const credentialProbe = vi.fn(async () => HEALTHY);
    const strategies = makeLlmDecisionStrategyRegistry([fakeDecisionStrategy('a', { credentialProbe })]);

    const report = await probeLlmDecisionCredentials({ strategies, required: [] });

    expect(report).toEqual({ ready: true, checked: [] });
    expect(credentialProbe).not.toHaveBeenCalled();
  });

  it('reports healthy, failing, throwing, probe-less and unregistered decision strategies without ever throwing', async () => {
    const strategies = makeLlmDecisionStrategyRegistry([
      fakeDecisionStrategy('healthy', { credentialProbe: async () => HEALTHY }),
      fakeDecisionStrategy('failing', { credentialProbe: async () => FAILING }),
      fakeDecisionStrategy('throwing', {
        credentialProbe: async () => {
          throw new Error('socket hang up');
        }
      }),
      // A healthCheck alone must not stand in for the missing credential probe.
      fakeDecisionStrategy('no-probe', { healthCheck: async () => FAILING })
    ]);
    const onReport = vi.fn();

    const report = await probeLlmDecisionCredentials({ strategies, required: ['healthy', 'failing', 'throwing', 'no-probe', 'gone'], onReport });

    expect(report.ready).toBe(false);
    expect(report.checked).toEqual([
      { id: 'healthy', registered: true, health: HEALTHY },
      { id: 'failing', registered: true, health: FAILING },
      { id: 'throwing', registered: true, health: { ready: false, issues: [{ severity: 'error', message: 'credentialProbe threw: socket hang up' }] } },
      { id: 'no-probe', registered: true, health: HEALTHY },
      { id: 'gone', registered: false, health: { ready: false, issues: [{ severity: 'error', message: "no LLM decision strategy registered for 'gone'" }] } }
    ]);
    expect(onReport).toHaveBeenCalledWith(report);
  });

  it('threads the external cancellation signal to every probe', async () => {
    const credentialProbe = vi.fn(async (_options?: LlmCredentialProbeOptions) => HEALTHY);
    const strategies = makeLlmDecisionStrategyRegistry([fakeDecisionStrategy('a', { credentialProbe }), fakeDecisionStrategy('b', { credentialProbe })]);
    const controller = new AbortController();

    await probeLlmDecisionCredentials({ strategies, required: ['a', 'b'], signal: controller.signal });

    expect(credentialProbe).toHaveBeenCalledTimes(2);
    expect(credentialProbe.mock.calls.every(([options]) => options?.signal === controller.signal)).toBe(true);
  });
});
