import { describe, expect, it } from 'vitest';
import { type LlmProviderConfig } from '../model/config/llm.model.config.resolve';
import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { llmStrategyKind, makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmAdapter, type LlmAdapterInput, type LlmBillAdapter, type LlmCompletionAdapter, type LlmCompletionAdapterConfig, type LlmCredentialProbeAdapter, type LlmMeteringAdapter } from './llm.adapter';
import { makeLlmAdapterRegistry } from './llm.adapter.registry';
import { llmProviderBaseUrlOf, llmProviderMeteringOf, makeLlmProviderStrategies, makeLlmProviderStrategy, resolveLlmProviderAccount } from './llm.adapter.provider';

const OPENAI_URL = 'https://api.openai.com/v1';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
const ZENMUX_URL = 'https://zenmux.ai/api/v1';
const LOCAL_URL = 'http://192.168.1.50:8000/v1';

interface FakeCalls {
  complete: number;
}

/**
 * A completion adapter that records every config it receives and mints a strategy under the provider's id (or under
 * `mintId` when given, to exercise the id check).
 */
function fakeCompletionAdapter(kind: string, defaultBaseUrl?: string, mintId?: string) {
  const received: LlmCompletionAdapterConfig[] = [];
  const calls: FakeCalls = { complete: 0 };
  const adapter: LlmCompletionAdapter = {
    facet: 'completion',
    kind,
    ...(defaultBaseUrl == null ? {} : { defaultBaseUrl }),
    make: (config) => {
      received.push(config);
      return {
        id: mintId ?? config.provider.id,
        kind,
        describe: `${kind} at ${config.baseUrl ?? '(default)'}`,
        caching: 'none',
        complete: () => {
          calls.complete += 1;
          return Promise.reject(new Error('not called'));
        },
        ...(config.credentialProbe == null ? {} : { credentialProbe: config.credentialProbe })
      };
    }
  };

  return { adapter, received, calls };
}

function fakeMeteringAdapter(kind: string, hostname: string) {
  const received: LlmAdapterInput[] = [];
  const adapter: LlmMeteringAdapter = {
    facet: 'metering',
    kind,
    costBasis: 'list',
    isAccountBaseUrl: (url) => new URL(url).hostname === hostname,
    make: (input) => {
      received.push(input);
      return { providerId: kind, read: () => Promise.resolve({ providerId: kind, available: true, windows: [], issues: [] }) };
    }
  };

  return { adapter, received };
}

function fakeCredentialProbeAdapter(kind: string) {
  const received: LlmAdapterInput[] = [];
  const adapter: LlmCredentialProbeAdapter = {
    facet: 'credentialProbe',
    kind,
    make: (input) => {
      received.push(input);
      return async () => {
        await input.fetch?.(`${input.baseUrl}/chat/completions`, { method: 'POST', headers: {} });
        return { ready: true, issues: [] };
      };
    }
  };

  return { adapter, received };
}

function fakeBillAdapter(kind: string) {
  const received: LlmAdapterInput[] = [];
  const adapter: LlmBillAdapter = {
    facet: 'bill',
    kind,
    make: (input) => {
      received.push(input);
      return { providerId: kind, read: () => Promise.reject(new Error('not called')) };
    }
  };

  return { adapter, received };
}

function fakeFetch() {
  const urls: string[] = [];
  const fetch: ConfiguredFetch = (input) => {
    urls.push(String(input));
    return Promise.resolve(new Response('{}', { status: 200 }));
  };

  return { fetch, urls };
}

/**
 * The standard set: completion `openai` + `openrouter`, and a full `zenmux` account (metering, credential probe, bill).
 */
function standardAdapters(extra: ReadonlyArray<LlmAdapter> = []) {
  const openai = fakeCompletionAdapter('openai', OPENAI_URL);
  const openrouter = fakeCompletionAdapter('openrouter', OPENROUTER_URL);
  const metering = fakeMeteringAdapter('zenmux', 'zenmux.ai');
  const probe = fakeCredentialProbeAdapter('zenmux');
  const bill = fakeBillAdapter('zenmux');
  const adapters = makeLlmAdapterRegistry([openai.adapter, openrouter.adapter, metering.adapter, probe.adapter, bill.adapter, ...extra]);
  return { adapters, openai, openrouter, metering, probe, bill };
}

const ZENMUX: LlmProviderConfig = { id: 'zenmux', transport: 'openai', baseUrl: ZENMUX_URL, apiKeyEnv: 'ZENMUX_API_KEY', apiKey: 'zm-key', metering: 'zenmux' };
const ENV_DEFAULT: LlmProviderConfig = { id: 'env-default', transport: 'openai', baseUrl: ZENMUX_URL, apiKeyEnv: 'OPENAI_API_KEY', apiKey: 'env-key' };
const BARE_OPENAI: LlmProviderConfig = { id: 'bare', transport: 'openai', apiKeyEnv: 'OPENAI_API_KEY', apiKey: 'bare-key' };
const LOCAL: LlmProviderConfig = { id: 'local', transport: 'openai', baseUrl: LOCAL_URL, apiKeyEnv: 'LOCAL_API_KEY', apiKey: 'local-key', metering: 'none' };
const ROUTER: LlmProviderConfig = { id: 'openrouter', transport: 'openrouter', apiKeyEnv: 'OPENROUTER_API_KEY', apiKey: 'or-key' };
const VOICE: LlmProviderConfig = { id: 'voice', transport: 'openai', apiKeyEnv: 'VOICE_API_KEY', apiKey: 'voice-key', metering: 'voice-vendor' };

