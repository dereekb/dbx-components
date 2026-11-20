import { describe, expect, it } from 'vitest';
import { LLM_REASONING_OFF, resolveLlmCapabilityVision, resolveLlmCapabilityModel, resolveLlmCapabilityOutputControls, resolveLlmCapabilityProvider } from './llm.model.precedence';
import { DEFAULT_LLM_MODEL_TIER, type LlmModelTierMap } from './llm.model.tier';

const FAST = 'vendor/model-fast';
const STRONG = 'vendor/model-strong';

/**
 * Plain slugs only, so the default tier carries no output controls of its own.
 */
const TIERS: LlmModelTierMap = { fast: FAST, strong: STRONG };

/**
 * A tier map carrying a RICH tier config (its own cap and reasoning), so the tier rung of both output ladders is
 * reachable.
 */
const RICH_TIERS: LlmModelTierMap = { ...TIERS, deliberate: { model: 'vendor/deliberate', maxOutputTokens: 2048, reasoning: { enabled: true, effort: 'low' } } };

const BASE = { tiers: TIERS, defaultTier: DEFAULT_LLM_MODEL_TIER };

describe('resolveLlmCapabilityModel()', () => {
  it('should fall through to the default tier when nothing configures the capability', () => {
    expect(resolveLlmCapabilityModel(BASE)).toEqual({ model: FAST, tier: 'fast', source: 'default-tier' });
  });

  it('should attribute a descriptor tier', () => {
    expect(resolveLlmCapabilityModel({ ...BASE, descriptor: { tier: 'strong' } })).toEqual({ model: STRONG, tier: 'strong', source: 'descriptor-tier' });
  });

  it('should attribute a descriptor slug above its tier, carrying no tier key', () => {
    expect(resolveLlmCapabilityModel({ ...BASE, descriptor: { tier: 'strong', model: 'vendor/one-off' } })).toEqual({ model: 'vendor/one-off', source: 'descriptor-model' });
  });

  it('should let a compiled host route win over the descriptor', () => {
    expect(resolveLlmCapabilityModel({ ...BASE, descriptor: { tier: 'strong' }, route: { model: 'vendor/dialog', tier: 'dialog' } })).toEqual({ model: 'vendor/dialog', tier: 'dialog', source: 'route' });
  });

  it('should let a per-call tier win over a route, and a per-call slug win over everything', () => {
    const byTier = resolveLlmCapabilityModel({ ...BASE, override: { tier: 'strong' }, descriptor: { model: 'vendor/one-off' }, route: { model: 'vendor/dialog' } });
    expect(byTier).toEqual({ model: STRONG, tier: 'strong', source: 'request-tier' });

    const bySlug = resolveLlmCapabilityModel({ ...BASE, override: { model: 'vendor/pinned', tier: 'strong' }, route: { model: 'vendor/dialog' } });
    expect(bySlug).toEqual({ model: 'vendor/pinned', source: 'request-model' });
  });

  it('should fail loud on an unknown tier key, including a default tier no rung would have read', () => {
    expect(() => resolveLlmCapabilityModel({ ...BASE, descriptor: { tier: 'nope' } })).toThrow(/unknown model tier 'nope'/);
    expect(() => resolveLlmCapabilityModel({ override: { model: 'vendor/pinned' }, tiers: TIERS, defaultTier: 'nope' })).toThrow(/unknown model tier 'nope'/);
  });
});

