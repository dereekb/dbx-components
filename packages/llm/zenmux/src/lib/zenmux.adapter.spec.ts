import {
  isLlmAbortError,
  llmDecisionStrategyKinds,
  llmModelConfigListsOf,
  llmNoulQuestion,
  llmProviderDecisionRouteOf,
  makeLlmAdapterRegistry,
  makeLlmDecisionStrategies,
  makeLlmProviderStrategy,
  resolveLlmProviderAccount,
  type LlmAdapter,
  type LlmCompletionAdapter,
  type LlmCompletionAdapterConfig,
  type LlmProviderConfig
} from '@dereekb/llm';
import { makeLlmSystemOneWireFake } from '@dereekb/llm/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { makeZenmuxLlmAdapters } from './zenmux.adapter';
import { DEFAULT_ZENMUX_BASE_URL, ZENMUX_DECISION_ROUTE, ZENMUX_PROVIDER_ID } from './zenmux.constants';

const MODEL = 'typesafe/jev-1.14';

const ZENMUX: LlmProviderConfig = { id: 'zenmux', transport: 'openai', baseUrl: DEFAULT_ZENMUX_BASE_URL, apiKeyEnv: 'ZENMUX_API_KEY', apiKey: 'sk-zen', metering: 'zenmux', decision: 'zenmux' };
const ZENMUX_PAYG: LlmProviderConfig = { id: 'zenmux-payg', transport: 'openai', baseUrl: DEFAULT_ZENMUX_BASE_URL, apiKeyEnv: 'ZENMUX_PAYG_API_KEY', apiKey: 'payg-key', metering: 'zenmux', decision: 'zenmux' };
const ENV_DEFAULT: LlmProviderConfig = { id: 'env-default', transport: 'openai', baseUrl: DEFAULT_ZENMUX_BASE_URL, apiKeyEnv: 'OPENAI_API_KEY', apiKey: 'sk-env' };
const PROXY: LlmProviderConfig = { id: 'proxy', transport: 'openai', baseUrl: 'http://192.168.1.50:8000/v1', apiKeyEnv: 'PROXY_API_KEY', apiKey: 'sk-proxy', metering: 'zenmux' };
const LOCAL: LlmProviderConfig = { id: 'local', transport: 'openai', baseUrl: DEFAULT_ZENMUX_BASE_URL, apiKeyEnv: 'LOCAL_API_KEY', apiKey: 'sk-local', metering: 'none' };
const LOOKALIKE: LlmProviderConfig = { id: 'lookalike', transport: 'openai', baseUrl: 'https://zenmux.ai.example.com/api/v1', apiKeyEnv: 'LOOKALIKE_API_KEY', apiKey: 'sk-look' };

/**
 * A completion adapter that records every config it receives and mints a strategy under the provider's id.
 *
 * @returns The adapter and the configs it received.
 */
function fakeOpenAiCompletion() {
  const received: LlmCompletionAdapterConfig[] = [];
  const adapter: LlmCompletionAdapter = {
    facet: 'completion',
    kind: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    make: (config) => {
      received.push(config);
      return { id: config.provider.id, kind: 'openai', describe: `openai at ${config.baseUrl ?? '(default)'}`, caching: 'none', complete: () => Promise.reject(new Error('not called')) };
    }
  };

  return { adapter, received };
}

interface Recorded {
  readonly url: string;
  readonly method: string;
  readonly auth?: string;
}

/**
 * A fetch seam that records every request and answers each with the given status and body.
 *
 * @param status - The status to answer.
 * @param body - The body to answer.
 * @returns The seam and its record.
 */
function recordingFetch(status = 404, body = '{"success":false,"message":"Not Found","data":null}'): { readonly fetch: ConfiguredFetch; readonly calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetchImpl: ConfiguredFetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET', auth: new Headers(init?.headers).get('Authorization') ?? undefined });
    const response = new Response(body, { status: status });
    return response;
  };
  return { fetch: fetchImpl, calls };
}

