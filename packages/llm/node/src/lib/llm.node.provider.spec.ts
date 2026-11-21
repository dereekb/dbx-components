import { describe, expect, it } from 'vitest';
import { type LlmCompletionAdapter, type LlmCompletionAdapterConfig, type LlmModelConfigFile, type LlmModelConfigTypes, type LlmProviderEntryBase, makeLlmAdapterRegistry, makeLlmModelConfigSchema } from '@dereekb/llm';
import { DEFAULT_LLM_ENV_NAMES, type LlmEnvNames } from './llm.node.env';
import { readLlmReachableModels, filterLlmReachableProviderGaps, makeLlmStrategiesFromEnv, resolveLlmDefaultProviderId, resolveLlmProvidersFromEnv } from './llm.node.provider';

const OPENAI_URL = 'https://api.openai.example/v1';
const OPENROUTER_URL = 'https://openrouter.example/api/v1';
const GATEWAY_URL = 'https://gateway.example/v1';
const LOCAL_URL = 'http://192.168.1.50:8000/v1';

interface TestMediaEntry extends LlmProviderEntryBase {
  readonly transport: 'media';
  readonly baseUrl: string;
}

interface TestTypes extends LlmModelConfigTypes {
  readonly providerFields: object;
  readonly extensionProviderEntry: TestMediaEntry;
  readonly modelFields: object;
}

/**
 * A schema whose extension owns a `media` transport — entries that serve no completions.
 */
const schema = makeLlmModelConfigSchema<TestTypes>({
  label: 'test models',
  transports: ['openai', 'openrouter'],
  extension: {
    providerTransports: ['media'],
    parseProviderEntry: (input) => ({ transport: 'media', baseUrl: input.baseUrl ?? '', ...(typeof input.entry['apiKeyEnv'] === 'string' ? { apiKeyEnv: input.entry['apiKeyEnv'] } : {}) })
  }
});

/**
 * A completion adapter that records every config it receives and mints a strategy under the provider's id.
 *
 * Local copy of `makeLlmCompletionAdapterFake` (`@dereekb/llm/test`): `@dereekb/llm/test` depends on `@dereekb/llm/node`,
 * so a `/node` spec importing it would close a project cycle.
 *
 * @param kind - The transport.
 * @param defaultBaseUrl - The transport's default endpoint.
 * @returns The adapter, what it received, and how often a strategy was called.
 */
function fakeCompletionAdapter(kind: string, defaultBaseUrl?: string) {
  const received: LlmCompletionAdapterConfig[] = [];
  const calls = { complete: 0 };
  const adapter: LlmCompletionAdapter = {
    facet: 'completion',
    kind,
    ...(defaultBaseUrl == null ? {} : { defaultBaseUrl }),
    make: (config) => {
      received.push(config);
      return {
        id: config.provider.id,
        kind,
        describe: `${kind} at ${config.baseUrl ?? '(default)'}`,
        caching: 'none',
        complete: () => {
          calls.complete += 1;
          return Promise.reject(new Error('not called'));
        }
      };
    }
  };

  return { adapter, received, calls };
}

const adapters = makeLlmAdapterRegistry([fakeCompletionAdapter('openai', OPENAI_URL).adapter, fakeCompletionAdapter('openrouter', OPENROUTER_URL).adapter]);

const GATEWAY = { transport: 'openai', baseUrl: GATEWAY_URL, apiKeyEnv: 'GATEWAY_API_KEY' } as const;
const LOCAL = { transport: 'openai', baseUrl: LOCAL_URL, apiKeyEnv: 'LOCAL_API_KEY' } as const;
const FILE: LlmModelConfigFile<TestTypes> = { providers: { gateway: GATEWAY, local: LOCAL } };

