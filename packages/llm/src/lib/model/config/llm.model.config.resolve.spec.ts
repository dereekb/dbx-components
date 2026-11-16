import { describe, expect, it } from 'vitest';
import { parseLlmModelConfigFile } from './llm.model.config.parse';
import { llmModelProfileDefaultModel, llmModelPromptAddenda, llmModelProviderBindings, llmModelReasoningOffEncodings, llmModelVisionCapabilities, resolveLlmModelProfile, resolveLlmProviderConfigs } from './llm.model.config.resolve';
import { type LlmProviderEntryMap, makeLlmModelConfigSchema } from './llm.model.config.schema';

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

function parse(raw: unknown) {
  return parseLlmModelConfigFile({ raw, source: 'models.json', schema });
}

describe('resolveLlmModelProfile()', () => {
  const file = parse(FILE);

  it("resolves the file's own active profile", () => {
    const resolved = resolveLlmModelProfile({ file, schema });

    expect(resolved?.profileName).toBe('free');
    expect(resolved?.selectedBy).toBe('file');
    expect(resolved?.tiers).toEqual({ fast: 'z-ai/glm-5.3-free', strong: 'z-ai/glm-5.3-free' });
  });

  it('the override wins over the file for one run', () => {
    const resolved = resolveLlmModelProfile({ file, override: ' deepseek ', schema });

    expect(resolved?.profileName).toBe('deepseek');
    expect(resolved?.selectedBy).toBe('override');
    expect(resolved?.tiers).toEqual({ fast: 'vendor/model-fast', strong: 'vendor/model-strong' });
  });

  it('falls back to the file on a blank override', () => {
    expect(resolveLlmModelProfile({ file, override: '   ', schema })?.selectedBy).toBe('file');
  });

  it('resolves to NOTHING when no profile is selected, or when the selection is explicitly off', () => {
    expect(resolveLlmModelProfile({ schema })).toBeUndefined();
    expect(resolveLlmModelProfile({ file: parse({ profiles: FILE.profiles }), schema })).toBeUndefined();
    expect(resolveLlmModelProfile({ file, override: 'off', schema })).toBeUndefined();
    expect(resolveLlmModelProfile({ file, override: 'NONE', schema })).toBeUndefined();
  });

  it('FAILS LOUD when a selection names a profile the file does not define', () => {
    expect(() => resolveLlmModelProfile({ file, override: 'fre', schema })).toThrow(`llm models: the profile override names profile 'fre', which models.json does not define (have: deepseek, free).`);
    expect(() => resolveLlmModelProfile({ file, override: 'fre', overrideLabel: 'MODEL_PROFILE', schema })).toThrow(/^llm models: MODEL_PROFILE names profile 'fre'/);
    expect(() => resolveLlmModelProfile({ file: parse({ active: 'nope' }), schema })).toThrow(`llm models: models.json.active names profile 'nope', which models.json does not define (have: (none)).`);
    expect(() => resolveLlmModelProfile({ override: 'free', schema })).toThrow(/does not define/);
  });
});

describe('llmModelProfileDefaultModel()', () => {
  const file = parse(FILE);

  it("reads the profile's default tier, honouring the default-tier setting", () => {
    const profile = resolveLlmModelProfile({ file, override: 'deepseek', schema });

    expect(llmModelProfileDefaultModel({ profile })).toBe('vendor/model-fast');
    expect(llmModelProfileDefaultModel({ profile, defaultTier: '  ' })).toBe('vendor/model-fast');
    expect(llmModelProfileDefaultModel({ profile, defaultTier: ' strong ' })).toBe('vendor/model-strong');
  });

  it('normalizes a rich tier value down to its slug, and reports nothing for an absent tier', () => {
    const rich = resolveLlmModelProfile({ file: parse({ active: 'free', profiles: { free: { fast: { model: 'z-ai/glm-5.3-free', maxOutputTokens: 512 } } } }), schema });

    expect(llmModelProfileDefaultModel({ profile: rich })).toBe('z-ai/glm-5.3-free');
    expect(llmModelProfileDefaultModel({ profile: rich, defaultTier: 'strong' })).toBeUndefined();
    expect(llmModelProfileDefaultModel({ profile: undefined })).toBeUndefined();
  });
});

