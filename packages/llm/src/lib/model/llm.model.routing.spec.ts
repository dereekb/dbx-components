import { describe, expect, it } from 'vitest';
import { compileLlmModelRouting, type CompileLlmModelRoutingConfig, LLM_MODEL_ROUTING_RULE_FIELD_RULES, LLM_MODEL_ROUTING_RULE_KEYS, type LlmModelRoutingConfig, parseLlmModelRoutingConfig } from './llm.model.routing';
import { type LlmModelRoutingCapabilityRef } from './llm.capability.rule';
import { type LlmModelTierMap } from './llm.model.tier';

const TIERS: LlmModelTierMap = { fast: 'vendor/model-fast', strong: 'vendor/model-strong', chat: { model: 'vendor/model-chat', maxOutputTokens: 2048 } };

const CAPABILITIES: ReadonlyArray<LlmModelRoutingCapabilityRef> = [{ capability: 'support-reply', tags: ['support'] }, { capability: 'support-triage', tags: ['support'] }, { capability: 'summarize-report', tags: ['report'] }, { capability: 'classify-intent', tags: ['classify'] }, { capability: 'plan-steps' }];

function compile(routing: LlmModelRoutingConfig, extra?: Partial<CompileLlmModelRoutingConfig>) {
  return compileLlmModelRouting({ routing, capabilities: CAPABILITIES, tiers: TIERS, ...extra });
}

describe('compileLlmModelRouting()', () => {
  it('should compile an empty or rule-less block to an empty map', () => {
    expect(compile({}).size).toBe(0);
    expect(compile({ rules: [] }).size).toBe(0);
  });

  it('should route every capability carrying a tag, resolving the tier and keeping its key', () => {
    const routes = compile({ rules: [{ tags: ['support'], tier: 'chat' }] });

    expect(routes.size).toBe(2);
    // The tier's own 2048 cap is NOT copied onto the route; the output-control ladder reads it from the tier.
    expect(routes.get('support-reply')).toEqual({ model: 'vendor/model-chat', tier: 'chat' });
    expect(routes.get('support-triage')).toEqual({ model: 'vendor/model-chat', tier: 'chat' });
    expect(routes.get('summarize-report')).toBeUndefined();
  });

  it('should let a capability-key rule beat a tag rule regardless of array order', () => {
    const routes = compile({
      rules: [
        { tags: ['support'], tier: 'chat' },
        { capabilities: ['support-reply'], model: 'vendor/reply-only' }
      ]
    });

    expect(routes.get('support-reply')).toEqual({ model: 'vendor/reply-only' });
    expect(routes.get('support-triage')).toEqual({ model: 'vendor/model-chat', tier: 'chat' });
  });

  it('should let the FIRST matching rule win within the tag level', () => {
    const routes = compile({
      rules: [
        { tags: ['support'], tier: 'fast' },
        { tags: ['support'], tier: 'strong' }
      ]
    });

    expect(routes.get('support-reply')).toEqual({ model: 'vendor/model-fast', tier: 'fast' });
  });

  it('should let a raw model win over a tier on one rule and carry the rule output controls', () => {
    const routes = compile({ rules: [{ capabilities: ['plan-steps'], model: 'vendor/raw', tier: 'strong', maxOutputTokens: 9000, reasoning: { effort: 'low' } }] });

    expect(routes.get('plan-steps')).toEqual({ model: 'vendor/raw', maxOutputTokens: 9000, reasoning: { effort: 'low' } });
  });

  it('should fail loud on an unknown capability key', () => {
    expect(() => compile({ rules: [{ capabilities: ['ghost-cap'], tier: 'fast' }] })).toThrow(/unknown capability 'ghost-cap'/);
  });

  it('should fail loud on a tag no capability carries', () => {
    expect(() => compile({ rules: [{ tags: ['ghost'], tier: 'fast' }] })).toThrow(/no capability carries the tag 'ghost'/);
  });

  it('should fail loud on an unknown tier key at compile time', () => {
    expect(() => compile({ rules: [{ tags: ['support'], tier: 'ghost' }] })).toThrow(/unknown model tier 'ghost'/);
  });

  it('should fail loud on a target-less or route-less rule', () => {
    expect(() => compile({ rules: [{ tier: 'fast' }] })).toThrow(/declares no target/);
    expect(() => compile({ rules: [{ tags: ['support'] }] })).toThrow(/declares no route/);
  });

  it('should carry a rule provider onto the route when the provider set lists it', () => {
    const routes = compile({ rules: [{ tags: ['support'], tier: 'fast', provider: 'local' }] }, { providers: ['local', 'zenmux'] });

    expect(routes.get('support-reply')).toEqual({ model: 'vendor/model-fast', tier: 'fast', provider: 'local' });
  });

  it('should fail loud on a provider the provider set does not list', () => {
    expect(() => compile({ rules: [{ tags: ['support'], tier: 'fast', provider: 'ghost' }] }, { providers: ['local', 'zenmux'] })).toThrow("llm model routing rule #1: unknown provider 'ghost' (have: local, zenmux).");
  });

  it('should reject every provider when the provider set is empty, and skip the check when it is omitted', () => {
    expect(() => compile({ rules: [{ tags: ['support'], tier: 'fast', provider: 'local' }] }, { providers: [] })).toThrow(/unknown provider 'local' \(have: none\)/);

    const routes = compile({ rules: [{ tags: ['support'], tier: 'fast', provider: 'local' }] });
    expect(routes.get('support-reply')?.provider).toBe('local');
  });

  it('should prefix its messages with the configured label', () => {
    const routing: LlmModelRoutingConfig = {
      rules: [{ tags: ['support'], tier: 'fast' }, { tags: ['report'] }]
    };

    expect(() => compile(routing, { label: 'my-app routing' })).toThrow("my-app routing rule #2: declares no route; set 'tier' or 'model'.");
  });
});

