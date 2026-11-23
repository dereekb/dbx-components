import { describe, expect, it } from 'vitest';
import { type LlmModelConfigFile, makeLlmModelConfigSchema, type LlmResolvedModelProfile, resolveLlmModelTiers } from '@dereekb/llm';
import { DEFAULT_LLM_ENV_NAMES, type LlmEnvNames } from './llm.node.env';
import { llmModelProfileDefaultModelFromEnv, resolveLlmModelProfileFromEnv, resolveLlmModelTierEnv } from './llm.node.model.profile';

const schema = makeLlmModelConfigSchema({ label: 'test models', transports: ['openai', 'openrouter'] });
const SOURCE = '/home/test/.app/models.json';

const FILE: LlmModelConfigFile = {
  active: 'cheap',
  profiles: {
    cheap: { tiers: { fast: 'vendor/small-free', strong: 'vendor/large-free' } },
    wide: { tiers: { fast: 'vendor/wide', strong: { model: 'vendor/wider', maxOutputTokens: 1024 } } }
  }
};

describe('resolveLlmModelProfileFromEnv()', () => {
  it('should select the file active profile with no override', () => {
    expect(resolveLlmModelProfileFromEnv({ env: {}, file: FILE, source: SOURCE, schema })).toEqual({ profileName: 'cheap', tiers: FILE.profiles?.['cheap']?.tiers, selectedBy: 'file' });
  });

  it('should let the env override win and name the variable', () => {
    expect(resolveLlmModelProfileFromEnv({ env: { LLM_MODEL_PROFILE: ' wide ' }, file: FILE, source: SOURCE, schema })).toEqual({ profileName: 'wide', tiers: FILE.profiles?.['wide']?.tiers, selectedBy: 'override', overrideEnv: 'LLM_MODEL_PROFILE' });
  });

  it('should select nothing for off / none', () => {
    expect(resolveLlmModelProfileFromEnv({ env: { LLM_MODEL_PROFILE: 'off' }, file: FILE, source: SOURCE, schema })).toBeUndefined();
    expect(resolveLlmModelProfileFromEnv({ env: { LLM_MODEL_PROFILE: 'NONE' }, file: FILE, source: SOURCE, schema })).toBeUndefined();
    expect(resolveLlmModelProfileFromEnv({ env: {}, file: { ...FILE, active: 'none' }, source: SOURCE, schema })).toBeUndefined();
  });

  it('should select nothing with no file and no override', () => {
    expect(resolveLlmModelProfileFromEnv({ env: {}, source: SOURCE, schema })).toBeUndefined();
  });

  it('should throw naming the variable when the override names an undefined profile', () => {
    expect(() => resolveLlmModelProfileFromEnv({ env: { LLM_MODEL_PROFILE: 'ghost' }, file: FILE, source: SOURCE, schema })).toThrow(`test models: LLM_MODEL_PROFILE names profile 'ghost', which ${SOURCE} does not define (have: cheap, wide).`);
  });

  it('should throw naming <path>.active when the file names an undefined profile', () => {
    expect(() => resolveLlmModelProfileFromEnv({ env: {}, file: { ...FILE, active: 'ghost' }, source: SOURCE, schema })).toThrow(`${SOURCE}.active names profile 'ghost'`);
  });

  it('should throw listing (none) when the override resolves against no file', () => {
    expect(() => resolveLlmModelProfileFromEnv({ env: { LLM_MODEL_PROFILE: 'cheap' }, source: SOURCE, schema })).toThrow('(have: (none))');
  });

  it('should honour custom profile names, host name first', () => {
    const names: LlmEnvNames = { ...DEFAULT_LLM_ENV_NAMES, modelProfile: ['HOST_MODEL_PROFILE', 'LLM_MODEL_PROFILE'] };
    expect(resolveLlmModelProfileFromEnv({ env: { HOST_MODEL_PROFILE: 'wide', LLM_MODEL_PROFILE: 'cheap' }, names, file: FILE, source: SOURCE, schema })?.overrideEnv).toBe('HOST_MODEL_PROFILE');
  });
});

describe('llmModelProfileDefaultModelFromEnv()', () => {
  const profile: LlmResolvedModelProfile = { profileName: 'wide', tiers: FILE.profiles?.['wide']?.tiers ?? {}, selectedBy: 'file' };

  it('should read the default tier when no variable is set', () => {
    expect(llmModelProfileDefaultModelFromEnv({ profile, env: {} })).toBe('vendor/wide');
  });

  it('should honour the default-tier variable and normalize a rich tier value', () => {
    expect(llmModelProfileDefaultModelFromEnv({ profile, env: { LLM_DEFAULT_TIER: 'strong' } })).toBe('vendor/wider');
  });

  it('should return undefined when the profile lacks the tier', () => {
    expect(llmModelProfileDefaultModelFromEnv({ profile, env: { LLM_DEFAULT_TIER: 'cheap' } })).toBeUndefined();
  });

  it('should return undefined with no profile', () => {
    expect(llmModelProfileDefaultModelFromEnv({ profile: undefined, env: {} })).toBeUndefined();
  });
});

