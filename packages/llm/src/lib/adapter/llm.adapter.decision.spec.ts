import { describe, expect, it } from 'vitest';
import { type LlmProviderConfig } from '../model/config/llm.model.config.resolve';
import { type LlmCredentialProbeFetch } from '../strategy/llm.credential.probe';
import { type LlmAdapter, type LlmCompletionAdapter, type LlmDecisionAdapter, type LlmDecisionAdapterConfig } from './llm.adapter';
import { makeLlmAdapterRegistry } from './llm.adapter.registry';
import { llmDecisionCapableProviders, llmDecisionStrategyKinds, llmProviderDecisionRouteOf, makeLlmDecisionStrategies } from './llm.adapter.decision';

const OPENAI_URL = 'https://api.openai.com/v1';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
const ZENMUX_URL = 'https://zenmux.ai/api/v1';
const LOCAL_URL = 'http://192.168.1.50:8000/v1';

interface FakeDecisionAdapterConfig {
  readonly kind: string;
  readonly strategyKind: string;
  readonly transports?: ReadonlyArray<string>;
  /**
   * Mint under another id or kind, to exercise the checks.
   */
  readonly mint?: { readonly id?: string; readonly kind?: string };
}

function fakeDecisionAdapter(config: FakeDecisionAdapterConfig) {
  const { kind, strategyKind, transports, mint } = config;
  const received: LlmDecisionAdapterConfig[] = [];
  const adapter: LlmDecisionAdapter = {
    facet: 'decision',
    kind,
    strategyKind,
    ...(transports == null ? {} : { transports }),
    make: (config) => {
      received.push(config);
      return {
        id: mint?.id ?? config.provider.id,
        kind: mint?.kind ?? strategyKind,
        describe: `${kind} decisions at ${config.baseUrl ?? '(default)'}`,
        decide: () => Promise.reject(new Error('not called'))
      };
    }
  };

  return { adapter, received };
}

function fakeCompletionAdapter(kind: string, defaultBaseUrl: string): LlmCompletionAdapter {
  return {
    facet: 'completion',
    kind,
    defaultBaseUrl,
    make: () => {
      throw new Error('not called');
    }
  };
}

const COMPLETION: ReadonlyArray<LlmAdapter> = [fakeCompletionAdapter('openai', OPENAI_URL), fakeCompletionAdapter('openrouter', OPENROUTER_URL)];

/**
 * Decision `zenmux` (declared only) then decision `openrouter` (derived from the `openrouter` transport), then the
 * completion adapters.
 */
function standardAdapters() {
  const zenmux = fakeDecisionAdapter({ kind: 'zenmux', strategyKind: 'zenmux-decisions' });
  const openrouter = fakeDecisionAdapter({ kind: 'openrouter', strategyKind: 'openrouter-decisions', transports: ['openrouter'] });
  const adapters = makeLlmAdapterRegistry([zenmux.adapter, openrouter.adapter, ...COMPLETION]);
  return { adapters, zenmux, openrouter };
}

const ZENMUX: LlmProviderConfig = { id: 'zenmux', transport: 'openai', baseUrl: ZENMUX_URL, apiKeyEnv: 'ZENMUX_API_KEY', apiKey: 'zm-key', decision: 'zenmux' };
const ZENMUX_PAYG: LlmProviderConfig = { id: 'zenmux-payg', transport: 'openai', baseUrl: ZENMUX_URL, apiKeyEnv: 'ZENMUX_PAYG_API_KEY', apiKey: 'zm-payg-key', decision: 'zenmux' };
const ENV_DEFAULT_OPENAI: LlmProviderConfig = { id: 'openai', transport: 'openai', baseUrl: ZENMUX_URL, apiKeyEnv: 'OPENAI_API_KEY', apiKey: 'env-key' };
const LOCAL: LlmProviderConfig = { id: 'local', transport: 'openai', baseUrl: LOCAL_URL, apiKeyEnv: 'LOCAL_API_KEY', apiKey: 'local-key' };
const OPENROUTER: LlmProviderConfig = { id: 'openrouter', transport: 'openrouter', apiKeyEnv: 'OPENROUTER_API_KEY', apiKey: 'or-key' };
const SECOND_ACCOUNT: LlmProviderConfig = { id: 'openrouter-lab', transport: 'openrouter', apiKeyEnv: 'OPENROUTER_LAB_API_KEY', apiKey: 'or-lab-key' };
const OPTED_OUT: LlmProviderConfig = { id: 'openrouter-chat', transport: 'openrouter', apiKeyEnv: 'OPENROUTER_CHAT_API_KEY', apiKey: 'or-chat-key', decision: 'none' };
const KEYLESS: LlmProviderConfig = { id: 'zenmux-dry', transport: 'openai', baseUrl: ZENMUX_URL, apiKeyEnv: 'ZENMUX_DRY_API_KEY', apiKey: '  ', decision: 'zenmux' };