describe('llmProviderBaseUrlOf()', () => {
  const { adapters } = standardAdapters();

  it("should prefer the provider's own base URL, else its transport adapter's default", () => {
    expect(llmProviderBaseUrlOf({ provider: LOCAL, adapters })).toBe(LOCAL_URL);
    expect(llmProviderBaseUrlOf({ provider: ROUTER, adapters })).toBe(OPENROUTER_URL);
  });

  it('should be undefined for an unregistered transport with no base URL', () => {
    expect(llmProviderBaseUrlOf({ provider: { transport: 'vllm' }, adapters })).toBeUndefined();
  });
});

describe('llmProviderMeteringOf()', () => {
  const { adapters } = standardAdapters();

  it("should let a declared metering win, 'none' included", () => {
    expect(llmProviderMeteringOf({ provider: LOCAL, adapters })).toBe('none');
    expect(llmProviderMeteringOf({ provider: ZENMUX, adapters })).toBe('zenmux');
  });

  it('should infer the metering from the effective base URL when none is declared', () => {
    expect(llmProviderMeteringOf({ provider: ENV_DEFAULT, adapters })).toBe('zenmux');
    expect(llmProviderMeteringOf({ provider: BARE_OPENAI, adapters })).toBe('none');
    expect(llmProviderMeteringOf({ provider: { transport: 'openai', baseUrl: ZENMUX_URL }, adapters })).toBe('zenmux');
  });

  it("should infer from the transport's default base URL when the provider names none", () => {
    const gateway = fakeCompletionAdapter('gateway', ZENMUX_URL);
    const { adapters: withGateway } = standardAdapters([gateway.adapter]);

    expect(llmProviderMeteringOf({ provider: { transport: 'gateway' }, adapters: withGateway })).toBe('zenmux');
  });

  it('should let the first registered metering adapter that claims the URL win', () => {
    const first = fakeMeteringAdapter('first-account', 'zenmux.ai');
    const second = fakeMeteringAdapter('second-account', 'zenmux.ai');
    const twoClaimants = makeLlmAdapterRegistry([fakeCompletionAdapter('openai', OPENAI_URL).adapter, first.adapter, second.adapter]);

    expect(llmProviderMeteringOf({ provider: ENV_DEFAULT, adapters: twoClaimants })).toBe('first-account');
  });
});

describe('resolveLlmProviderAccount()', () => {
  it("should give a provider metering 'none' no account facets", () => {
    const { adapters } = standardAdapters();
    expect(resolveLlmProviderAccount({ provider: LOCAL, adapters })).toEqual({ metering: 'none', baseUrl: LOCAL_URL });
  });

  it('should mint every account facet of a metered provider through its adapters', () => {
    const { adapters, metering, probe, bill } = standardAdapters();
    const account = resolveLlmProviderAccount({ provider: ZENMUX, adapters });

    expect(account.metering).toBe('zenmux');
    expect(account.baseUrl).toBe(ZENMUX_URL);
    expect(account.costBasis).toBe('list');
    expect(account.providerStatusSource?.providerId).toBe('zenmux');
    expect(account.credentialProbe).toBeTypeOf('function');
    expect(account.billReader?.providerId).toBe('zenmux');

    expect(metering.received).toEqual([{ provider: ZENMUX, baseUrl: ZENMUX_URL }]);
    expect(probe.received).toEqual([{ provider: ZENMUX, baseUrl: ZENMUX_URL }]);
    expect(bill.received).toEqual([{ provider: ZENMUX, baseUrl: ZENMUX_URL }]);
  });

  it('should hand the fetch seam to every account adapter only when one is passed', () => {
    const { adapters, metering } = standardAdapters();
    const { fetch } = fakeFetch();
    resolveLlmProviderAccount({ provider: ZENMUX, adapters, fetch });

    expect(metering.received).toEqual([{ provider: ZENMUX, baseUrl: ZENMUX_URL, fetch }]);
  });

  it('should treat the bill and credential probe adapters as optional', () => {
    const adapters = makeLlmAdapterRegistry([fakeCompletionAdapter('openai', OPENAI_URL).adapter, fakeMeteringAdapter('zenmux', 'zenmux.ai').adapter]);
    const account = resolveLlmProviderAccount({ provider: ZENMUX, adapters });

    expect(Object.keys(account).sort((a, b) => a.localeCompare(b))).toEqual(['baseUrl', 'costBasis', 'metering', 'providerStatusSource']);
  });

  it('should fail loud on a declared metering with no registered metering adapter', () => {
    const { adapters } = standardAdapters();
    expect(() => resolveLlmProviderAccount({ provider: VOICE, adapters })).toThrow("provider 'voice': no metering adapter is registered for 'voice-vendor' (registered: zenmux).");
  });
});