describe('resolveLlmModelTierEnv()', () => {
  it('should return {} when nothing is declared', () => {
    expect(resolveLlmModelTierEnv({ env: {} })).toEqual({});
  });

  it('should read the bulk tier JSON', () => {
    expect(resolveLlmModelTierEnv({ env: { LLM_MODEL_TIERS: '{"fast":"vendor/a","cheap":{"model":"vendor/c","maxOutputTokens":256}}' } })).toEqual({ modelTiers: { fast: 'vendor/a', cheap: { model: 'vendor/c', maxOutputTokens: 256 } } });
  });

  it('should let each per-tier variable win over the JSON', () => {
    expect(resolveLlmModelTierEnv({ env: { LLM_MODEL_TIERS: '{"fast":"vendor/a","strong":"vendor/b"}', LLM_MODEL: ' vendor/x ', LLM_MODEL_STRONG: 'vendor/y' } })).toEqual({ modelTiers: { fast: 'vendor/x', strong: 'vendor/y' } });
  });

  it('should treat a blank per-tier variable as unset', () => {
    expect(resolveLlmModelTierEnv({ env: { LLM_MODEL_TIERS: '{"fast":"vendor/a"}', LLM_MODEL: '   ' } })).toEqual({ modelTiers: { fast: 'vendor/a' } });
    expect(resolveLlmModelTierEnv({ env: { LLM_MODEL_TIERS: '  ' } })).toEqual({});
  });

  it('should throw naming the variable on invalid JSON, keeping the cause', () => {
    let error: unknown;

    try {
      resolveLlmModelTierEnv({ env: { LLM_MODEL_TIERS: '{fast:' } });
    } catch (e) {
      error = e;
    }

    expect((error as Error).message).toMatch(/^LLM_MODEL_TIERS is not valid JSON: /);
    expect((error as Error).cause).toBeInstanceOf(SyntaxError);
  });

  it('should throw naming the variable on a malformed tier', () => {
    expect(() => resolveLlmModelTierEnv({ env: { LLM_MODEL_TIERS: '{"fast":5}' } })).toThrow(/LLM_MODEL_TIERS/);
    expect(() => resolveLlmModelTierEnv({ env: { LLM_MODEL_TIERS: '["vendor/a"]' } })).toThrow(/LLM_MODEL_TIERS must be a JSON object/);
  });

  it('should prefix a malformed tier with the schema label when one is passed', () => {
    expect(() => resolveLlmModelTierEnv({ env: { LLM_MODEL_TIERS: '{"fast":{"model":"vendor/a","maxOutputTokens":1.5}}' }, schemaLabel: 'llm models' })).toThrow(`llm models: LLM_MODEL_TIERS['fast'].maxOutputTokens must be a positive integer (got 1.5).`);
  });

  it('should pass the default and decode-retry tiers through trimmed', () => {
    expect(resolveLlmModelTierEnv({ env: { LLM_DEFAULT_TIER: ' strong ', LLM_DECODE_RETRY_TIER: 'off' } })).toEqual({ defaultTier: 'strong', decodeRetryTier: 'off' });
    expect(resolveLlmModelTierEnv({ env: { LLM_DECODE_RETRY_TIER: 'OFF' } })).toEqual({ decodeRetryTier: 'OFF' });
  });

  it('should honour custom names, including an added tier', () => {
    const names: LlmEnvNames = { ...DEFAULT_LLM_ENV_NAMES, tierModels: { ...DEFAULT_LLM_ENV_NAMES.tierModels, cheap: ['HOST_MODEL_CHEAP'] }, defaultTier: ['HOST_DEFAULT_TIER'] };
    expect(resolveLlmModelTierEnv({ env: { HOST_MODEL_CHEAP: 'vendor/c', HOST_DEFAULT_TIER: 'cheap', LLM_DEFAULT_TIER: 'strong' }, names })).toEqual({ modelTiers: { cheap: 'vendor/c' }, defaultTier: 'cheap' });
  });

  it('should layer env tiers over the profile over the base', () => {
    const profile = resolveLlmModelProfileFromEnv({ env: {}, file: FILE, source: SOURCE, schema });
    const tierEnv = resolveLlmModelTierEnv({ env: { LLM_MODEL_STRONG: 'vendor/pinned', LLM_DEFAULT_TIER: 'strong' } });
    const resolved = resolveLlmModelTiers({ base: { fast: 'vendor/base-fast', strong: 'vendor/base-strong', deep: 'vendor/base-deep' }, modelTiers: { ...profile?.tiers, ...tierEnv.modelTiers }, defaultTier: tierEnv.defaultTier });
    expect(resolved).toEqual({ tiers: { fast: 'vendor/small-free', strong: 'vendor/pinned', deep: 'vendor/base-deep' }, defaultTier: 'strong' });
  });
});