describe('resolveLlmProvidersFromEnv()', () => {
  describe('env defaults', () => {
    it('should mint an env default under its id with every knob its variables set', () => {
      const env = { OPENAI_API_KEY: ' sk-oa\n', OPENAI_BASE_URL: ' https://proxy.example/v1 ', LLM_OPENAI_TOKEN_LIMIT_PARAM: ' MAX_COMPLETION_TOKENS ', LLM_OPENAI_REASONING_OFF: 'Omit', LLM_OPENAI_USAGE_ACCOUNTING: 'TRUE' };
      const result = resolveLlmProvidersFromEnv({ env, schema, adapters });
      expect(result.providers).toEqual([{ id: 'openai', transport: 'openai', apiKey: 'sk-oa', apiKeyEnv: 'OPENAI_API_KEY', baseUrl: 'https://proxy.example/v1', tokenLimitParam: 'max_completion_tokens', reasoningOff: 'omit', usageAccounting: true }]);
      expect(result.defaultProviderId).toBe('openai');
      expect(result.defaultProvider?.id).toBe('openai');
    });

    it('should accept 1 for usage accounting', () => {
      expect(resolveLlmProvidersFromEnv({ env: { OPENAI_API_KEY: 'k', LLM_OPENAI_USAGE_ACCOUNTING: '1' }, schema, adapters }).providers[0]?.usageAccounting).toBe(true);
    });

    it('should ignore junk knob values and leave unset knobs absent', () => {
      const env = { OPENAI_API_KEY: 'k', LLM_OPENAI_TOKEN_LIMIT_PARAM: 'max_toks', LLM_OPENAI_REASONING_OFF: 'nah', LLM_OPENAI_USAGE_ACCOUNTING: 'yes', OPENAI_BASE_URL: '  ' };
      expect(resolveLlmProvidersFromEnv({ env, schema, adapters }).providers).toEqual([{ id: 'openai', transport: 'openai', apiKey: 'k', apiKeyEnv: 'OPENAI_API_KEY' }]);
    });

    it('should apply the knobs to their own env default only', () => {
      const env = { OPENAI_API_KEY: 'k', LOCAL_API_KEY: 'l', LLM_OPENAI_REASONING_OFF: 'omit', LLM_OPENAI_USAGE_ACCOUNTING: '1' };
      const local = resolveLlmProvidersFromEnv({ env, file: FILE, schema, adapters }).providers.find((provider) => provider.id === 'local');
      expect(local).toEqual({ id: 'local', ...LOCAL, apiKey: 'l' });
    });

    it('should resolve no providers when nothing is keyed, defaulting to the keyless fallback', () => {
      const result = resolveLlmProvidersFromEnv({ env: {}, schema, adapters });
      expect(result).toEqual({ providers: [], gaps: [], defaultProviderId: 'openrouter' });
    });

    it('should honour key-name priority', () => {
      const names: LlmEnvNames = { ...DEFAULT_LLM_ENV_NAMES, providers: [{ ...DEFAULT_LLM_ENV_NAMES.providers[0], apiKey: ['HOST_OPENAI_KEY', 'OPENAI_API_KEY'] }, DEFAULT_LLM_ENV_NAMES.providers[1]] };
      const result = resolveLlmProvidersFromEnv({ env: { HOST_OPENAI_KEY: 'host', OPENAI_API_KEY: 'vendor' }, names, schema, adapters });
      expect(result.providers[0]).toMatchObject({ apiKey: 'host', apiKeyEnv: 'HOST_OPENAI_KEY' });
    });

    it('should skip an env default whose transport has no completion adapter', () => {
      const openAiOnly = makeLlmAdapterRegistry([fakeCompletionAdapter('openai', OPENAI_URL).adapter]);
      const result = resolveLlmProvidersFromEnv({ env: { OPENROUTER_API_KEY: 'or' }, schema, adapters: openAiOnly });
      expect(result).toEqual({ providers: [], gaps: [] });
    });

    it('should mint an env default on a transport other than its id', () => {
      const names: LlmEnvNames = { ...DEFAULT_LLM_ENV_NAMES, providers: [{ id: 'proxy', transport: 'openai', apiKey: ['PROXY_KEY'], baseUrl: ['PROXY_URL'] }] };
      const result = resolveLlmProvidersFromEnv({ env: { PROXY_KEY: 'p', PROXY_URL: GATEWAY_URL }, names, schema, adapters });
      expect(result.providers).toEqual([{ id: 'proxy', transport: 'openai', apiKey: 'p', apiKeyEnv: 'PROXY_KEY', baseUrl: GATEWAY_URL }]);
    });

    it('should point the OpenRouter env default at OPENROUTER_SERVER_URL, else OPENROUTER_BASE_URL, skipping a blank one', () => {
      const resolve = (env: Record<string, string>) => resolveLlmProvidersFromEnv({ env: { OPENROUTER_API_KEY: 'or', ...env }, schema, adapters }).defaultProvider;

      expect(resolve({ OPENROUTER_SERVER_URL: ` ${GATEWAY_URL}\n`, OPENROUTER_BASE_URL: LOCAL_URL })).toEqual({ id: 'openrouter', transport: 'openrouter', apiKey: 'or', apiKeyEnv: 'OPENROUTER_API_KEY', baseUrl: GATEWAY_URL });
      expect(resolve({ OPENROUTER_BASE_URL: LOCAL_URL })?.baseUrl).toBe(LOCAL_URL);
      // An exported-but-empty alias never shadows the SDK's name.
      expect(resolve({ OPENROUTER_SERVER_URL: '  ', OPENROUTER_BASE_URL: LOCAL_URL })?.baseUrl).toBe(LOCAL_URL);
    });

    it('should leave a declared openrouter provider on its own endpoint, whatever the base-URL variables say', () => {
      const file: LlmModelConfigFile<TestTypes> = { providers: { openrouter: { transport: 'openrouter', apiKeyEnv: 'OPENROUTER_API_KEY' } } };
      const result = resolveLlmProvidersFromEnv({ env: { OPENROUTER_API_KEY: 'or', OPENROUTER_SERVER_URL: GATEWAY_URL }, file, schema, adapters });
      expect(result.providers.find((provider) => provider.id === 'openrouter')?.baseUrl).toBeUndefined();
    });
  });

  describe('declared providers', () => {
    it('should order the env default, the declared providers in declaration order, then the fallback', () => {
      const env = { OPENAI_API_KEY: 'oa', OPENROUTER_API_KEY: 'or', GATEWAY_API_KEY: 'gw', LOCAL_API_KEY: 'lo' };
      const result = resolveLlmProvidersFromEnv({ env, file: FILE, schema, adapters });
      expect(result.providers.map((provider) => provider.id)).toEqual(['openai', 'gateway', 'local', 'openrouter']);
      expect(result.providers[1]).toEqual({ id: 'gateway', ...GATEWAY, apiKey: 'gw' });
      expect(result.gaps).toEqual([]);
    });

    it('should report an unkeyed declared provider as a gap, never re-pointed at another key', () => {
      const result = resolveLlmProvidersFromEnv({ env: { OPENAI_API_KEY: 'oa', LOCAL_API_KEY: 'lo' }, file: FILE, schema, adapters });
      expect(result.providers.map((provider) => [provider.id, provider.apiKey])).toEqual([
        ['openai', 'oa'],
        ['local', 'lo']
      ]);
      expect(result.gaps).toEqual([{ id: 'gateway', apiKeyEnv: 'GATEWAY_API_KEY' }]);
    });

    it('should let a keyed declared provider sharing an env-default id replace it in its slot', () => {
      const file: LlmModelConfigFile<TestTypes> = { providers: { local: LOCAL, openai: { transport: 'openai', baseUrl: GATEWAY_URL, apiKeyEnv: 'BOX_KEY' } } };
      const result = resolveLlmProvidersFromEnv({ env: { OPENAI_API_KEY: 'oa', BOX_KEY: 'box', LOCAL_API_KEY: 'lo' }, file, schema, adapters });
      expect(result.providers.map((provider) => provider.id)).toEqual(['openai', 'local']);
      expect(result.providers[0]).toEqual({ id: 'openai', transport: 'openai', baseUrl: GATEWAY_URL, apiKeyEnv: 'BOX_KEY', apiKey: 'box' });
    });

    it('should let an unkeyed declared provider sharing an env-default id remove it', () => {
      const file: LlmModelConfigFile<TestTypes> = { providers: { openai: { transport: 'openai', baseUrl: GATEWAY_URL, apiKeyEnv: 'BOX_KEY' } } };
      const result = resolveLlmProvidersFromEnv({ env: { OPENAI_API_KEY: 'oa' }, file, schema, adapters });
      expect(result.providers).toEqual([]);
      expect(result.gaps).toEqual([{ id: 'openai', apiKeyEnv: 'BOX_KEY' }]);
    });

    it('should neither resolve nor gap an extension-owned entry', () => {
      const file: LlmModelConfigFile<TestTypes> = { extensionProviders: { speaker: { transport: 'media', baseUrl: LOCAL_URL, apiKeyEnv: 'SPEAKER_KEY' } } };
      expect(resolveLlmProvidersFromEnv({ env: { SPEAKER_KEY: 's' }, file, schema, adapters })).toEqual({ providers: [], gaps: [], defaultProviderId: 'openrouter' });
      expect(resolveLlmProvidersFromEnv({ env: {}, file, schema, adapters }).gaps).toEqual([]);
    });
  });

  describe('default provider', () => {
    it('should prefer a keyed non-fallback provider over a keyed fallback', () => {
      const result = resolveLlmProvidersFromEnv({ env: { OPENAI_API_KEY: 'oa', OPENROUTER_API_KEY: 'or' }, schema, adapters });
      expect(result.defaultProviderId).toBe('openai');
      expect(result.explicitProviderId).toBeUndefined();
    });

    it('should prefer the first keyed declared provider over the fallback', () => {
      const result = resolveLlmProvidersFromEnv({ env: { OPENROUTER_API_KEY: 'or', LOCAL_API_KEY: 'lo' }, file: FILE, schema, adapters });
      expect(result.defaultProviderId).toBe('local');
    });

    it('should default to the fallback when it is the only one keyed', () => {
      const result = resolveLlmProvidersFromEnv({ env: { OPENROUTER_API_KEY: 'or' }, schema, adapters });
      expect(result.defaultProviderId).toBe('openrouter');
      expect(result.defaultProvider).toEqual({ id: 'openrouter', transport: 'openrouter', apiKey: 'or', apiKeyEnv: 'OPENROUTER_API_KEY' });
    });

    it('should let an explicit selection win either way, case-insensitively for env-default ids, adding no provider', () => {
      const env = { OPENAI_API_KEY: 'oa', OPENROUTER_API_KEY: 'or' };
      const toFallback = resolveLlmProvidersFromEnv({ env: { ...env, LLM_PROVIDER: ' OpenRouter ' }, schema, adapters });
      expect(toFallback.explicitProviderId).toBe('openrouter');
      expect(toFallback.defaultProviderId).toBe('openrouter');
      expect(toFallback.defaultProvider?.id).toBe('openrouter');
      expect(toFallback.providers).toHaveLength(2);

      const onlyFallbackKeyed = resolveLlmProvidersFromEnv({ env: { OPENROUTER_API_KEY: 'or', LLM_PROVIDER: 'OPENAI' }, schema, adapters });
      expect(onlyFallbackKeyed.explicitProviderId).toBe('openai');
      expect(onlyFallbackKeyed.defaultProviderId).toBe('openai');
      expect(onlyFallbackKeyed.defaultProvider?.id).toBe('openrouter');
      expect(onlyFallbackKeyed.providers.map((provider) => provider.id)).toEqual(['openrouter']);
    });

    it('should match a declared name case-sensitively', () => {
      const env = { OPENAI_API_KEY: 'oa', LOCAL_API_KEY: 'lo' };
      expect(resolveLlmProvidersFromEnv({ env: { ...env, LLM_PROVIDER: 'local' }, file: FILE, schema, adapters }).defaultProviderId).toBe('local');
      expect(() => resolveLlmProvidersFromEnv({ env: { ...env, LLM_PROVIDER: 'Local' }, file: FILE, schema, adapters })).toThrow("test models: LLM_PROVIDER names provider 'Local', which this environment does not resolve (have: openai, openrouter, gateway, local).");
    });

    it('should throw on an unrecognized selection, naming the variable and the selectable ids', () => {
      expect(() => resolveLlmProvidersFromEnv({ env: { OPENROUTER_API_KEY: 'or', LLM_PROVIDER: 'nope' }, schema, adapters })).toThrow("test models: LLM_PROVIDER names provider 'nope', which this environment does not resolve (have: openai, openrouter).");
    });

    it('should throw on a selection naming an env default whose adapter is not registered', () => {
      const openAiOnly = makeLlmAdapterRegistry([fakeCompletionAdapter('openai', OPENAI_URL).adapter]);
      expect(() => resolveLlmProvidersFromEnv({ env: { OPENROUTER_API_KEY: 'or', LLM_PROVIDER: 'openrouter' }, schema, adapters: openAiOnly })).toThrow("test models: LLM_PROVIDER names provider 'openrouter', which this environment does not resolve (have: openai).");
    });

    it('should throw on a selection naming an extension-owned provider', () => {
      const file: LlmModelConfigFile<TestTypes> = { extensionProviders: { speaker: { transport: 'media', baseUrl: LOCAL_URL, apiKeyEnv: 'SPEAKER_KEY' } } };
      expect(() => resolveLlmProvidersFromEnv({ env: { SPEAKER_KEY: 's', LLM_PROVIDER: 'speaker' }, file, schema, adapters })).toThrow("test models: LLM_PROVIDER names provider 'speaker', which this environment does not resolve (have: openai, openrouter).");
    });

    it('should list (none) when nothing is selectable', () => {
      const none = makeLlmAdapterRegistry([]);
      expect(() => resolveLlmProvidersFromEnv({ env: { LLM_PROVIDER: 'openai' }, schema, adapters: none })).toThrow("test models: LLM_PROVIDER names provider 'openai', which this environment does not resolve (have: (none)).");
    });

    it('should keep an unkeyed explicit declared selection as the default id while the default provider is the first keyed', () => {
      const result = resolveLlmProvidersFromEnv({ env: { OPENAI_API_KEY: 'oa', LLM_PROVIDER: 'gateway' }, file: FILE, schema, adapters });
      expect(result.explicitProviderId).toBe('gateway');
      expect(result.defaultProviderId).toBe('gateway');
      expect(result.defaultProvider?.id).toBe('openai');
      expect(result.gaps.map((gap) => gap.id)).toEqual(['gateway', 'local']);
    });
  });

  describe('fallbackKeys', () => {
    it('should read a stored key only when the environment leaves it blank', () => {
      const fallbackKeys = { OPENAI_API_KEY: 'stored' };
      expect(resolveLlmProvidersFromEnv({ env: {}, schema, adapters, fallbackKeys }).providers[0]).toMatchObject({ apiKey: 'stored', apiKeyEnv: 'OPENAI_API_KEY' });
      expect(resolveLlmProvidersFromEnv({ env: { OPENAI_API_KEY: '  ' }, schema, adapters, fallbackKeys }).providers[0]?.apiKey).toBe('stored');
      expect(resolveLlmProvidersFromEnv({ env: { OPENAI_API_KEY: 'live' }, schema, adapters, fallbackKeys }).providers[0]?.apiKey).toBe('live');
    });

    it('should reach a declared provider naming the stored variable', () => {
      const result = resolveLlmProvidersFromEnv({ env: {}, file: FILE, schema, adapters, fallbackKeys: { GATEWAY_API_KEY: 'stored-gw' } });
      expect(result.providers).toEqual([{ id: 'gateway', ...GATEWAY, apiKey: 'stored-gw' }]);
      expect(result.gaps).toEqual([{ id: 'local', apiKeyEnv: 'LOCAL_API_KEY' }]);
    });
  });

  it('should honour custom names with a host prefix first', () => {
    const names: LlmEnvNames = {
      ...DEFAULT_LLM_ENV_NAMES,
      providers: [
        { id: 'openai', apiKey: ['HOST_OPENAI_KEY', 'OPENAI_API_KEY'], baseUrl: ['HOST_OPENAI_URL', 'OPENAI_BASE_URL'] },
        { id: 'openrouter', apiKey: ['HOST_OPENROUTER_KEY', 'OPENROUTER_API_KEY'], fallback: true }
      ],
      defaultProvider: ['HOST_PROVIDER']
    };

    const env = { HOST_OPENAI_KEY: 'h', OPENAI_BASE_URL: GATEWAY_URL, HOST_OPENAI_URL: LOCAL_URL, OPENROUTER_API_KEY: 'or', HOST_PROVIDER: 'openrouter', LLM_PROVIDER: 'openai' };
    const result = resolveLlmProvidersFromEnv({ env, names, schema, adapters });
    expect(result.providers).toEqual([
      { id: 'openai', transport: 'openai', apiKey: 'h', apiKeyEnv: 'HOST_OPENAI_KEY', baseUrl: LOCAL_URL },
      { id: 'openrouter', transport: 'openrouter', apiKey: 'or', apiKeyEnv: 'OPENROUTER_API_KEY' }
    ]);
    expect(result.defaultProviderId).toBe('openrouter');
  });
});

