import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_MODEL_CONFIG_LABEL, LLM_MODEL_SETTINGS_KEYS, LLM_PROVIDER_ENTRY_KEYS, llmCompletionProviderEntries, type LlmModelConfigTypes, type LlmProviderEntryBase, type LlmProviderEntryMap, makeLlmModelConfigSchema } from './llm.model.config.schema';

interface MinimalTypes extends LlmModelConfigTypes {
  readonly providerFields: object;
  readonly extensionProviderEntry: LlmProviderEntryBase;
  readonly modelFields: object;
}

describe('makeLlmModelConfigSchema()', () => {
  it('fills the defaults', () => {
    const schema = makeLlmModelConfigSchema({ transports: ['openai', 'openrouter'] });

    expect(schema.label).toBe(DEFAULT_LLM_MODEL_CONFIG_LABEL);
    expect(schema.label).toBe('llm models');
    expect(schema.defaultTransport).toBe('openai');
    expect(schema.implicitProviders).toEqual([]);
    expect(schema.extensionTransports).toEqual([]);
    expect(schema.entryTransports).toEqual(['openai', 'openrouter']);
    expect(schema.meterings).toEqual(['none']);
    expect(schema.decisionRoutes).toEqual(['none']);
    expect(schema.patchKeysNoun).toBe('patch');
    expect(schema.providerKeys).toEqual(LLM_PROVIDER_ENTRY_KEYS);
    expect(schema.modelKeys).toEqual(LLM_MODEL_SETTINGS_KEYS);
    expect(schema.extension).toBeUndefined();

    for (const level of [schema.retiredKeys.file, schema.retiredKeys.provider, schema.retiredKeys.model, schema.retiredKeys.profile]) {
      expect(level.size).toBe(0);
    }
  });

  it('keeps list order, folds duplicates and an explicit none, and lists none last', () => {
    const schema = makeLlmModelConfigSchema({ transports: ['openrouter', 'openai', 'openrouter'], defaultTransport: 'openai', meterings: ['none', 'zenmux', 'zenmux'], decisionRoutes: ['zenmux', 'none', 'openrouter'], implicitProviders: ['openai', 'openai'] });

    expect(schema.transports).toEqual(['openrouter', 'openai']);
    expect(schema.defaultTransport).toBe('openai');
    expect(schema.meterings).toEqual(['zenmux', 'none']);
    expect(schema.decisionRoutes).toEqual(['zenmux', 'openrouter', 'none']);
    expect(schema.implicitProviders).toEqual(['openai']);
  });

  it('appends the extension keys, transports and meterings after the base ones', () => {
    const schema = makeLlmModelConfigSchema<MinimalTypes>({
      transports: ['openai'],
      meterings: ['zenmux'],
      extension: {
        providerKeys: ['speech'],
        parseProviderFields: () => ({}),
        providerTransports: ['none'],
        parseProviderEntry: (input) => ({ transport: input.transport, baseUrl: input.baseUrl ?? '' }),
        meterings: ['voice-vendor', 'zenmux'],
        modelKeys: ['voice'],
        parseModelFields: () => ({}),
        patchKeysNoun: 'speech route'
      }
    });

    expect(schema.providerKeys).toEqual([...LLM_PROVIDER_ENTRY_KEYS, 'speech']);
    expect(schema.modelKeys).toEqual([...LLM_MODEL_SETTINGS_KEYS, 'voice']);
    expect(schema.entryTransports).toEqual(['openai', 'none']);
    expect(schema.extensionTransports).toEqual(['none']);
    expect(schema.meterings).toEqual(['zenmux', 'voice-vendor', 'none']);
    expect(schema.patchKeysNoun).toBe('speech route');
  });

  it('throws on an unusable schema', () => {
    expect(() => makeLlmModelConfigSchema({ label: 'x models', transports: [] })).toThrow('x models: a model config schema needs at least one transport.');
    expect(() => makeLlmModelConfigSchema({ transports: ['openai'], defaultTransport: 'openrouter' })).toThrow(`llm models: the default transport 'openrouter' is not one of openai.`);
    expect(() => makeLlmModelConfigSchema({ transports: ['openai'], extension: { providerKeys: ['baseUrl'], parseProviderFields: () => ({}) } })).toThrow(`llm models: extension provider key 'baseUrl' collides with a built-in provider key.`);
    expect(() => makeLlmModelConfigSchema({ transports: ['openai'], extension: { modelKeys: ['vision'], parseModelFields: () => ({}) } })).toThrow(`llm models: extension model key 'vision' collides with a built-in model key.`);
    expect(() => makeLlmModelConfigSchema<MinimalTypes>({ transports: ['openai'], extension: { providerTransports: ['openai'], parseProviderEntry: (input) => ({ transport: input.transport }) } })).toThrow(`llm models: extension transport 'openai' collides with a completion transport.`);
    expect(() => makeLlmModelConfigSchema({ transports: ['openai'], extension: { providerKeys: ['speech'] } })).toThrow('llm models: an extension that adds provider keys must parse them (parseProviderFields).');
    expect(() => makeLlmModelConfigSchema({ transports: ['openai'], extension: { modelKeys: ['voice'] } })).toThrow('llm models: an extension that adds model keys must parse them (parseModelFields).');
    expect(() => makeLlmModelConfigSchema({ transports: ['openai'], extension: { providerTransports: ['none'] } })).toThrow('llm models: an extension that owns transports must parse their entries (parseProviderEntry).');
  });
});

describe('llmCompletionProviderEntries()', () => {
  const schema = makeLlmModelConfigSchema<MinimalTypes>({ transports: ['openai', 'openrouter'], extension: { providerTransports: ['none'], parseProviderEntry: (input) => ({ transport: input.transport, baseUrl: input.baseUrl ?? '' }) } });

  it('keeps the completion entries in declaration order and drops the extension-owned ones', () => {
    const providers: LlmProviderEntryMap<MinimalTypes> = {
      b: { transport: 'openrouter', apiKeyEnv: 'B' },
      media: { transport: 'none', baseUrl: 'https://media.example.com' },
      a: { transport: 'openai', apiKeyEnv: 'A' }
    };

    expect(Object.keys(llmCompletionProviderEntries({ providers, schema }))).toEqual(['b', 'a']);
  });

  it('returns an empty map for absent providers', () => {
    expect(llmCompletionProviderEntries({ providers: undefined, schema })).toEqual({});
  });
});
