import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_ENV_NAMES, firstLlmEnvEntry, firstLlmEnvValue, hasLlmProviderKeyInEnv, type LlmEnvNames, readLlmEnvApiKeyNames } from './llm.node.env';

describe('firstLlmEnvEntry()', () => {
  it('should return the first set name in priority order, naming it', () => {
    expect(firstLlmEnvEntry({ env: { HOST_KEY: 'host', VENDOR_KEY: 'vendor' }, names: ['HOST_KEY', 'VENDOR_KEY'] })).toEqual({ name: 'HOST_KEY', value: 'host' });
    expect(firstLlmEnvEntry({ env: { VENDOR_KEY: 'vendor' }, names: ['HOST_KEY', 'VENDOR_KEY'] })).toEqual({ name: 'VENDOR_KEY', value: 'vendor' });
  });

  it('should treat a whitespace-only value as unset', () => {
    expect(firstLlmEnvEntry({ env: { HOST_KEY: '   ', VENDOR_KEY: 'vendor' }, names: ['HOST_KEY', 'VENDOR_KEY'] })).toEqual({ name: 'VENDOR_KEY', value: 'vendor' });
    expect(firstLlmEnvEntry({ env: { HOST_KEY: '\n' }, names: ['HOST_KEY'] })).toBeUndefined();
  });

  it('should trim the value', () => {
    expect(firstLlmEnvEntry({ env: { HOST_KEY: '  sk-1\n' }, names: ['HOST_KEY'] })).toEqual({ name: 'HOST_KEY', value: 'sk-1' });
  });

  it('should read nothing for an empty name list', () => {
    expect(firstLlmEnvEntry({ env: { HOST_KEY: 'host' }, names: [] })).toBeUndefined();
  });

  it('should return undefined when no name is set', () => {
    expect(firstLlmEnvEntry({ env: {}, names: ['HOST_KEY'] })).toBeUndefined();
  });
});

describe('firstLlmEnvValue()', () => {
  it('should return the trimmed value of the first set name', () => {
    expect(firstLlmEnvValue({ env: { HOST_KEY: '', VENDOR_KEY: ' vendor ' }, names: ['HOST_KEY', 'VENDOR_KEY'] })).toBe('vendor');
  });

  it('should return undefined when no name is set', () => {
    expect(firstLlmEnvValue({ env: { OTHER: 'x' }, names: ['HOST_KEY'] })).toBeUndefined();
  });
});

describe('readLlmEnvApiKeyNames()', () => {
  it('should list every env-default key name in provider then priority order', () => {
    expect(readLlmEnvApiKeyNames()).toEqual(['OPENAI_API_KEY', 'OPENROUTER_API_KEY']);
  });

  it('should honour custom names', () => {
    const names: LlmEnvNames = {
      ...DEFAULT_LLM_ENV_NAMES,
      providers: [
        { id: 'openai', apiKey: ['HOST_OPENAI_KEY', 'OPENAI_API_KEY'] },
        { id: 'openrouter', apiKey: ['HOST_OPENROUTER_KEY'], fallback: true }
      ]
    };

    expect(readLlmEnvApiKeyNames(names)).toEqual(['HOST_OPENAI_KEY', 'OPENAI_API_KEY', 'HOST_OPENROUTER_KEY']);
  });
});

describe('hasLlmProviderKeyInEnv()', () => {
  it('should be true when any env-default key is set', () => {
    expect(hasLlmProviderKeyInEnv({ env: { OPENROUTER_API_KEY: 'sk-or' } })).toBe(true);
    expect(hasLlmProviderKeyInEnv({ env: { OPENAI_API_KEY: 'sk-oa' } })).toBe(true);
  });

  it('should be false when no key is set', () => {
    expect(hasLlmProviderKeyInEnv({ env: { UNRELATED: 'x' } })).toBe(false);
  });

  it('should be false when every key is blank', () => {
    expect(hasLlmProviderKeyInEnv({ env: { OPENAI_API_KEY: '  ', OPENROUTER_API_KEY: '' } })).toBe(false);
  });

  it('should read the custom names only', () => {
    const names: LlmEnvNames = { ...DEFAULT_LLM_ENV_NAMES, providers: [{ id: 'openai', apiKey: ['HOST_OPENAI_KEY'] }] };
    expect(hasLlmProviderKeyInEnv({ env: { OPENAI_API_KEY: 'sk-oa' }, names })).toBe(false);
    expect(hasLlmProviderKeyInEnv({ env: { HOST_OPENAI_KEY: 'sk-oa' }, names })).toBe(true);
  });
});

describe('DEFAULT_LLM_ENV_NAMES', () => {
  it('should use vendor-prefixed (OPENAI_, OPENROUTER_) or LLM_-prefixed names only', () => {
    const varNames = [...JSON.stringify(DEFAULT_LLM_ENV_NAMES).matchAll(/"([A-Z][A-Z0-9_]+)"/g)].map((match) => match[1]);
    expect(varNames.length).toBeGreaterThan(0);
    expect(varNames.filter((name) => !/^(OPENAI|OPENROUTER|LLM)_/.test(name))).toEqual([]);
  });

  it('should read the OpenRouter base URL from the @dereekb/nestjs/openrouter name first, then the SDK name', () => {
    const openrouter = DEFAULT_LLM_ENV_NAMES.providers.find((provider) => provider.id === 'openrouter');
    expect(openrouter?.baseUrl).toEqual(['OPENROUTER_SERVER_URL', 'OPENROUTER_BASE_URL']);
  });

  it('should never read the OpenAI organization or project ids', () => {
    expect(JSON.stringify(DEFAULT_LLM_ENV_NAMES)).not.toMatch(/OPENAI_ORG_ID|OPENAI_PROJECT_ID/);
  });

  it('should rank openai first and openrouter as the fallback', () => {
    expect(DEFAULT_LLM_ENV_NAMES.providers.map((provider) => [provider.id, provider.fallback === true])).toEqual([
      ['openai', false],
      ['openrouter', true]
    ]);
  });

  it('should name the decision-lane provider pin', () => {
    expect(DEFAULT_LLM_ENV_NAMES.decisionProvider).toEqual(['LLM_DECISION_PROVIDER']);
  });

  it('should name the craft-notes folder', () => {
    expect(DEFAULT_LLM_ENV_NAMES.craftNotesDir).toEqual(['LLM_CRAFT_NOTES_DIR']);
  });
});
