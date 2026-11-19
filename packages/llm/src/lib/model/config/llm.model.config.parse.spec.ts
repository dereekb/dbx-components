import { describe, expect, it } from 'vitest';
import { flattenLlmModelProfile, isLlmProviderPatchValue, parseLlmModelConfigFile, parseLlmModelSettings, parseLlmProviderEntry } from './llm.model.config.parse';
import { llmModelProviderBindings } from './llm.model.config.resolve';
import { makeLlmModelConfigSchema } from './llm.model.config.schema';

const schema = makeLlmModelConfigSchema({
  transports: ['openai', 'openrouter'],
  meterings: ['zenmux'],
  decisionRoutes: ['zenmux', 'openrouter'],
  implicitProviders: ['openai', 'openrouter'],
  retiredKeys: { profile: new Map([['credential', 'a profile no longer names a credential; bind the slug to a provider instead (models[<slug>].provider).']]) }
});

const FILE = {
  active: 'free',
  profiles: {
    deepseek: { fast: 'vendor/model-fast', strong: 'vendor/model-strong' },
    free: { fast: 'z-ai/glm-5.3-free', strong: 'z-ai/glm-5.3-free' }
  }
};

function parse(raw: unknown, source = 'models.json') {
  return parseLlmModelConfigFile({ raw, source, schema });
}

describe('parseLlmModelConfigFile()', () => {
  it('parses the profiles and active selection', () => {
    const file = parse(FILE);

    expect(file.active).toBe('free');
    expect(file.profiles?.['deepseek']).toEqual({ tiers: { fast: 'vendor/model-fast', strong: 'vendor/model-strong' } });
  });

  it('parses a RICH tier value beside a bare slug (the per-model output controls)', () => {
    const file = parse({ profiles: { free: { fast: { model: 'z-ai/glm-5.3-free', maxOutputTokens: 4096, reasoning: { effort: 'low' } } } } });

    expect(file.profiles?.['free']?.tiers['fast']).toEqual({ model: 'z-ai/glm-5.3-free', maxOutputTokens: 4096, reasoning: { effort: 'low' } });
  });

  it('FAILS LOUD on a non-object root, an unknown top-level key, or a malformed tier value', () => {
    expect(() => parse(['nope'])).toThrow('llm models: models.json must contain a JSON object.');
    expect(() => parse({ profile: {} })).toThrow(`llm models: models.json has unknown key 'profile' (allowed: active, providers, profiles, models, notes, $schema).`);
    expect(() => parse({ profiles: { free: { fast: 7 } } })).toThrow(/must be a non-empty, trimmed model slug or a \{ model, maxOutputTokens\?, reasoning\? \} object \(got 7\)\./);
    expect(() => parse({ profiles: { free: { fast: { model: 'm', maxTokens: 10 } } } })).toThrow(/unknown key 'maxTokens'/);
    expect(() => parse({ profiles: { free: { fast: '' } } }, '/home/x/models.json')).toThrow(/\/home\/x\/models\.json profiles\['free'\]\['fast'\]/);
    expect(() => parse({ active: 3 })).toThrow('llm models: models.json.active must be a profile-name string.');
    expect(() => parse({ profiles: [] })).toThrow('llm models: models.json.profiles must be a JSON object of { profileName: { tierKey: modelSlug } }.');
  });

  it('reads a profile as a BARE tier map, and fails a retired profile key with its remedy', () => {
    expect(parse({ profiles: { baseline: { fast: 'a/b' } } }).profiles?.['baseline']).toEqual({ tiers: { fast: 'a/b' } });
    expect(() => parse({ profiles: { free: { credential: 'payg', fast: 'a/b' } } })).toThrow(/retired key 'credential'.*models\[<slug>\]\.provider/s);
  });

  it('fails a retired key at the file, provider and model level with its remedy, before the unknown-key check', () => {
    const retiring = makeLlmModelConfigSchema({
      transports: ['openai'],
      retiredKeys: { file: new Map([['profile', 'renamed profiles.']]), provider: new Map([['credential', 'name apiKeyEnv.']]), model: new Map([['reasoning', 'renamed reasoningOff.']]) }
    });

    expect(() => parseLlmModelConfigFile({ raw: { zzz: 1, profile: {} }, source: 'models.json', schema: retiring })).toThrow(`llm models: models.json has retired key 'profile'. renamed profiles.`);
    expect(() => parseLlmModelConfigFile({ raw: { providers: { local: { zzz: 1, credential: 'x', apiKeyEnv: 'K' } } }, source: 'models.json', schema: retiring })).toThrow(`llm models: models.json providers['local'] has retired key 'credential'. name apiKeyEnv.`);
    expect(() => parseLlmModelConfigFile({ raw: { models: { 'a/b': { zzz: 1, reasoning: 'omit' } } }, source: 'models.json', schema: retiring })).toThrow(`llm models: models.json models['a/b'] has retired key 'reasoning'. renamed reasoningOff.`);
  });

  it('passes notes and $schema through, and trims active', () => {
    const file = parse({ active: '  free ', notes: ['why'], $schema: './schema.json', profiles: FILE.profiles });

    expect(file.active).toBe('free');
    expect(file.notes).toEqual(['why']);
    expect(file.$schema).toBe('./schema.json');
  });

  it('omits the blocks the file does not declare', () => {
    expect(parse({})).toEqual({});
    expect(parse({ active: null })).toEqual({});
  });
});