function idsOf(providers: ReadonlyArray<LlmProviderConfig>): ReadonlyArray<string> {
  return providers.map((provider) => provider.id);
}

describe('llmProviderDecisionRouteOf()', () => {
  const { adapters } = standardAdapters();

  it("should read the declared route, else derive it through a decision adapter's transports", () => {
    expect(llmProviderDecisionRouteOf({ provider: ZENMUX, adapters })).toBe('zenmux');
    expect(llmProviderDecisionRouteOf({ provider: OPENROUTER, adapters })).toBe('openrouter');
    expect(llmProviderDecisionRouteOf({ provider: OPTED_OUT, adapters })).toBe('none');
    expect(llmProviderDecisionRouteOf({ provider: LOCAL, adapters })).toBe('none');
  });

  it('should never derive the route from the base URL', () => {
    expect(llmProviderDecisionRouteOf({ provider: ENV_DEFAULT_OPENAI, adapters })).toBe('none');
  });

  it('should derive nothing when no decision adapter serves the transport', () => {
    const withoutOpenRouter = makeLlmAdapterRegistry([fakeDecisionAdapter({ kind: 'zenmux', strategyKind: 'zenmux-decisions' }).adapter, ...COMPLETION]);
    expect(llmProviderDecisionRouteOf({ provider: OPENROUTER, adapters: withoutOpenRouter })).toBe('none');
  });
});

describe('llmDecisionCapableProviders()', () => {
  const { adapters } = standardAdapters();

  it('should keep only the routed, keyed providers', () => {
    expect(idsOf(llmDecisionCapableProviders({ providers: [ENV_DEFAULT_OPENAI, LOCAL, ZENMUX, OPTED_OUT, KEYLESS, OPENROUTER], adapters }))).toEqual(['zenmux', 'openrouter']);
  });

  it('should return nothing for no providers', () => {
    expect(llmDecisionCapableProviders({ providers: undefined, adapters })).toEqual([]);
    expect(llmDecisionCapableProviders({ providers: [], adapters })).toEqual([]);
  });

  it('should order by route preference, then provider order, defaulting to registration order', () => {
    const providers = [OPENROUTER, SECOND_ACCOUNT, ZENMUX, ZENMUX_PAYG];
    const expected = ['zenmux', 'zenmux-payg', 'openrouter', 'openrouter-lab'];

    expect(idsOf(llmDecisionCapableProviders({ providers, adapters, routePreference: ['zenmux', 'openrouter'] }))).toEqual(expected);
    expect(idsOf(llmDecisionCapableProviders({ providers, adapters }))).toEqual(expected);
  });

  it('should follow a reversed preference, and rank an unlisted route last', () => {
    const providers = [ZENMUX, OPENROUTER, ZENMUX_PAYG, SECOND_ACCOUNT];

    expect(idsOf(llmDecisionCapableProviders({ providers, adapters, routePreference: ['openrouter', 'zenmux'] }))).toEqual(['openrouter', 'openrouter-lab', 'zenmux', 'zenmux-payg']);
    expect(idsOf(llmDecisionCapableProviders({ providers, adapters, routePreference: ['openrouter'] }))).toEqual(['openrouter', 'openrouter-lab', 'zenmux', 'zenmux-payg']);
  });

  it("should put the lane's default provider first", () => {
    expect(llmDecisionCapableProviders({ providers: [OPENROUTER, ZENMUX, ZENMUX_PAYG], adapters })[0]?.id).toBe('zenmux');
    expect(llmDecisionCapableProviders({ providers: [OPENROUTER, ZENMUX_PAYG], adapters })[0]?.id).toBe('zenmux-payg');
    expect(llmDecisionCapableProviders({ providers: [LOCAL, SECOND_ACCOUNT, OPENROUTER], adapters })[0]?.id).toBe('openrouter-lab');
    expect(llmDecisionCapableProviders({ providers: [LOCAL, ENV_DEFAULT_OPENAI], adapters })[0]?.id).toBeUndefined();
  });
});

