import { describe, expect, it } from 'vitest';
import { assertLlmModelProviderBindings, mergeLlmModelConfigFiles, overlayLlmModelConfigFile } from './llm.model.config.merge';
import { flattenLlmModelProfile, parseLlmModelConfigFile } from './llm.model.config.parse';
import { llmModelReasoningOffEncodings, resolveLlmModelProfile } from './llm.model.config.resolve';
import { type LlmModelConfigFile, makeLlmModelConfigSchema } from './llm.model.config.schema';

const schema = makeLlmModelConfigSchema({
  transports: ['openai', 'openrouter'],
  meterings: ['zenmux'],
  decisionRoutes: ['zenmux', 'openrouter'],
  implicitProviders: ['openai', 'openrouter'],
  retiredKeys: { profile: new Map([['credential', 'a profile no longer names a credential; bind the slug to a provider instead (models[<slug>].provider).']]) }
});

const FREE_MODEL = 'z-ai/glm-5.3-free';
const GATEWAY_URL = 'https://gateway.example.com/api/v1';

/**
 * A host's built-in model config: two providers on one gateway with different key vars, four profiles, one bound
 * slug, and no `active` (availability is not adoption).
 */
const BASE: LlmModelConfigFile = {
  providers: {
    gateway: { transport: 'openai', baseUrl: GATEWAY_URL, apiKeyEnv: 'GATEWAY_API_KEY', metering: 'zenmux', decision: 'zenmux' },
    'gateway-payg': { transport: 'openai', baseUrl: GATEWAY_URL, apiKeyEnv: 'GATEWAY_PAYG_API_KEY', metering: 'zenmux', decision: 'zenmux' }
  },
  profiles: {
    baseline: { tiers: { fast: 'vendor/model-fast', strong: 'vendor/model-fast' } },
    balanced: { tiers: { fast: 'vendor/model-fast', strong: 'vendor/model-strong' } },
    free: { tiers: { fast: FREE_MODEL, strong: FREE_MODEL } },
    'free-wide': { tiers: { fast: { model: FREE_MODEL, maxOutputTokens: 8_192, reasoning: { effort: 'low' } }, strong: { model: FREE_MODEL, maxOutputTokens: 16_384 } } }
  },
  models: {
    [FREE_MODEL]: { provider: 'gateway-payg', reasoningOff: 'effort-minimal' }
  }
};

function overlay(file?: LlmModelConfigFile, source?: string) {
  return overlayLlmModelConfigFile({ base: BASE, file, source, schema });
}

describe('the base config', () => {
  it('round-trips through flattenLlmModelProfile and the parse unchanged', () => {
    const raw = { ...BASE, profiles: Object.fromEntries(Object.entries(BASE.profiles ?? {}).map(([name, profile]) => [name, flattenLlmModelProfile(profile)])) };
    expect(parseLlmModelConfigFile({ raw, source: 'base', schema })).toEqual(BASE);
  });

  it('selects nothing by itself', () => {
    expect(resolveLlmModelProfile({ file: overlay(undefined), schema })).toBeUndefined();
  });
});

