import { describe, expect, it } from 'vitest';
import { llmStrategyKind } from '../strategy/llm.strategy.registry';
import { DEFAULT_LLM_DECISION_TIMEOUT_MS, LlmDecisionTransportError, type LlmDecisionStrategy, isRetryableLlmDecisionError, makeLlmDecisionStrategyRegistry } from './llm.decision.strategy';

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

describe('makeLlmDecisionStrategyRegistry()', () => {
  it("should index by INSTANCE id and by TRANSPORT kind, the completion registry's own split", () => {
    const registry = makeLlmDecisionStrategyRegistry([fake('account-a', 'decisions-wire'), fake('account-b', 'decisions-wire')]);

    expect(registry.get('account-a')?.id).toBe('account-a');
    expect(registry.get('account-b')?.id).toBe('account-b');
    expect(registry.getBy('kind', 'decisions-wire')).toBeDefined();
  });

  it('should answer the LAST registered instance by kind and the first configured by values()[0]', () => {
    const registry = makeLlmDecisionStrategyRegistry([fake('account-a', 'decisions-wire'), fake('account-b', 'decisions-wire')]);

    expect(registry.getBy('kind', 'decisions-wire')?.id).toBe('account-b');
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