describe('resolveLlmDefaultProviderId()', () => {
  it('should let an explicit id win, even one that is not keyed', () => {
    expect(resolveLlmDefaultProviderId({ explicitProviderId: 'unkeyed', providers: [{ id: 'openai' }], fallbackProviderIds: ['openrouter'] })).toBe('unkeyed');
  });

  it('should choose the first keyed provider that is not a fallback', () => {
    expect(resolveLlmDefaultProviderId({ providers: [{ id: 'openrouter' }, { id: 'zenmux' }, { id: 'openai' }], fallbackProviderIds: ['openrouter'] })).toBe('zenmux');
  });

  it('should choose the first keyed fallback when only fallbacks are keyed', () => {
    expect(resolveLlmDefaultProviderId({ providers: [{ id: 'openrouter' }, { id: 'local' }], fallbackProviderIds: ['local', 'openrouter'] })).toBe('openrouter');
  });

  it('should choose the first fallback id when nothing is keyed', () => {
    expect(resolveLlmDefaultProviderId({ providers: [], fallbackProviderIds: ['openrouter', 'local'] })).toBe('openrouter');
  });

  it('should be undefined when there is nothing at all', () => {
    expect(resolveLlmDefaultProviderId({ providers: [] })).toBeUndefined();
  });
});