describe('the `providers` block', () => {
  const RAW = { providers: { local: { transport: 'openai', baseUrl: 'http://192.168.1.50:8000/v1', apiKeyEnv: 'LOCAL_API_KEY', reasoningOff: 'omit' } } };

  it('parses a declared provider, defaulting the transport to the schema default', () => {
    expect(parse(RAW).providers?.['local']).toEqual({ transport: 'openai', baseUrl: 'http://192.168.1.50:8000/v1', apiKeyEnv: 'LOCAL_API_KEY', reasoningOff: 'omit' });
    expect(parse({ providers: { local: { apiKeyEnv: 'K' } } }).providers?.['local']?.transport).toBe('openai');
  });

  it('parses every completion key in order and trims the base URL and key var', () => {
    const entry = parseLlmProviderEntry({ label: 'p', value: { decision: 'none', metering: 'zenmux', usageAccounting: true, tokenLimitParam: 'max_completion_tokens', reasoningOff: 'effort-minimal', apiKeyEnv: ' K ', baseUrl: ' http://x/v1 ', transport: 'openrouter' }, schema });

    expect(entry).toEqual({ transport: 'openrouter', baseUrl: 'http://x/v1', apiKeyEnv: 'K', reasoningOff: 'effort-minimal', tokenLimitParam: 'max_completion_tokens', usageAccounting: true, metering: 'zenmux', decision: 'none' });
    expect(Object.keys(entry)).toEqual(['transport', 'baseUrl', 'apiKeyEnv', 'reasoningOff', 'tokenLimitParam', 'usageAccounting', 'metering', 'decision']);
  });

  it('parses a declared decision route, and leaves it absent when undeclared (derived from the transport)', () => {
    const file = parse({ providers: { zen: { apiKeyEnv: 'K', baseUrl: 'https://zenmux.ai/api/v1', decision: 'zenmux' }, chat: { transport: 'openrouter', apiKeyEnv: 'K2', decision: 'none' } } });

    expect(file.providers?.['zen']).toMatchObject({ decision: 'zenmux' });
    expect(file.providers?.['chat']).toMatchObject({ decision: 'none' });
    expect(parse(RAW).providers?.['local']).not.toHaveProperty('decision');
  });

  it('FAILS LOUD on an unknown key, an illegal transport / metering / decision / encoding, naming the provider', () => {
    expect(() => parse({ providers: { local: { apiKeyEnv: 'K', baseURL: 'x' } } })).toThrow(/providers\['local'\] has unknown key 'baseURL'/);
    expect(() => parse({ providers: { local: { apiKeyEnv: 'K', transport: 'vllm' } } })).toThrow(/transport must be one of openai, openrouter \(got "vllm"\)/);
    expect(() => parse({ providers: { local: { apiKeyEnv: 'K', metering: 'openrouter' } } })).toThrow(/metering must be one of zenmux, none/);
    expect(() => parse({ providers: { local: { apiKeyEnv: 'K', decision: 'typesafe' } } })).toThrow(/decision must be one of zenmux, openrouter, none/);
    expect(() => parse({ providers: { local: { apiKeyEnv: 'K', reasoningOff: 'minimal' } } })).toThrow(/reasoningOff must be one of effort-none, effort-minimal, nested-disabled, omit/);
    expect(() => parse({ providers: { local: { apiKeyEnv: 'K', tokenLimitParam: 'max' } } })).toThrow(/tokenLimitParam must be one of max_tokens, max_completion_tokens/);
    expect(() => parse({ providers: { local: { apiKeyEnv: 'K', usageAccounting: 'yes' } } })).toThrow(/usageAccounting must be a boolean/);
    expect(() => parse({ providers: { local: { apiKeyEnv: 'K', baseUrl: ' ' } } })).toThrow(/baseUrl must be a non-empty endpoint URL/);
    expect(() => parse({ providers: { local: 'K' } })).toThrow(`llm models: models.json providers['local'] must be a JSON object of { transport, baseUrl, apiKeyEnv, reasoningOff, tokenLimitParam, usageAccounting, metering, decision }.`);
    expect(() => parse({ providers: ['local'] })).toThrow(/\.providers must be a JSON object/);
  });

  it('REQUIRES apiKeyEnv, rather than letting a declared provider inherit the default key', () => {
    expect(() => parse({ providers: { local: { baseUrl: 'http://x/v1' } } })).toThrow(/apiKeyEnv must name the env var/);
    expect(() => parse({ providers: { local: { apiKeyEnv: '  ' } } })).toThrow(/apiKeyEnv must name the env var/);
  });

  it('parses an identity-less entry as an ordinary entry when the schema parses no patches (no patch hint)', () => {
    expect(isLlmProviderPatchValue({ reasoningOff: 'omit' })).toBe(true);
    expect(() => parse({ providers: { local: { reasoningOff: 'omit' } } })).toThrow(`llm models: models.json providers['local'].apiKeyEnv must name the env var supplying this provider's key (got undefined). A declared provider is never billed on another provider's key.`);
  });

  it('binds a SLUG to a provider, and projects the bindings', () => {
    const file = parse({ ...RAW, models: { 'local/qwen-27b': { provider: 'local' }, 'vendor/other': { vision: true } } });

    expect(file.models?.['local/qwen-27b']?.provider).toBe('local');
    expect(llmModelProviderBindings(file)).toEqual({ 'local/qwen-27b': 'local' });
    expect(llmModelProviderBindings(parse(RAW))).toBeUndefined();
  });
});