describe('parseLlmModelRoutingConfig()', () => {
  function parseRouting(raw: unknown) {
    return parseLlmModelRoutingConfig({ raw, source: 'models.json routing' });
  }

  it('round-trips a good block in canonical key order, and the result compiles', () => {
    const raw = {
      rules: [
        { reasoning: { enabled: false }, maxOutputTokens: 900, tier: ' chat ', tags: ['support'] },
        { model: 'vendor/x', capabilities: ['plan-steps'], provider: 'local' }
      ],
      defaultTier: ' strong ',
      tiers: { chat: 'vendor/model-chat' }
    };
    const routing = parseRouting(raw);

    expect(routing).toEqual({
      tiers: { chat: 'vendor/model-chat' },
      defaultTier: 'strong',
      rules: [
        { tags: ['support'], tier: 'chat', maxOutputTokens: 900, reasoning: { enabled: false } },
        { capabilities: ['plan-steps'], model: 'vendor/x', provider: 'local' }
      ]
    });
    expect(Object.keys(routing.rules?.[0] ?? {})).toEqual(['tags', 'tier', 'maxOutputTokens', 'reasoning']);
    expect(compile({ rules: routing.rules }, { providers: ['local'] }).get('support-reply')).toEqual({ model: 'vendor/model-chat', tier: 'chat', maxOutputTokens: 900, reasoning: { enabled: false } });
  });

  it('FAILS LOUD on a rule field of the wrong shape, naming the rule and field', () => {
    expect(() => parseRouting({ rules: [{ tags: 'support', tier: 'chat' }] })).toThrow(`llm model routing: models.json routing rules[0].tags must be an array of capability tags (got "support").`);
    expect(() => parseRouting({ rules: [{ tags: ['support'], tier: 'chat', maxOutputTokens: '9000' }] })).toThrow(`llm model routing: models.json routing rules[0].maxOutputTokens must be a positive integer (got "9000").`);
    expect(() => parseRouting({ rules: [{ tags: ['support'], model: 'vendor/x', maxOutputTokens: 1.5 }] })).toThrow(/rules\[0\]\.maxOutputTokens must be a positive integer \(got 1\.5\)/);
    expect(() => parseRouting({ rules: [{}, { tags: ['support'], tier: 'chat', reasoning: { effort: 'max' } }] })).toThrow(`llm model routing: models.json routing rules[1].reasoning.effort must be one of low, medium, high (got "max").`);
    expect(() => parseRouting({ rules: [{ tags: ['support'], tier: 'chat', reasoning: 'high' }] })).toThrow(/rules\[0\]\.reasoning must be an object \(got "high"\)/);
  });

  it('FAILS LOUD on unknown keys, a non-array rules list, a bad tier value and a blank default tier', () => {
    expect(() => parseRouting({ rules: [{ tag: ['support'] }] })).toThrow(`llm model routing: models.json routing rules[0] has unknown key 'tag' (allowed: capabilities, tags, model, tier, provider, maxOutputTokens, reasoning).`);
    expect(() => parseRouting({ rule: [] })).toThrow(`llm model routing: models.json routing has unknown key 'rule' (allowed: tiers, defaultTier, rules).`);
    expect(() => parseRouting({ rules: { tags: ['support'] } })).toThrow(/models\.json routing\.rules must be an array of routing rules/);
    expect(() => parseRouting({ rules: ['support'] })).toThrow(/models\.json routing rules\[0\] must be a JSON object/);
    expect(() => parseRouting({ tiers: { chat: 7 } })).toThrow(`llm model routing: models.json routing.tiers['chat'] must be a non-empty, trimmed model slug or a { model, maxOutputTokens?, reasoning? } object (got 7).`);
    expect(() => parseRouting({ defaultTier: ' ' })).toThrow(`llm model routing: models.json routing.defaultTier must be a non-blank tier key (got " ").`);
    expect(() => parseRouting([])).toThrow(/models\.json routing must be a JSON object/);
  });

  it('has a rule for every rule key, in key order', () => {
    expect(Object.keys(LLM_MODEL_ROUTING_RULE_FIELD_RULES)).toEqual([...LLM_MODEL_ROUTING_RULE_KEYS]);
  });
});
