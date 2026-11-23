import { ArkErrors } from 'arktype';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { type ArktypeFieldRules } from '@dereekb/model';
import {
  DEFAULT_LLM_MODEL_CONFIG_LABEL,
  LLM_MODEL_CONFIG_FILE_KEYS,
  LLM_MODEL_SETTINGS_FIELD_RULES,
  LLM_MODEL_SETTINGS_KEYS,
  LLM_PROVIDER_COMPLETION_ONLY_KEYS,
  LLM_PROVIDER_ENTRY_KEYS,
  LLM_PROVIDER_IDENTITY_KEYS,
  type LlmCompletionProviderEntry,
  type LlmModelConfigFile,
  type LlmModelConfigFileKey,
  type LlmModelConfigTypes,
  type LlmModelSettings,
  type LlmProviderEntryBase,
  makeLlmModelConfigSchema
} from './llm.model.config.schema';

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

describe('the per-schema entry checks', () => {
  const schema = makeLlmModelConfigSchema({ transports: ['openai', 'openrouter'], meterings: ['zenmux'], decisionRoutes: ['zenmux'] });

  it('reject an unlisted transport, metering or decision', () => {
    expect(schema.providerEntryBaseType({ transport: 'vllm' })).toBeInstanceOf(ArkErrors);
    expect(schema.completionProviderEntryType({ apiKeyEnv: 'K', metering: 'other' })).toBeInstanceOf(ArkErrors);
    expect(schema.completionProviderEntryType({ apiKeyEnv: 'K', decision: 'openrouter' })).toBeInstanceOf(ArkErrors);
  });

  it('accept the listed values, and an absent transport', () => {
    expect(schema.providerEntryBaseType({ transport: 'openrouter' })).not.toBeInstanceOf(ArkErrors);
    expect(schema.completionProviderEntryType({ apiKeyEnv: 'K', metering: 'none', decision: 'zenmux' })).not.toBeInstanceOf(ArkErrors);
  });

  it('has a rule for every key, in key order', () => {
    const rules: ArktypeFieldRules<LlmCompletionProviderEntry> = schema.completionProviderEntryRules;
    expect(Object.keys(rules)).toEqual([...LLM_PROVIDER_ENTRY_KEYS]);
    expect(Object.keys(LLM_MODEL_SETTINGS_FIELD_RULES)).toEqual([...LLM_MODEL_SETTINGS_KEYS]);
  });
});

describe('the key constants', () => {
  it('classify every key of a parsed file as on-disk or in-memory', () => {
    expectTypeOf<keyof LlmModelConfigFile>().toEqualTypeOf<LlmModelConfigFileKey | 'extensionProviders' | 'providerPatches'>();
    expect(LLM_MODEL_CONFIG_FILE_KEYS).toEqual(['$schema', 'notes', 'active', 'providers', 'profiles', 'models']);
  });

  it('cover the entry types exactly', () => {
    expectTypeOf<(typeof LLM_PROVIDER_ENTRY_KEYS)[number]>().toEqualTypeOf<keyof LlmCompletionProviderEntry>();
    expectTypeOf<(typeof LLM_MODEL_SETTINGS_KEYS)[number]>().toEqualTypeOf<keyof LlmModelSettings>();
    expectTypeOf<LlmProviderEntryBase>().toMatchTypeOf<{ readonly transport: string }>();
  });
});

describe('LLM_PROVIDER_COMPLETION_ONLY_KEYS', () => {
  it('is a subset of the provider entry keys, disjoint from the identity keys and from metering', () => {
    const entryKeys: ReadonlyArray<string> = LLM_PROVIDER_ENTRY_KEYS;
    const identityKeys: ReadonlyArray<string> = LLM_PROVIDER_IDENTITY_KEYS;

    for (const key of LLM_PROVIDER_COMPLETION_ONLY_KEYS) {
      expect(entryKeys).toContain(key);
      expect(identityKeys).not.toContain(key);
      expect(key).not.toBe('metering');
    }

    expect([...LLM_PROVIDER_COMPLETION_ONLY_KEYS]).toEqual(['reasoningOff', 'tokenLimitParam', 'usageAccounting', 'decision']);
  });
});