describe('makeLlmStrategiesFromEnv()', () => {
  it('should build one inert strategy per provider under its own id, with the effective base URL and the shared options', () => {
    const openai = fakeCompletionAdapter('openai', OPENAI_URL);
    const openrouter = fakeCompletionAdapter('openrouter', OPENROUTER_URL);
    const registry = makeLlmAdapterRegistry([openai.adapter, openrouter.adapter]);
    const reasoningOffByModel = { 'vendor/model': 'omit' } as const;

    const result = makeLlmStrategiesFromEnv({
      env: { OPENAI_API_KEY: 'oa', OPENROUTER_API_KEY: 'or', LOCAL_API_KEY: 'lo' },
      file: { providers: { local: LOCAL } },
      schema,
      adapters: registry,
      defaultModel: 'vendor/model',
      reasoningOffByModel
    });

    expect(result.ids).toEqual(['openai', 'local', 'openrouter']);
    expect(result.providers.map((provider) => provider.id)).toEqual(result.ids);
    expect(result.defaultProviderId).toBe('openai');
    expect(result.strategies.get('local')?.describe).toBe(`openai at ${LOCAL_URL}`);
    expect(result.strategies.get('openai')?.describe).toBe(`openai at ${OPENAI_URL}`);
    expect(result.strategies.get('openrouter')?.describe).toBe(`openrouter at ${OPENROUTER_URL}`);
    expect(openai.received.map((config) => [config.provider.id, config.baseUrl])).toEqual([
      ['openai', OPENAI_URL],
      ['local', LOCAL_URL]
    ]);

    for (const config of [...openai.received, ...openrouter.received]) {
      expect(config.defaultModel).toBe('vendor/model');
      expect(config.reasoningOffByModel).toEqual(reasoningOffByModel);
    }

    expect(openai.calls.complete + openrouter.calls.complete).toBe(0);
  });

  it('should build nothing when nothing is keyed', () => {
    const result = makeLlmStrategiesFromEnv({ env: {}, schema, adapters });
    expect(result.ids).toEqual([]);
    expect(result.defaultProviderId).toBe('openrouter');
  });

  it('should build the OpenRouter env default against the endpoint its base-URL variables name', () => {
    const openrouter = fakeCompletionAdapter('openrouter', OPENROUTER_URL);
    const registry = makeLlmAdapterRegistry([openrouter.adapter]);
    const result = makeLlmStrategiesFromEnv({ env: { OPENROUTER_API_KEY: 'or', OPENROUTER_BASE_URL: GATEWAY_URL }, schema, adapters: registry });

    expect(result.strategies.get('openrouter')?.describe).toBe(`openrouter at ${GATEWAY_URL}`);
    expect(openrouter.received.map((config) => config.baseUrl)).toEqual([GATEWAY_URL]);
  });
});

