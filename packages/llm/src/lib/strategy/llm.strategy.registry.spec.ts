/**
 * The strategy registry — `id` is the primary key, `kind` a last-wins secondary index that falls back to a remaining
 * instance when its holder leaves, and `llmStrategyInstancesOfKind` answers "all of them" in registry order.
 */

import { describe, it, expect } from 'vitest';
import { type LlmDecisionStrategy, type LlmDecisionStrategyRegistry } from '../decision/llm.decision.strategy';
import { type LlmCompletion, type LlmRequest, type LlmStrategy } from './llm.strategy';
import { llmStrategyInstancesOfKind, llmStrategyKind, makeLlmStrategyRegistry } from './llm.strategy.registry';

/**
 * Build a tiny fake {@link LlmStrategy}; `complete` echoes the prompt.
 *
 * @param id - The instance id.
 * @param kind - The optional transport kind.
 * @returns The fake strategy.
 */
function fakeStrategy(id: string, kind?: string): LlmStrategy {
  return {
    id,
    ...(kind == null ? {} : { kind }),
    describe: `fake ${id}`,
    caching: 'none',
    complete: async (request) => ({ text: request.prompt, strategyId: id, capability: request.capability })
  };
}

describe('makeLlmStrategyRegistry', () => {
  it('reads a strategy by its id', () => {
    const a = fakeStrategy('a');
    const strategies = makeLlmStrategyRegistry([a]);

    expect(strategies.get('a')).toBe(a);
    expect(strategies.get('missing')).toBeUndefined();
  });

  it('answers the LAST registered instance of a kind with llmStrategyInstancesOfKind(...).at(-1)', () => {
    const local = fakeStrategy('local', 'openai');
    const gateway = fakeStrategy('gateway', 'openai');
    const strategies = makeLlmStrategyRegistry([local, gateway]);

    expect(llmStrategyInstancesOfKind({ strategies, kind: 'openai' }).at(-1)).toBe(gateway);
  });

  it('matches a kind-less strategy by its id', () => {
    const openrouter = fakeStrategy('openrouter');
    const strategies = makeLlmStrategyRegistry([openrouter]);

    expect(llmStrategyInstancesOfKind({ strategies, kind: 'openrouter' })).toEqual([openrouter]);
  });

  it('replaces a re-registered id in place, keeping its position', () => {
    const a = fakeStrategy('a');
    const b = fakeStrategy('b');
    const a2 = fakeStrategy('a');
    const strategies = makeLlmStrategyRegistry([a, b]);

    expect(strategies.register(a2)).toBe(false);
    expect(strategies.keys()).toEqual(['a', 'b']);
    expect(strategies.get('a')).toBe(a2);
  });

  it('leaves the remaining instance of a kind when one is unregistered', () => {
    const local = fakeStrategy('local', 'openai');
    const gateway = fakeStrategy('gateway', 'openai');
    const strategies = makeLlmStrategyRegistry([local, gateway]);

    strategies.unregister('gateway');
    expect(llmStrategyInstancesOfKind({ strategies, kind: 'openai' }).at(-1)).toBe(local);
  });

  it('carries host meta from the request onto the completion', async () => {
    interface HostRequest extends LlmRequest {
      readonly meta?: { readonly tenant: string };
    }

    const echo: LlmStrategy = {
      id: 'echo',
      describe: 'Echoes the prompt and meta',
      caching: 'none',
      complete: async (request) => ({ text: request.prompt, strategyId: 'echo', capability: request.capability, ...(request.meta == null ? {} : { meta: request.meta }) })
    };
    const strategies = makeLlmStrategyRegistry([echo]);
    const request: HostRequest = { prompt: 'hello', capability: 'summarize', meta: { tenant: 't-1' } };
    const completion: LlmCompletion = await (strategies.get('echo') as LlmStrategy).complete(request);

    expect(completion.text).toBe('hello');
    expect(completion.meta).toEqual({ tenant: 't-1' });
  });
});

describe('llmStrategyKind', () => {
  it('reads the declared kind, else the id', () => {
    expect(llmStrategyKind(fakeStrategy('local', 'openai'))).toBe('openai');
    expect(llmStrategyKind(fakeStrategy('openrouter'))).toBe('openrouter');
  });
});

describe('llmStrategyInstancesOfKind', () => {
  it('returns every instance of the kind in registry order', () => {
    const local = fakeStrategy('local', 'openai');
    const openrouter = fakeStrategy('openrouter');
    const gateway = fakeStrategy('gateway', 'openai');
    const strategies = makeLlmStrategyRegistry([local, openrouter, gateway]);

    expect(llmStrategyInstancesOfKind({ strategies, kind: 'openai' })).toEqual([local, gateway]);
  });

  it('returns an empty list for an unknown kind', () => {
    const strategies = makeLlmStrategyRegistry([fakeStrategy('a')]);
    expect(llmStrategyInstancesOfKind({ strategies, kind: 'nope' })).toEqual([]);
  });
});

describe('makeLlmStrategyRegistry() over the decision lane', () => {
  it('infers a decision registry from a decision seed, and llmStrategyInstancesOfKind reads it', () => {
    const decisionStrategy = (id: string): LlmDecisionStrategy => ({ id, kind: 'decisions-wire', describe: id, decide: async () => ({ model: 'm', answers: {} as never }) });
    const strategies: LlmDecisionStrategyRegistry = makeLlmStrategyRegistry([decisionStrategy('a'), decisionStrategy('b')]);
    const instances: ReadonlyArray<LlmDecisionStrategy> = llmStrategyInstancesOfKind({ strategies, kind: 'decisions-wire' });

    expect(instances.map((strategy) => strategy.id)).toEqual(['a', 'b']);
    expect(typeof strategies.get('a')?.decide).toBe('function');
  });
});