describe('the per-slug projections', () => {
  const file = parse({ models: { 'a/b': { reasoningOff: 'effort-minimal', promptAddendum: 'JSON ONLY.' }, 'c/d': { vision: true, provider: 'local' }, 'e/f': { vision: false } } });
  const empty = parse({ models: { 'c/d': {} } });

  it('project only the declaring slugs', () => {
    expect(llmModelReasoningOffEncodings(file)).toEqual({ 'a/b': 'effort-minimal' });
    expect(llmModelVisionCapabilities(file)).toEqual({ 'c/d': true });
    expect(llmModelPromptAddenda(file)).toEqual({ 'a/b': 'JSON ONLY.' });
    expect(llmModelProviderBindings(file)).toEqual({ 'c/d': 'local' });
  });

  it('return undefined (never {}) when no slug declares the fact', () => {
    for (const source of [empty, parse(FILE), undefined]) {
      expect(llmModelReasoningOffEncodings(source)).toBeUndefined();
      expect(llmModelVisionCapabilities(source)).toBeUndefined();
      expect(llmModelPromptAddenda(source)).toBeUndefined();
      expect(llmModelProviderBindings(source)).toBeUndefined();
    }
  });
});

describe('resolveLlmProviderConfigs()', () => {
  const providers: LlmProviderEntryMap = {
    local: { transport: 'openai', baseUrl: 'http://192.168.1.50:8000/v1', apiKeyEnv: 'LOCAL_API_KEY', reasoningOff: 'omit' },
    gateway: { transport: 'openai', apiKeyEnv: 'GATEWAY_API_KEY' },
    'gateway-payg': { transport: 'openrouter', apiKeyEnv: 'GATEWAY_PAYG_API_KEY' }
  };

  it('resolves the keyed providers in declaration order, trimming the key', () => {
    const keys: Record<string, string> = { LOCAL_API_KEY: ' local-key ', GATEWAY_API_KEY: 'gateway-key', GATEWAY_PAYG_API_KEY: 'payg-key' };
    const result = resolveLlmProviderConfigs({ providers, schema, apiKeyOf: ({ entry }) => keys[entry.apiKeyEnv] });

    expect(result.gaps).toEqual([]);
    expect(result.providers).toEqual([
      { id: 'local', transport: 'openai', baseUrl: 'http://192.168.1.50:8000/v1', apiKeyEnv: 'LOCAL_API_KEY', reasoningOff: 'omit', apiKey: 'local-key' },
      { id: 'gateway', transport: 'openai', apiKeyEnv: 'GATEWAY_API_KEY', apiKey: 'gateway-key' },
      { id: 'gateway-payg', transport: 'openrouter', apiKeyEnv: 'GATEWAY_PAYG_API_KEY', apiKey: 'payg-key' }
    ]);
  });

  it('lists a blank or missing key as a gap, never a config', () => {
    const keys: Record<string, string> = { LOCAL_API_KEY: '   ', GATEWAY_PAYG_API_KEY: 'payg-key' };
    const result = resolveLlmProviderConfigs({ providers, schema, apiKeyOf: ({ entry }) => keys[entry.apiKeyEnv] });

    expect(result.providers.map((x) => x.id)).toEqual(['gateway-payg']);
    expect(result.gaps).toEqual([
      { id: 'local', apiKeyEnv: 'LOCAL_API_KEY' },
      { id: 'gateway', apiKeyEnv: 'GATEWAY_API_KEY' }
    ]);
  });

  it('hands the reader the provider id and its entry', () => {
    const seen: string[] = [];
    resolveLlmProviderConfigs({
      providers,
      schema,
      apiKeyOf: ({ id, entry }) => {
        seen.push(`${id}:${entry.apiKeyEnv}`);
        return undefined;
      }
    });

    expect(seen).toEqual(['local:LOCAL_API_KEY', 'gateway:GATEWAY_API_KEY', 'gateway-payg:GATEWAY_PAYG_API_KEY']);
  });

  it('resolves nothing from absent providers', () => {
    expect(resolveLlmProviderConfigs({ providers: undefined, schema, apiKeyOf: () => 'k' })).toEqual({ providers: [], gaps: [] });
  });
});