describe('overlayLlmModelConfigFile()', () => {
  it('makes a base profile nameable with no file at all', () => {
    const resolved = resolveLlmModelProfile({ file: overlay(undefined), override: 'free', schema });
    expect(resolved?.profileName).toBe('free');
    expect(resolved?.selectedBy).toBe('override');
  });

  it("lets the host's file select a base profile with its own `active`", () => {
    const resolved = resolveLlmModelProfile({ file: overlay({ active: 'baseline' }), schema });
    expect(resolved?.profileName).toBe('baseline');
    expect(resolved?.selectedBy).toBe('file');
  });

  it('shadows a base profile WHOLESALE rather than merging into it', () => {
    const shadowed = overlay({ profiles: { free: { tiers: { fast: 'vendor/mine' } } } });
    expect(shadowed.profiles?.['free']).toEqual({ tiers: { fast: 'vendor/mine' } });
    expect(shadowed.profiles?.['free-wide']).toEqual(BASE.profiles?.['free-wide']);
  });

  it("shadows a base PROVIDER wholesale too: a mixed entry would bill one account at another's endpoint", () => {
    const shadowed = overlay({ providers: { 'gateway-payg': { transport: 'openai', apiKeyEnv: 'MY_KEY' } } });
    expect(shadowed.providers?.['gateway-payg']).toEqual({ transport: 'openai', apiKeyEnv: 'MY_KEY' });
    expect(shadowed.providers?.['gateway']).toEqual(BASE.providers?.['gateway']);
  });

  it('fails loud when a slug binds a provider NOTHING declares (the merged file is where that is knowable)', () => {
    expect(() => overlay({ models: { 'vendor/x': { provider: 'nowhere' } } }, 'models.json')).toThrow(`llm models: models.json models['vendor/x'].provider names provider 'nowhere', which models.json does not declare (have: gateway, gateway-payg, plus the built-in openai / openrouter).`);
    expect(() => overlay({ models: { 'vendor/x': { provider: 'gateway-payg' } } })).not.toThrow();
    expect(() => overlay({ models: { 'vendor/x': { provider: 'openrouter' } } })).not.toThrow();
  });

  it('lets a file entry override one per-MODEL fact without dropping the others', () => {
    const tuned = overlay({ models: { [FREE_MODEL]: { reasoningOff: 'omit' }, 'vendor/other': { reasoningOff: 'nested-disabled' } } });
    expect(llmModelReasoningOffEncodings(tuned)).toEqual({ [FREE_MODEL]: 'omit', 'vendor/other': 'nested-disabled' });
  });

  it('resolves a base provider name with an empty file', () => {
    expect(overlay({}).providers?.['gateway-payg']).toEqual(BASE.providers?.['gateway-payg']);
  });
});

describe('assertLlmModelProviderBindings()', () => {
  const RAW = { providers: { local: { transport: 'openai', baseUrl: 'http://192.168.1.50:8000/v1', apiKeyEnv: 'LOCAL_API_KEY' } } };

  it('rejects an UNDECLARED binding only once the file is merged', () => {
    const file = parseLlmModelConfigFile({ raw: { models: { 'a/b': { provider: 'nowhere' } } }, source: 'models.json', schema });
    expect(() => assertLlmModelProviderBindings({ file, source: 'models.json', schema })).toThrow(/provider 'nowhere', which models\.json does not declare \(have: \(none\), plus the built-in openai \/ openrouter\)/);
    expect(() => assertLlmModelProviderBindings({ file: parseLlmModelConfigFile({ raw: { ...RAW, models: { 'a/b': { provider: 'local' } } }, source: 'models.json', schema }), schema })).not.toThrow();
  });

  it('omits the built-in clause when the schema has no implicit providers', () => {
    const bare = makeLlmModelConfigSchema({ transports: ['openai'] });
    expect(() => assertLlmModelProviderBindings({ file: { models: { 'a/b': { provider: 'openai' } } }, schema: bare })).toThrow(`llm models: models.json models['a/b'].provider names provider 'openai', which models.json does not declare (have: (none)).`);
  });
});

describe('mergeLlmModelConfigFiles()', () => {
  it('merges providers BY KEY, replacing an entry wholesale', () => {
    const base = parseLlmModelConfigFile({ raw: { providers: { local: { transport: 'openai', baseUrl: 'http://x/v1', apiKeyEnv: 'LOCAL_API_KEY', reasoningOff: 'omit' } } }, source: 'base', schema });
    const merged = mergeLlmModelConfigFiles({ base, overlay: parseLlmModelConfigFile({ raw: { providers: { local: { apiKeyEnv: 'OTHER' } } }, source: 'overlay', schema }), schema });
    expect(merged.providers?.['local']).toEqual({ transport: 'openai', apiKeyEnv: 'OTHER' });
  });

  it("takes the overlay's scalars and falls back to the base's", () => {
    expect(mergeLlmModelConfigFiles({ base: { active: 'a', notes: 'base' }, overlay: { active: 'b' }, schema })).toEqual({ active: 'b', notes: 'base' });
    expect(mergeLlmModelConfigFiles({ base: { active: 'a', $schema: './s.json' }, overlay: {}, schema })).toEqual({ active: 'a', $schema: './s.json' });
  });

  it('omits empty blocks, so merging two bare files stays a bare file', () => {
    expect(mergeLlmModelConfigFiles({ schema })).toEqual({});
  });
});