describe('readLlmReachableModels()', () => {
  it('should list the tier and routing slugs, de-duplicated in first-seen order', () => {
    const reachable = readLlmReachableModels({
      modelTiers: { fast: 'vendor/a', strong: { model: 'vendor/b', maxOutputTokens: 512 } },
      routing: { tiers: { cheap: 'vendor/c', fast: 'vendor/a' }, rules: [{ model: 'vendor/d' }, { tier: 'fast' }, { model: 'vendor/a' }] }
    });

    expect(reachable).toEqual(['vendor/a', 'vendor/b', 'vendor/c', 'vendor/d']);
  });

  it('should return nothing for nothing', () => {
    expect(readLlmReachableModels({})).toEqual([]);
  });
});

describe('filterLlmReachableProviderGaps()', () => {
  it('should keep one row per gap and reachable slug bound to it', () => {
    const gaps = [
      { id: 'gateway', apiKeyEnv: 'GATEWAY_API_KEY' },
      { id: 'local', apiKeyEnv: 'LOCAL_API_KEY' }
    ];

    const scoped = filterLlmReachableProviderGaps({ gaps, reachableModels: ['vendor/x', 'vendor/y', 'vendor/z'], providerByModel: { 'vendor/x': 'gateway', 'vendor/z': 'gateway', 'vendor/q': 'local' } });
    expect(scoped).toEqual([
      { id: 'gateway', apiKeyEnv: 'GATEWAY_API_KEY', model: 'vendor/x' },
      { id: 'gateway', apiKeyEnv: 'GATEWAY_API_KEY', model: 'vendor/z' }
    ]);
  });

  it('should drop every gap with no bindings', () => {
    expect(filterLlmReachableProviderGaps({ gaps: [{ id: 'gateway', apiKeyEnv: 'GATEWAY_API_KEY' }], reachableModels: ['vendor/x'] })).toEqual([]);
  });
});