describe('resolveLlmCapabilityOutputControls()', () => {
  it('should resolve to the reasoning floor with no cap when nothing configures either', () => {
    const resolved = resolveLlmCapabilityOutputControls({ tier: DEFAULT_LLM_MODEL_TIER, tiers: TIERS, reasoningDefault: LLM_REASONING_OFF });
    expect(resolved).toEqual({ reasoning: LLM_REASONING_OFF, reasoningSource: 'default' });
    expect(resolved).not.toHaveProperty('maxOutputTokens');
    expect(resolved).not.toHaveProperty('maxOutputTokensSource');
  });

  it('should attribute a descriptor cap', () => {
    const resolved = resolveLlmCapabilityOutputControls({ descriptor: { maxOutputTokens: 32_768 }, tier: 'strong', tiers: TIERS, reasoningDefault: LLM_REASONING_OFF });
    expect(resolved.maxOutputTokens).toBe(32_768);
    expect(resolved.maxOutputTokensSource).toBe('descriptor');
  });

  it("should read the resolved tier's own cap and reasoning when neither the route nor the descriptor declares one", () => {
    const resolved = resolveLlmCapabilityOutputControls({ tier: 'deliberate', tiers: RICH_TIERS, reasoningDefault: LLM_REASONING_OFF });
    expect(resolved).toEqual({ maxOutputTokens: 2048, maxOutputTokensSource: 'tier', reasoning: { enabled: true, effort: 'low' }, reasoningSource: 'tier' });
  });

  it('should let a host route out-rank the descriptor, and a per-call reasoning out-rank the route', () => {
    const routed = resolveLlmCapabilityOutputControls({ descriptor: { maxOutputTokens: 100, reasoning: { enabled: false } }, route: { model: 'vendor/x', maxOutputTokens: 900, reasoning: { enabled: true } }, tier: DEFAULT_LLM_MODEL_TIER, tiers: TIERS, reasoningDefault: LLM_REASONING_OFF });
    expect(routed).toEqual({ maxOutputTokens: 900, maxOutputTokensSource: 'route', reasoning: { enabled: true }, reasoningSource: 'route' });

    const requested = resolveLlmCapabilityOutputControls({ route: { model: 'vendor/x', reasoning: { enabled: true } }, requestReasoning: { enabled: true, effort: 'high' }, tier: DEFAULT_LLM_MODEL_TIER, tiers: TIERS, reasoningDefault: LLM_REASONING_OFF });
    expect(requested.reasoning).toEqual({ enabled: true, effort: 'high' });
    expect(requested.reasoningSource).toBe('request');
  });

  it('should read no tier config for a raw-slug resolution, but still honour the descriptor', () => {
    const resolved = resolveLlmCapabilityOutputControls({ descriptor: { maxOutputTokens: 512 }, tier: undefined, tiers: RICH_TIERS, reasoningDefault: LLM_REASONING_OFF });
    expect(resolved).toEqual({ maxOutputTokens: 512, maxOutputTokensSource: 'descriptor', reasoning: LLM_REASONING_OFF, reasoningSource: 'default' });
  });

  it('should use a host floor other than OFF as the bottom rung', () => {
    expect(LLM_REASONING_OFF).toEqual({ enabled: false });

    const resolved = resolveLlmCapabilityOutputControls({ tier: DEFAULT_LLM_MODEL_TIER, tiers: TIERS, reasoningDefault: { effort: 'medium' } });
    expect(resolved).toEqual({ reasoning: { effort: 'medium' }, reasoningSource: 'default' });
  });
});

describe('resolveLlmCapabilityVision()', () => {
  const base = { ...BASE, descriptor: { tier: 'strong' } };

  it('should read the tier path, an override, and no map as not-vision', () => {
    expect(resolveLlmCapabilityVision(base)).toEqual({ model: STRONG, vision: false, source: 'descriptor-tier' });
    expect(resolveLlmCapabilityVision({ ...base, visionByModel: { [STRONG]: true } })).toMatchObject({ model: STRONG, vision: true });
    expect(resolveLlmCapabilityVision({ ...base, override: { model: 'vendor/eyes' }, visionByModel: { 'vendor/eyes': true } })).toEqual({ model: 'vendor/eyes', vision: true, source: 'request-model' });
  });

  it('should check vision on the routed slug when a route wins', () => {
    const route = { model: 'vendor/blind' };
    expect(resolveLlmCapabilityVision({ ...base, route, visionByModel: { [STRONG]: true } })).toEqual({ model: 'vendor/blind', vision: false, source: 'route' });
    expect(resolveLlmCapabilityVision({ ...base, route, visionByModel: { 'vendor/blind': true } })).toMatchObject({ vision: true });
  });
});

describe('resolveLlmCapabilityProvider()', () => {
  const bindings = { [FAST]: 'zenmux-payg' };

  it("should let the route's provider win over a binding and the default", () => {
    expect(resolveLlmCapabilityProvider({ route: { provider: 'local' }, model: FAST, bindings, defaultProvider: 'openrouter' })).toEqual({ provider: 'local', source: 'route' });
  });

  it("should fall to the slug's binding when the route names no provider or there is no route", () => {
    expect(resolveLlmCapabilityProvider({ route: {}, model: FAST, bindings, defaultProvider: 'openrouter' })).toEqual({ provider: 'zenmux-payg', source: 'model-binding' });
    expect(resolveLlmCapabilityProvider({ model: FAST, bindings, defaultProvider: 'openrouter' })).toEqual({ provider: 'zenmux-payg', source: 'model-binding' });
  });

  it('should fall to the default provider when neither applies', () => {
    expect(resolveLlmCapabilityProvider({ model: FAST, defaultProvider: 'openrouter' })).toEqual({ provider: 'openrouter', source: 'default' });
  });

  it('should read the binding for the slug passed', () => {
    expect(resolveLlmCapabilityProvider({ model: FAST, bindings: { 'vendor/free': 'zenmux-payg' }, defaultProvider: 'openrouter' })).toEqual({ provider: 'openrouter', source: 'default' });
  });
});