describe('isLlmProviderPatchValue()', () => {
  it('is true only for an object carrying no identity key', () => {
    expect(isLlmProviderPatchValue({})).toBe(true);
    expect(isLlmProviderPatchValue({ apiKeyEnv: 'K' })).toBe(false);
    expect(isLlmProviderPatchValue({ transport: 'openai' })).toBe(false);
    expect(isLlmProviderPatchValue(null)).toBe(false);
    expect(isLlmProviderPatchValue([])).toBe(false);
  });
});

describe('flattenLlmModelProfile()', () => {
  it('round-trips a profile back to its FLAT on-disk shape', () => {
    const parsed = parse({ profiles: { free: { fast: 'z-ai/glm-5.3-free', strong: 'z-ai/glm-5.3-free' } } });
    const profile = parsed.profiles?.['free'];
    const flat = profile == null ? {} : flattenLlmModelProfile(profile);

    expect(flat).toEqual({ fast: 'z-ai/glm-5.3-free', strong: 'z-ai/glm-5.3-free' });
    expect(parse({ profiles: { free: flat } })).toEqual(parsed);
  });
});

describe('the per-MODEL `models` block', () => {
  it('parses a slug entry beside the profiles, keyed by SLUG rather than scoped to a profile', () => {
    const file = parse({ ...FILE, models: { 'z-ai/glm-5.3-free': { reasoningOff: 'effort-minimal' } } });

    expect(file.models).toEqual({ 'z-ai/glm-5.3-free': { reasoningOff: 'effort-minimal' } });
    expect(file.profiles?.['free']?.tiers).toEqual({ fast: 'z-ai/glm-5.3-free', strong: 'z-ai/glm-5.3-free' });
  });

  it('FAILS LOUD on an unknown per-model key or an illegal value, naming the slug', () => {
    expect(() => parse({ models: { 'a/b': { reasoningOff: 'minimal' } } })).toThrow(/models\['a\/b'\]\.reasoningOff must be one of/);
    expect(() => parse({ models: { 'a/b': { reasoning_off: 'omit' } } })).toThrow(`llm models: models.json models['a/b'] has unknown key 'reasoning_off' (allowed: provider, reasoningOff, vision, promptAddendum).`);
    expect(() => parse({ models: { 'a/b': 'effort-minimal' } })).toThrow(`llm models: models.json models['a/b'] must be a JSON object of { provider, reasoningOff, vision, promptAddendum }.`);
    expect(() => parse({ models: ['a/b'] })).toThrow('llm models: models.json.models must be a JSON object of { modelSlug: { provider?, reasoningOff?, vision?, promptAddendum? } }.');
    expect(() => parse({ models: { 'a/b': { vision: 'yes' } } })).toThrow(/models\['a\/b'\]\.vision must be a boolean \(got "yes"\)/);
    expect(() => parse({ models: { 'a/b': { reasoningOff: 'nope' } } }, '/home/x/models.json')).toThrow(/\/home\/x\/models\.json models\['a\/b'\]/);
  });

  it('rejects a blank per-slug provider at parse, but not an undeclared one (checked once merged)', () => {
    expect(() => parseLlmModelSettings({ label: 'models[x]', value: { provider: '' }, schema })).toThrow(/provider must be a declared provider name/);
    expect(() => parse({ models: { 'a/b': { provider: 'nowhere' } } })).not.toThrow();
  });

  it('accepts an entry that declares nothing (yet) without inventing a default', () => {
    expect(parseLlmModelSettings({ label: 'x', value: {}, schema })).toEqual({});
  });

  it('parses a per-model PROMPT ADDENDUM beside the wire facts, untrimmed', () => {
    const file = parse({ ...FILE, models: { 'z-ai/glm-5.3-free': { reasoningOff: 'effort-minimal', promptAddendum: ' Reply with a single JSON object and no prose.' } } });

    expect(file.models?.['z-ai/glm-5.3-free']).toEqual({ reasoningOff: 'effort-minimal', promptAddendum: ' Reply with a single JSON object and no prose.' });
  });

  it('REJECTS a blank promptAddendum rather than reading it as "no addendum"', () => {
    expect(() => parse({ models: { 'a/b': { promptAddendum: '' } } })).toThrow(/promptAddendum must be a non-empty string/);
    expect(() => parse({ models: { 'a/b': { promptAddendum: '   \n  ' } } })).toThrow(/promptAddendum must be a non-empty string/);
    expect(() => parse({ models: { 'a/b': { promptAddendum: 12 } } })).toThrow(/promptAddendum must be a non-empty string/);
  });
});