describe('makeLlmProviderStrategy()', () => {
  it("should build each provider through its own transport's adapter under its own id", () => {
    const { adapters } = standardAdapters();
    const built = makeLlmProviderStrategies({ providers: [ZENMUX, ROUTER], adapters });

    expect(built.map((strategy) => strategy.id)).toEqual(['zenmux', 'openrouter']);
    expect(built.map((strategy) => strategy.kind)).toEqual(['openai', 'openrouter']);
  });

  it('should keep two providers on one transport as two strategies', () => {
    const { adapters } = standardAdapters();
    const strategies = makeLlmStrategyRegistry(makeLlmProviderStrategies({ providers: [ZENMUX, LOCAL], adapters }));

    expect(strategies.size).toBe(2);
    expect(strategies.values().findLast((strategy) => llmStrategyKind(strategy) === 'openai')?.id).toBe('local');
  });

  it('should hand the shared options to the adapter only when set', () => {
    const { adapters, openai } = standardAdapters();
    const visionByModel = { 'x/y-flash': true };
    const reasoningOffByModel = { 'x/y-flash': 'omit' as const };

    makeLlmProviderStrategy({ provider: LOCAL, adapters, defaultModel: 'x/y-flash', maxOutputTokens: 4096, timeoutMs: 60_000, visionByModel, reasoningOffByModel });
    makeLlmProviderStrategy({ provider: LOCAL, adapters });

    expect(openai.received[0]).toEqual({ provider: LOCAL, baseUrl: LOCAL_URL, defaultModel: 'x/y-flash', maxOutputTokens: 4096, timeoutMs: 60_000, visionByModel, reasoningOffByModel });

    const unset = openai.received[1];
    expect(unset).toEqual({ provider: LOCAL, baseUrl: LOCAL_URL });

    for (const key of ['defaultModel', 'maxOutputTokens', 'timeoutMs', 'visionByModel', 'reasoningOffByModel', 'fetch']) {
      expect(unset).not.toHaveProperty(key);
    }
  });

  it("should hand the provider's account facets to the completion adapter", () => {
    const { adapters, openai } = standardAdapters();
    makeLlmProviderStrategy({ provider: ZENMUX, adapters });
    makeLlmProviderStrategy({ provider: LOCAL, adapters });

    const [zenmuxConfig, localConfig] = openai.received;
    expect(zenmuxConfig.costBasis).toBe('list');
    expect(zenmuxConfig.providerStatusSource?.providerId).toBe('zenmux');
    expect(zenmuxConfig.credentialProbe).toBeTypeOf('function');

    expect(localConfig).not.toHaveProperty('costBasis');
    expect(localConfig).not.toHaveProperty('providerStatusSource');
    expect(localConfig).not.toHaveProperty('credentialProbe');
  });

  it("should route the fetch seam into the account's credential probe", async () => {
    const { adapters } = standardAdapters();
    const { fetch, urls } = fakeFetch();
    const strategy = makeLlmProviderStrategy({ provider: ZENMUX, adapters, fetch });

    await strategy.credentialProbe?.();
    expect(urls).toEqual([`${ZENMUX_URL}/chat/completions`]);
  });

  it('should be inert: building makes no fetch call and no completion call', () => {
    const { adapters, openai, openrouter } = standardAdapters();
    const { fetch, urls } = fakeFetch();

    makeLlmProviderStrategies({ providers: [ZENMUX, ENV_DEFAULT, BARE_OPENAI, LOCAL, ROUTER], adapters, fetch });

    expect(urls).toEqual([]);
    expect(openai.calls.complete).toBe(0);
    expect(openrouter.calls.complete).toBe(0);
  });

  it('should fail loud on an unregistered transport', () => {
    const { adapters } = standardAdapters();
    expect(() => makeLlmProviderStrategy({ provider: { id: 'box', transport: 'vllm', apiKeyEnv: 'BOX_API_KEY', apiKey: 'box-key' }, adapters })).toThrow("provider 'box': no completion adapter is registered for 'vllm' (registered: openai, openrouter).");
  });

  it('should fail loud when an adapter mints the strategy under another id', () => {
    const adapters = makeLlmAdapterRegistry([fakeCompletionAdapter('openai', OPENAI_URL, 'openai').adapter]);
    expect(() => makeLlmProviderStrategy({ provider: LOCAL, adapters })).toThrow(/minted strategy id 'openai'/);
  });
});

describe('makeLlmProviderStrategies()', () => {
  it('should build nothing from no providers, and follow provider order', () => {
    const { adapters } = standardAdapters();

    expect(makeLlmProviderStrategies({ providers: undefined, adapters })).toEqual([]);
    expect(makeLlmProviderStrategies({ providers: [], adapters })).toEqual([]);
    expect(makeLlmProviderStrategies({ providers: [ROUTER, LOCAL, ZENMUX], adapters }).map((strategy) => strategy.id)).toEqual(['openrouter', 'local', 'zenmux']);
  });
});
