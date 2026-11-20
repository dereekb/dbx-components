import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { defineLlmCapability, type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { type LlmCompiledModelRouting } from '../model/llm.model.routing';
import { makeLlmCallContext, type LlmCallDiagRecord } from '../record/llm.call.context';
import { type LlmStrategy } from '../strategy/llm.strategy';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { llmDispatchStrategySelectorOf, type LlmDispatchResolveSetup, resolveLlmDispatch } from './llm.dispatch.resolve';
import { type LlmDispatchStrategySelector } from './llm.dispatcher.config';

function strategy(id: string): LlmStrategy {
  return { id, describe: id, caching: 'none', complete: () => Promise.reject(new Error('not called')) };
}

const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = {
  StrongCap: defineLlmCapability({ capability: 'StrongCap', tier: 'strong', responseSchema: type({ a: 'string' }), parseLever: (lever) => lever })
};

function setupOf(extra: Partial<LlmDispatchResolveSetup> = {}): LlmDispatchResolveSetup {
  return {
    strategies: makeLlmStrategyRegistry([strategy('a'), strategy('b')]),
    selectStrategy: llmDispatchStrategySelectorOf({ defaultStrategyId: 'a' }),
    descriptorOf: (capability) => DESCRIPTORS[capability],
    modelTiers: { fast: 'x/fast', strong: 'x/strong' },
    defaultTier: 'fast',
    defaultMaxOutputTokens: 1024,
    reasoningDefault: { enabled: false },
    ...extra
  };
}

function request(extra: Partial<LlmDispatchRequest> = {}): LlmDispatchRequest {
  return { capability: 'TestCap', renderLiveContext: () => [], ...extra };
}

function recordingContext() {
  const diags: LlmCallDiagRecord[] = [];
  const callContext = makeLlmCallContext({ label: 'cap', onDiag: (record) => diags.push(record) });
  return { diags, callContext };
}

describe('resolveLlmDispatch()', () => {
  it('should resolve the concrete slug for the default tier and a named tier alike', () => {
    const { callContext } = recordingContext();
    const fast = resolveLlmDispatch({ setup: setupOf(), request: request(), callContext });
    const strong = resolveLlmDispatch({ setup: setupOf(), request: request({ capability: 'StrongCap' }), callContext });

    expect(fast).toMatchObject({ resolvedModel: 'x/fast', tier: 'fast', modelSource: 'default-tier', strategyId: 'a' });
    expect('model' in fast).toBe(false);
    expect(strong).toMatchObject({ resolvedModel: 'x/strong', tier: 'strong', modelSource: 'descriptor-tier' });
    expect('model' in strong).toBe(false);
  });

  it('should resolve the cap by route › descriptor › tier, else the setup default', () => {
    const { callContext } = recordingContext();
    const tiers = { fast: { model: 'x/fast', maxOutputTokens: 2048 }, strong: 'x/strong' };
    const routes: LlmCompiledModelRouting = new Map([['Routed', { model: 'x/route', maxOutputTokens: 4096 }]]);
    const capped = { ...DESCRIPTORS, Capped: defineLlmCapability({ capability: 'Capped', tier: 'strong', maxOutputTokens: 3000, responseSchema: type({ a: 'string' }), parseLever: (lever) => lever }) };

    expect(resolveLlmDispatch({ setup: setupOf(), request: request(), callContext }).maxOutputTokens).toBe(1024);
    expect(resolveLlmDispatch({ setup: setupOf(), request: request({ capability: 'StrongCap' }), callContext }).maxOutputTokens).toBe(1024);
    expect(resolveLlmDispatch({ setup: setupOf({ modelTiers: tiers }), request: request(), callContext }).maxOutputTokens).toBe(2048);
    expect(resolveLlmDispatch({ setup: setupOf({ descriptorOf: (capability) => capped[capability] }), request: request({ capability: 'Capped' }), callContext }).maxOutputTokens).toBe(3000);
    expect(resolveLlmDispatch({ setup: setupOf({ capabilityRoutes: routes }), request: request({ capability: 'Routed' }), callContext }).maxOutputTokens).toBe(4096);
  });

  it('should pick the provider by route › per-slug binding › default', () => {
    const { callContext } = recordingContext();
    const routes: LlmCompiledModelRouting = new Map([['Routed', { model: 'x/route', provider: 'b' }]]);
    const selectStrategy = llmDispatchStrategySelectorOf({ defaultStrategyId: 'a', providerByModel: { 'x/strong': 'b' } });

    expect(resolveLlmDispatch({ setup: setupOf({ capabilityRoutes: routes }), request: request({ capability: 'Routed' }), callContext }).strategyId).toBe('b');
    expect(resolveLlmDispatch({ setup: setupOf({ selectStrategy }), request: request({ capability: 'StrongCap' }), callContext }).strategyId).toBe('b');
    expect(resolveLlmDispatch({ setup: setupOf({ selectStrategy }), request: request(), callContext }).strategyId).toBe('a');
  });

  it('should let a host selectStrategy REPLACE the default policy, seeing the request', () => {
    const { callContext } = recordingContext();
    const seen: unknown[] = [];
    const host: LlmDispatchStrategySelector = (selection) => (seen.push(selection.request), 'b');
    const selectStrategy = llmDispatchStrategySelectorOf({ selectStrategy: host, defaultStrategyId: 'a', providerByModel: { 'x/fast': 'a' } });
    const r = request();

    expect(resolveLlmDispatch({ setup: setupOf({ selectStrategy }), request: r, callContext }).strategyId).toBe('b');
    expect(seen).toEqual([r]);
  });

  it('should fail loud naming the registered strategies', () => {
    const { callContext } = recordingContext();

    expect(() => resolveLlmDispatch({ setup: setupOf({ selectStrategy: () => 'missing' }), request: request(), callContext })).toThrow("llm dispatcher: no LLM strategy registered for 'missing' (routing TestCap on model 'x/fast'; registered: a, b).");
    expect(() => resolveLlmDispatch({ setup: setupOf({ strategies: makeLlmStrategyRegistry([]) }), request: request(), callContext })).toThrow(/registered: none\)\.$/);
  });

  it('should file the model-route, provider-route and reasoning-floor breadcrumbs with their once keys', () => {
    const { diags, callContext } = recordingContext();
    resolveLlmDispatch({ setup: setupOf(), request: request(), callContext });

    expect(diags.map((diag) => [diag.code, diag.once])).toEqual([
      ['model-route', 'model-route:TestCap'],
      ['provider-route', 'provider-route:TestCap:x/fast'],
      ['reasoning-floor', 'reasoning-floor:TestCap']
    ]);
  });

  it('should file no reasoning-floor breadcrumb when reasoning resolves on', () => {
    const { diags, callContext } = recordingContext();
    const resolved = resolveLlmDispatch({ setup: setupOf(), request: request({ reasoning: { enabled: true } }), callContext });

    expect(resolved.reasoning).toEqual({ enabled: true });
    expect(diags.map((diag) => diag.code)).not.toContain('reasoning-floor');
  });
});
