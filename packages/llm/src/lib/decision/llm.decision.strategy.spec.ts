import { describe, expect, it, vi } from 'vitest';
import { type LlmCredentialProbeOptions } from '../strategy/llm.strategy';
import { type LlmStrategyHealth } from '../strategy/llm.strategy.health';
import { probeLlmCredentials, verifyLlmStrategies } from '../strategy/llm.strategy.readiness';
import { llmStrategyKind, makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { DEFAULT_LLM_DECISION_TIMEOUT_MS, LLM_DECISION_STRATEGY_READINESS_LANE, LlmDecisionTransportError, type LlmDecisionStrategy, isRetryableLlmDecisionError } from './llm.decision.strategy';

/**
 * A do-nothing backend under one id / kind.
 *
 * @param id - The instance id.
 * @param kind - The transport kind; omitted ⇒ the id is also the kind.
 * @returns The strategy.
 */
function fake(id: string, kind?: string): LlmDecisionStrategy {
  return { id, ...(kind == null ? {} : { kind }), describe: `fake:${id}`, decide: async () => ({ model: 'm', answers: {} as never }) };
}

describe('makeLlmStrategyRegistry() over decision strategies', () => {
  it("should key by INSTANCE id and filter by TRANSPORT kind, the completion registry's own split", () => {
    const registry = makeLlmStrategyRegistry([fake('account-a', 'decisions-wire'), fake('account-b', 'decisions-wire')]);

    expect(registry.get('account-a')?.id).toBe('account-a');
    expect(registry.get('account-b')?.id).toBe('account-b');
    expect(registry.values().filter((strategy) => llmStrategyKind(strategy) === 'decisions-wire')).toHaveLength(2);
  });

  it('should answer the LAST registered instance by kind and the first configured by values()[0]', () => {
    const registry = makeLlmStrategyRegistry([fake('account-a', 'decisions-wire'), fake('account-b', 'decisions-wire')]);

    expect(registry.values().findLast((strategy) => llmStrategyKind(strategy) === 'decisions-wire')?.id).toBe('account-b');
    expect(registry.values()[0]?.id).toBe('account-a');
  });

  it("should default a kind-less strategy's transport to its id", () => {
    expect(llmStrategyKind(fake('solo'))).toBe('solo');
    expect(llmStrategyKind(fake('solo', 'wire'))).toBe('wire');
  });
});

describe('DEFAULT_LLM_DECISION_TIMEOUT_MS', () => {
  it('should give a decision ten seconds', () => {
    expect(DEFAULT_LLM_DECISION_TIMEOUT_MS).toBe(10_000);
  });
});

describe('LlmDecisionTransportError', () => {
  it('should carry its name, message, status and body', () => {
    const error = new LlmDecisionTransportError({ message: 'decision route answered 503', status: 503, body: 'busy' });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LlmDecisionTransportError');
    expect(error.message).toBe('decision route answered 503');
    expect(error.status).toBe(503);
    expect(error.body).toBe('busy');
  });
});

describe('isRetryableLlmDecisionError()', () => {
  it.each([429, 503])('should retry a %i transport error', (status) => {
    expect(isRetryableLlmDecisionError(new LlmDecisionTransportError({ message: 'x', status }))).toBe(true);
  });

  it('should retry a raw fetch socket failure', () => {
    expect(isRetryableLlmDecisionError(new TypeError('fetch failed'))).toBe(true);
  });

  it('should not retry a 400', () => {
    expect(isRetryableLlmDecisionError(new LlmDecisionTransportError({ message: 'x', status: 400 }))).toBe(false);
  });

  it.each(['AbortError', 'TimeoutError'])('should not retry a %s', (name) => {
    expect(isRetryableLlmDecisionError(new DOMException('stopped', name))).toBe(false);
  });
});

describe('LlmDecisionTransportError cause', () => {
  /**
   * A status-less transport failure wrapping the given cause.
   *
   * @param cause - The wrapped failure.
   * @returns The error.
   */
  function wrapped(cause: unknown): LlmDecisionTransportError {
    return new LlmDecisionTransportError({ message: 'the route could not be reached', cause });
  }

  it('should keep the wrapped failure as its cause', () => {
    const cause = new TypeError('fetch failed');
    expect(wrapped(cause).cause).toBe(cause);
  });

  it('should have no own cause property when none was given', () => {
    expect(Object.prototype.hasOwnProperty.call(new LlmDecisionTransportError({ message: 'x' }), 'cause')).toBe(false);
  });

  it('should retry a wrapped socket failure', () => {
    expect(isRetryableLlmDecisionError(wrapped(new TypeError('fetch failed')))).toBe(true);
    expect(isRetryableLlmDecisionError(wrapped({ cause: { code: 'ECONNRESET' } }))).toBe(true);
  });

  it('should not retry a wrapped DNS miss, an answered status, an abort cause or a cause-less error', () => {
    expect(isRetryableLlmDecisionError(wrapped(Object.assign(new Error('getaddrinfo ENOTFOUND zenmux.test'), { code: 'ENOTFOUND' })))).toBe(false);
    expect(isRetryableLlmDecisionError(new LlmDecisionTransportError({ message: 'refused', status: 400, cause: new TypeError('fetch failed') }))).toBe(false);
    expect(isRetryableLlmDecisionError(wrapped(new DOMException('stopped', 'AbortError')))).toBe(false);
    expect(isRetryableLlmDecisionError(new LlmDecisionTransportError({ message: 'x' }))).toBe(false);
  });
});

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

describe('decision readiness through the shared aggregators', () => {
  describe('verifyLlmStrategies()', () => {
    it('is a true no-op for an empty required set; touches no strategy', async () => {
      const healthCheck = vi.fn(async () => HEALTHY);
      const strategies = makeLlmStrategyRegistry([fakeDecisionStrategy('a', { healthCheck })]);

      const report = await verifyLlmStrategies({ strategies, required: [], lane: LLM_DECISION_STRATEGY_READINESS_LANE });

      expect(report).toEqual({ ready: true, checked: [] });
      expect(healthCheck).not.toHaveBeenCalled();
    });

    it('resolves a ready report (and invokes onReport) when every required decision strategy is healthy', async () => {
      const strategies = makeLlmStrategyRegistry([fakeDecisionStrategy('a', { healthCheck: async () => HEALTHY }), fakeDecisionStrategy('b', { healthCheck: async () => ({ ready: true, issues: [{ severity: 'warning', message: 'default model' }] }) })]);
      const onReport = vi.fn();

      const report = await verifyLlmStrategies({ strategies, required: ['a', 'b'], onReport, lane: LLM_DECISION_STRATEGY_READINESS_LANE });

      expect(report.ready).toBe(true);
      expect(report.checked.map((entry) => entry.id)).toEqual(['a', 'b']);
      expect(report.checked[1]?.health.issues[0]?.severity).toBe('warning');
      expect(onReport).toHaveBeenCalledWith(report);
    });

    it('throws one decision-worded error for a failing strategy; onReport saw the full report first', async () => {
      const strategies = makeLlmStrategyRegistry([fakeDecisionStrategy('a', { healthCheck: async () => FAILING })]);
      const onReport = vi.fn();

      await expect(verifyLlmStrategies({ strategies, required: ['a'], onReport, lane: LLM_DECISION_STRATEGY_READINESS_LANE })).rejects.toThrow('required LLM decision strategy is not ready:\n  - a: decision key missing');
      expect(onReport.mock.calls[0]?.[0]?.ready).toBe(false);
    });

    it('records a throwing healthCheck as an error issue instead of propagating it raw', async () => {
      const strategies = makeLlmStrategyRegistry([
        fakeDecisionStrategy('a', {
          healthCheck: async () => {
            throw new Error('kaboom');
          }
        })
      ]);
      const onReport = vi.fn();

      await expect(verifyLlmStrategies({ strategies, required: ['a'], onReport, lane: LLM_DECISION_STRATEGY_READINESS_LANE })).rejects.toThrow(/a: healthCheck threw: kaboom/);
      expect(onReport.mock.calls[0]?.[0]?.checked[0]).toEqual({ id: 'a', registered: true, health: { ready: false, issues: [{ severity: 'error', message: 'healthCheck threw: kaboom' }] } });
    });

    it('treats a decision strategy with no healthCheck as ready', async () => {
      const strategies = makeLlmStrategyRegistry([fakeDecisionStrategy('a')]);

      const report = await verifyLlmStrategies({ strategies, required: ['a'], lane: LLM_DECISION_STRATEGY_READINESS_LANE });

      expect(report).toEqual({ ready: true, checked: [{ id: 'a', registered: true, health: HEALTHY }] });
    });

    it('names an unregistered id as a missing decision strategy, and aggregates every failure into one error', async () => {
      const strategies = makeLlmStrategyRegistry([fakeDecisionStrategy('a', { healthCheck: async () => FAILING }), fakeDecisionStrategy('b', { healthCheck: async () => HEALTHY })]);

      const error = await verifyLlmStrategies({ strategies, required: ['a', 'b', 'gone'], lane: LLM_DECISION_STRATEGY_READINESS_LANE }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("required LLM decision strategies are not ready:\n  - a: decision key missing\n  - gone: no LLM decision strategy registered for 'gone'");
    });

    it('changes only the wording — a ready report matches the completion lane wording', async () => {
      const strategies = makeLlmStrategyRegistry([fakeDecisionStrategy('a', { healthCheck: async () => HEALTHY })]);

      const decision = await verifyLlmStrategies({ strategies, required: ['a'], lane: LLM_DECISION_STRATEGY_READINESS_LANE });
      const generic = await verifyLlmStrategies({ strategies, required: ['a'] });

      expect(decision).toEqual(generic);
    });
  });

  describe('probeLlmCredentials()', () => {
    it('is a true no-op for an empty required set; opens no socket', async () => {
      const credentialProbe = vi.fn(async () => HEALTHY);
      const strategies = makeLlmStrategyRegistry([fakeDecisionStrategy('a', { credentialProbe })]);

      const report = await probeLlmCredentials({ strategies, required: [], lane: LLM_DECISION_STRATEGY_READINESS_LANE });

      expect(report).toEqual({ ready: true, checked: [] });
      expect(credentialProbe).not.toHaveBeenCalled();
    });

    it('reports healthy, failing, throwing, probe-less and unregistered decision strategies without ever throwing', async () => {
      const strategies = makeLlmStrategyRegistry([
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

      const report = await probeLlmCredentials({ strategies, required: ['healthy', 'failing', 'throwing', 'no-probe', 'gone'], onReport, lane: LLM_DECISION_STRATEGY_READINESS_LANE });

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
      const strategies = makeLlmStrategyRegistry([fakeDecisionStrategy('a', { credentialProbe }), fakeDecisionStrategy('b', { credentialProbe })]);
      const controller = new AbortController();

      await probeLlmCredentials({ strategies, required: ['a', 'b'], signal: controller.signal, lane: LLM_DECISION_STRATEGY_READINESS_LANE });

      expect(credentialProbe).toHaveBeenCalledTimes(2);
      expect(credentialProbe.mock.calls.every(([options]) => options?.signal === controller.signal)).toBe(true);
    });
  });
});