function registryOf(adapters: ReadonlyArray<LlmAdapter>) {
  return makeLlmAdapterRegistry([fakeOpenAiCompletion().adapter, ...adapters]);
}

const ADAPTERS = registryOf(makeZenmuxLlmAdapters({ managementApiKey: 'mgmt-key', billApiKey: 'payg-key' }));

describe('makeZenmuxLlmAdapters()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('shape', () => {
    it('returns the four adapters in facet order', () => {
      expect(makeZenmuxLlmAdapters().map((adapter) => [adapter.facet, adapter.kind])).toEqual([
        ['decision', 'zenmux'],
        ['metering', 'zenmux'],
        ['bill', 'zenmux'],
        ['credentialProbe', 'zenmux']
      ]);
    });

    it('registers without a collision and feeds the config schema lists', () => {
      expect(ADAPTERS.values()).toHaveLength(5);
      expect(llmModelConfigListsOf(ADAPTERS)).toEqual({ transports: ['openai'], meterings: ['zenmux'], decisionRoutes: ['zenmux'] });
      expect([...llmDecisionStrategyKinds(ADAPTERS)]).toEqual(['zenmux-systemone']);
    });

    it('pins the ZenMux constants', () => {
      expect(ZENMUX_PROVIDER_ID).toBe('zenmux');
      expect(ZENMUX_DECISION_ROUTE).toBe('zenmux');
      expect(DEFAULT_ZENMUX_BASE_URL).toBe('https://zenmux.ai/api/v1');
    });
  });

  describe('account', () => {
    it('resolves a declared ZenMux provider onto the list basis and the ZenMux status source', async () => {
      const seam = recordingFetch(200, '{"success":true,"data":{}}');
      const account = resolveLlmProviderAccount({ provider: ZENMUX, adapters: ADAPTERS, fetch: seam.fetch });

      expect(account.metering).toBe('zenmux');
      expect(account.costBasis).toBe('list');
      expect(account.providerStatusSource?.providerId).toBe('zenmux');

      await account.providerStatusSource?.read();

      expect(seam.calls.map((call) => call.url)).toEqual(['https://zenmux.ai/api/v1/management/subscription/detail', 'https://zenmux.ai/api/v1/management/payg/balance', 'https://zenmux.ai/api/v1/management/flow_rate']);
      expect(seam.calls.every((call) => call.auth === 'Bearer mgmt-key')).toBe(true);
    });

    it('reads bills with the pay-as-you-go key, else the provider’s own key', async () => {
      const withBillKey = recordingFetch();
      const withoutBillKey = recordingFetch();
      const blankBillKey = recordingFetch();

      await resolveLlmProviderAccount({ provider: ZENMUX, adapters: ADAPTERS, fetch: withBillKey.fetch }).billReader?.read('g1');
      await resolveLlmProviderAccount({ provider: ZENMUX, adapters: registryOf(makeZenmuxLlmAdapters()), fetch: withoutBillKey.fetch }).billReader?.read('g1');
      await resolveLlmProviderAccount({ provider: ZENMUX, adapters: registryOf(makeZenmuxLlmAdapters({ billApiKey: '  ' })), fetch: blankBillKey.fetch }).billReader?.read('g1');

      expect(withBillKey.calls).toEqual([{ url: 'https://zenmux.ai/api/v1/management/generation?id=g1', method: 'GET', auth: 'Bearer payg-key' }]);
      expect(withoutBillKey.calls[0]?.auth).toBe('Bearer sk-zen');
      expect(blankBillKey.calls[0]?.auth).toBe('Bearer sk-zen');
    });

    it('probes the provider’s own key at its inference URL', async () => {
      const seam = recordingFetch(404, '{"error":{"type":"invalid_model","message":"Requested model is not valid"}}');
      const health = await resolveLlmProviderAccount({ provider: ZENMUX, adapters: ADAPTERS, fetch: seam.fetch }).credentialProbe?.();

      expect(health).toEqual({ ready: true, issues: [] });
      expect(seam.calls).toEqual([{ url: 'https://zenmux.ai/api/v1/chat/completions', method: 'POST', auth: 'Bearer sk-zen' }]);
    });

    it('reports a keyless provider unready without a request', async () => {
      const seam = recordingFetch();
      const health = await resolveLlmProviderAccount({ provider: { ...ZENMUX, apiKey: '' }, adapters: ADAPTERS, fetch: seam.fetch }).credentialProbe?.();

      expect(health).toEqual({ ready: false, issues: [{ severity: 'error', message: 'no apiKey configured' }] });
      expect(seam.calls).toEqual([]);
    });

    it('infers ZenMux for an undeclared provider at the ZenMux URL, and nothing for a look-alike or a declared none', () => {
      expect(resolveLlmProviderAccount({ provider: ENV_DEFAULT, adapters: ADAPTERS }).metering).toBe('zenmux');

      for (const provider of [LOOKALIKE, LOCAL]) {
        const account = resolveLlmProviderAccount({ provider, adapters: ADAPTERS });
        expect(account.metering).toBe('none');
        expect(account.providerStatusSource).toBeUndefined();
        expect(account.billReader).toBeUndefined();
        expect(account.credentialProbe).toBeUndefined();
        expect(account.costBasis).toBeUndefined();
      }
    });

    it('reads a proxied provider’s account at ZenMux while probing the proxy', async () => {
      const seam = recordingFetch(404, '{"error":{"type":"invalid_model","message":"Requested model is not valid"}}');
      const account = resolveLlmProviderAccount({ provider: PROXY, adapters: ADAPTERS, fetch: seam.fetch });

      await account.providerStatusSource?.read();
      await account.billReader?.read('g1');
      await account.credentialProbe?.();

      expect(seam.calls.map((call) => call.url)).toEqual([
        'https://zenmux.ai/api/v1/management/subscription/detail',
        'https://zenmux.ai/api/v1/management/payg/balance',
        'https://zenmux.ai/api/v1/management/flow_rate',
        'https://zenmux.ai/api/v1/management/generation?id=g1',
        'http://192.168.1.50:8000/v1/chat/completions'
      ]);
    });

    it('reports a missing management key as unavailable, naming the default or the host’s label', async () => {
      const unnamed = await resolveLlmProviderAccount({ provider: ZENMUX, adapters: registryOf(makeZenmuxLlmAdapters()) }).providerStatusSource?.read();
      const named = await resolveLlmProviderAccount({ provider: ZENMUX, adapters: registryOf(makeZenmuxLlmAdapters({ managementApiKeyEnv: 'HOST_ZENMUX_MANAGEMENT_KEY' })) }).providerStatusSource?.read();

      expect(unnamed?.available).toBe(false);
      expect(unnamed?.issues[0]?.message).toContain('ZENMUX_MANAGEMENT_API_KEY');
      expect(named?.issues[0]?.message).toContain('HOST_ZENMUX_MANAGEMENT_KEY');
    });

    // Ported from the retired registry-free `zenmuxCostBasisFor`: the core resolver is the one cost-basis answer.
    it("costs a provider that DECLARES zenmux metering at ZenMux's list basis, whatever its URL", () => {
      expect(resolveLlmProviderAccount({ provider: ZENMUX, adapters: ADAPTERS }).costBasis).toBe('list');
      expect(resolveLlmProviderAccount({ provider: PROXY, adapters: ADAPTERS }).costBasis).toBe('list');
    });

    it('gives no cost basis to a provider that declares no metering, even at the ZenMux URL', () => {
      expect(resolveLlmProviderAccount({ provider: LOCAL, adapters: ADAPTERS }).costBasis).toBeUndefined();
    });

    it('falls back to the URL only when nothing was declared', () => {
      expect(resolveLlmProviderAccount({ provider: ENV_DEFAULT, adapters: ADAPTERS }).costBasis).toBe('list');
      expect(resolveLlmProviderAccount({ provider: { ...ENV_DEFAULT, baseUrl: 'https://api.openai.com/v1' }, adapters: ADAPTERS }).costBasis).toBeUndefined();
      expect(resolveLlmProviderAccount({ provider: LOOKALIKE, adapters: ADAPTERS }).costBasis).toBeUndefined();
    });
  });

  describe('completion wiring', () => {
    it('hands a ZenMux provider’s completion adapter the list basis, a status source and a probe — and a local one none', () => {
      const completion = fakeOpenAiCompletion();
      const adapters = makeLlmAdapterRegistry([completion.adapter, ...makeZenmuxLlmAdapters({ managementApiKey: 'mgmt-key' })]);

      makeLlmProviderStrategy({ provider: ZENMUX, adapters });
      makeLlmProviderStrategy({ provider: LOCAL, adapters });

      expect(completion.received[0]?.costBasis).toBe('list');
      expect(completion.received[0]?.providerStatusSource?.providerId).toBe('zenmux');
      expect(completion.received[0]?.credentialProbe).toBeDefined();
      expect(completion.received[1]?.costBasis).toBeUndefined();
      expect(completion.received[1]?.providerStatusSource).toBeUndefined();
      expect(completion.received[1]?.credentialProbe).toBeUndefined();
    });
  });

  describe('decisions', () => {
    it('never derives the ZenMux route: a provider must declare it', () => {
      expect(llmProviderDecisionRouteOf({ provider: ENV_DEFAULT, adapters: ADAPTERS })).toBe('none');
    });

    it('builds one ready ZenMux strategy per declaring provider', async () => {
      const registry = makeLlmDecisionStrategies({ providers: [ZENMUX, ZENMUX_PAYG, ENV_DEFAULT], adapters: ADAPTERS });
      const strategies = registry.values();

      expect(strategies.map((strategy) => strategy.id)).toEqual(['zenmux', 'zenmux-payg']);
      expect(strategies.every((strategy) => strategy.kind === 'zenmux-systemone')).toBe(true);
      expect(strategies[0]?.describe).toBe('ZenMux System One at https://zenmux.ai/api/v1/systemone');
      expect(await strategies[0]?.healthCheck?.()).toEqual({ ready: true, issues: [] });
    });

    it('decides over the global fetch with the provider’s own key', async () => {
      const fake = makeLlmSystemOneWireFake({ respond: { body: { answers: { is_urgent: { type: 'noul', noul: 0.5 } } } } });
      vi.stubGlobal('fetch', fake.fetch);

      const strategy = makeLlmDecisionStrategies({ providers: [ZENMUX], adapters: ADAPTERS }).values()[0];
      const result = await strategy?.decide({ state: 'state', questions: { is_urgent: llmNoulQuestion('Urgent?') }, model: MODEL });

      expect(result?.answers.is_urgent.noul).toBe(0.5);
      expect(fake.requests.map((request) => ({ url: request.url, auth: request.init.headers['Authorization'] }))).toEqual([{ url: 'https://zenmux.ai/api/v1/systemone', auth: 'Bearer sk-zen' }]);
    });

    it('aborts a hanging route at the configured timeout', async () => {
      vi.stubGlobal('fetch', makeLlmSystemOneWireFake({ respond: 'hang' }).fetch);

      const strategy = makeLlmDecisionStrategies({ providers: [ZENMUX], adapters: ADAPTERS, timeoutMs: 5 }).values()[0];
      const thrown = await strategy?.decide({ state: 'state', questions: { is_urgent: llmNoulQuestion('Urgent?') }, model: MODEL }).catch((error: unknown) => error);

      expect(isLlmAbortError(thrown)).toBe(true);
    });
  });
});
