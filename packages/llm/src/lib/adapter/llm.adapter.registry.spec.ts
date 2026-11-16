import { describe, expect, it } from 'vitest';
import { makeLlmModelConfigSchema } from '../model/config/llm.model.config.schema';
import { type LlmCompletionAdapter, type LlmDecisionAdapter, type LlmMeteringAdapter, LLM_ADAPTER_FACETS } from './llm.adapter';
import { llmAdapterKey, llmAdapterKindsOf, llmAdapterOf, llmAdaptersOf, llmModelConfigListsOf, makeLlmAdapterRegistry, resolveLlmAdapter } from './llm.adapter.registry';

function notCalled(): never {
  throw new Error('not called');
}

function completionAdapter(kind: string): LlmCompletionAdapter {
  return { facet: 'completion', kind, make: notCalled };
}

function decisionAdapter(kind: string, strategyKind: string): LlmDecisionAdapter {
  return { facet: 'decision', kind, strategyKind, make: notCalled };
}

function meteringAdapter(kind: string): LlmMeteringAdapter {
  return { facet: 'metering', kind, make: notCalled };
}

const OPENAI = completionAdapter('openai');
const OPENROUTER = completionAdapter('openrouter');
const ZENMUX_DECISION = decisionAdapter('zenmux', 'zenmux-decisions');
const OPENROUTER_DECISION = decisionAdapter('openrouter', 'openrouter-decisions');
const ZENMUX_METERING = meteringAdapter('zenmux');

describe('llmAdapterKey()', () => {
  it('should key an adapter by facet and kind', () => {
    expect(llmAdapterKey({ facet: 'completion', kind: 'openai' })).toBe('completion:openai');
  });

  it('should list the five facets', () => {
    expect(LLM_ADAPTER_FACETS).toEqual(['completion', 'decision', 'metering', 'bill', 'credentialProbe']);
  });
});

describe('makeLlmAdapterRegistry()', () => {
  it('should hold every facet in one registry, and one kind under two facets', () => {
    const adapters = makeLlmAdapterRegistry([OPENAI, OPENROUTER, ZENMUX_DECISION, ZENMUX_METERING]);

    expect(adapters.size).toBe(4);
    expect(llmAdapterOf({ adapters, facet: 'completion', kind: 'openai' })).toBe(OPENAI);
    expect(llmAdapterOf({ adapters, facet: 'decision', kind: 'zenmux' })).toBe(ZENMUX_DECISION);
    expect(llmAdapterOf({ adapters, facet: 'metering', kind: 'zenmux' })).toBe(ZENMUX_METERING);
  });

  it('should find nothing for an unknown kind or a kind registered only under another facet', () => {
    const adapters = makeLlmAdapterRegistry([OPENAI, ZENMUX_METERING]);

    expect(llmAdapterOf({ adapters, facet: 'completion', kind: 'vllm' })).toBeUndefined();
    expect(llmAdapterOf({ adapters, facet: 'completion', kind: 'zenmux' })).toBeUndefined();
  });

  it('should throw on a second adapter for one facet and kind, and ignore a same-instance re-register', () => {
    const adapters = makeLlmAdapterRegistry([OPENAI]);

    expect(() => adapters.register(completionAdapter('openai'))).toThrow("a completion adapter is already registered for 'openai'; register each facet and kind once.");
    expect(adapters.register(OPENAI)).toBe(false);
    expect(adapters.size).toBe(1);
  });
});

describe('resolveLlmAdapter()', () => {
  const adapters = makeLlmAdapterRegistry([OPENAI, OPENROUTER, ZENMUX_METERING]);

  it('should return the registered adapter', () => {
    expect(resolveLlmAdapter({ adapters, facet: 'completion', kind: 'openrouter' })).toBe(OPENROUTER);
  });

  it('should throw naming the registered kinds of the facet', () => {
    expect(() => resolveLlmAdapter({ adapters, facet: 'completion', kind: 'vllm' })).toThrow("no completion adapter is registered for 'vllm' (registered: openai, openrouter).");
    expect(() => resolveLlmAdapter({ adapters, facet: 'completion', kind: 'vllm', label: "provider 'box'" })).toThrow("provider 'box': no completion adapter is registered for 'vllm' (registered: openai, openrouter).");
    expect(() => resolveLlmAdapter({ adapters, facet: 'decision', kind: 'zenmux' })).toThrow("no decision adapter is registered for 'zenmux' (registered: none).");
  });
});

describe('llmAdaptersOf()', () => {
  it('should list one facet in registration order', () => {
    const adapters = makeLlmAdapterRegistry([OPENROUTER, ZENMUX_DECISION, OPENAI, OPENROUTER_DECISION]);

    expect(llmAdaptersOf({ adapters, facet: 'completion' })).toEqual([OPENROUTER, OPENAI]);
    expect(llmAdapterKindsOf({ adapters, facet: 'decision' })).toEqual(['zenmux', 'openrouter']);
    expect(llmAdapterKindsOf({ adapters, facet: 'bill' })).toEqual([]);
  });
});

describe('llmModelConfigListsOf()', () => {
  it('should give the model config schema its transports, meterings and decision routes', () => {
    const adapters = makeLlmAdapterRegistry([OPENAI, OPENROUTER, ZENMUX_METERING, ZENMUX_DECISION, OPENROUTER_DECISION]);
    const lists = llmModelConfigListsOf(adapters);

    expect(lists).toEqual({ transports: ['openai', 'openrouter'], meterings: ['zenmux'], decisionRoutes: ['zenmux', 'openrouter'] });

    const schema = makeLlmModelConfigSchema({ ...lists });
    expect(schema.meterings).toEqual(['zenmux', 'none']);
    expect(schema.decisionRoutes).toEqual(['zenmux', 'openrouter', 'none']);
    expect(schema.defaultTransport).toBe('openai');
  });

  it('should give no transports without completion adapters, which the schema refuses', () => {
    const lists = llmModelConfigListsOf(makeLlmAdapterRegistry([ZENMUX_METERING]));

    expect(lists.transports).toEqual([]);
    expect(() => makeLlmModelConfigSchema({ ...lists })).toThrow(/needs at least one transport/);
  });
});