describe('makeLlmDecisionStrategies()', () => {
  it('should build one strategy per capable provider, in preference order, under its own id and route kind', () => {
    const { adapters } = standardAdapters();
    const registry = makeLlmDecisionStrategies({ providers: [OPENROUTER, ENV_DEFAULT_OPENAI, ZENMUX, ZENMUX_PAYG, SECOND_ACCOUNT], adapters });

    expect(registry.values().map((strategy) => [strategy.id, strategy.kind])).toEqual([
      ['zenmux', 'zenmux-decisions'],
      ['zenmux-payg', 'zenmux-decisions'],
      ['openrouter', 'openrouter-decisions'],
      ['openrouter-lab', 'openrouter-decisions']
    ]);
  });

  it("should hand each adapter the provider's effective base URL, and the timeout and fetch seam only when set", () => {
    const { adapters, zenmux, openrouter } = standardAdapters();
    const registry = makeLlmDecisionStrategies({ providers: [ZENMUX, OPENROUTER], adapters });

    expect(registry.get('zenmux')?.describe).toBe(`zenmux decisions at ${ZENMUX_URL}`);
    expect(registry.get('openrouter')?.describe).toBe(`openrouter decisions at ${OPENROUTER_URL}`);
    expect(zenmux.received).toEqual([{ provider: ZENMUX, baseUrl: ZENMUX_URL }]);

    const fetch: LlmCredentialProbeFetch = () => Promise.reject(new Error('not called'));
    makeLlmDecisionStrategies({ providers: [OPENROUTER], adapters, timeoutMs: 5000, fetch });
    expect(openrouter.received[1]).toEqual({ provider: OPENROUTER, baseUrl: OPENROUTER_URL, fetch, timeoutMs: 5000 });
  });

  it('should build an empty registry when no provider has a route', () => {
    const { adapters } = standardAdapters();
    expect(makeLlmDecisionStrategies({ providers: [LOCAL, ENV_DEFAULT_OPENAI], adapters }).values()).toEqual([]);
  });

  it('should fail loud on a declared route with no registered decision adapter', () => {
    const adapters = makeLlmAdapterRegistry([fakeDecisionAdapter({ kind: 'openrouter', strategyKind: 'openrouter-decisions', transports: ['openrouter'] }).adapter, ...COMPLETION]);
    expect(() => makeLlmDecisionStrategies({ providers: [ZENMUX], adapters })).toThrow("provider 'zenmux': no decision adapter is registered for 'zenmux' (registered: openrouter).");
  });

  it('should fail loud when an adapter mints another id or another kind', () => {
    const wrongId = makeLlmAdapterRegistry([fakeDecisionAdapter({ kind: 'zenmux', strategyKind: 'zenmux-decisions', mint: { id: 'zenmux-shared' } }).adapter, ...COMPLETION]);
    expect(() => makeLlmDecisionStrategies({ providers: [ZENMUX], adapters: wrongId })).toThrow("provider 'zenmux': the 'zenmux' decision adapter minted strategy id 'zenmux-shared'; an adapter must register each provider under the provider's own id.");

    const wrongKind = makeLlmAdapterRegistry([fakeDecisionAdapter({ kind: 'zenmux', strategyKind: 'zenmux-decisions', mint: { kind: 'zenmux-chat' } }).adapter, ...COMPLETION]);
    expect(() => makeLlmDecisionStrategies({ providers: [ZENMUX], adapters: wrongKind })).toThrow("provider 'zenmux': the 'zenmux' decision adapter minted a strategy of kind 'zenmux-chat' but declares strategyKind 'zenmux-decisions'.");
  });
});

describe('llmDecisionStrategyKinds()', () => {
  it('should derive the decision strategy kinds from the registered decision adapters', () => {
    const { adapters } = standardAdapters();

    expect([...llmDecisionStrategyKinds(adapters)]).toEqual(['zenmux-decisions', 'openrouter-decisions']);
    expect(llmDecisionStrategyKinds(makeLlmAdapterRegistry([])).size).toBe(0);
  });
});
