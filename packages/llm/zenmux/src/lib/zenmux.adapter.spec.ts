import { isLlmAbortError, readLlmDecisionStrategyKinds, readLlmModelConfigLists, llmNoulQuestion, resolveLlmProviderDecisionRoute, makeLlmAdapterRegistry, makeLlmDecisionStrategies, makeLlmProviderStrategy, resolveLlmProviderAccount, type LlmAdapter, type LlmProviderConfig } from '@dereekb/llm';
import { makeLlmCompletionAdapterFake, makeLlmFetchFake, makeLlmSystemOneWireFake, readLlmFetchFakeHeader, type LlmFetchFake } from '@dereekb/llm/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeLlmZenmuxAdapters } from './zenmux.adapter';
import { DEFAULT_LLM_ZENMUX_BASE_URL, LLM_ZENMUX_DECISION_ROUTE, LLM_ZENMUX_PROVIDER_ID } from './zenmux.constants';

const MODEL = 'typesafe/jev-1.14';

const ZENMUX: LlmProviderConfig = { id: 'zenmux', transport: 'openai', baseUrl: DEFAULT_LLM_ZENMUX_BASE_URL, apiKeyEnv: 'ZENMUX_API_KEY', apiKey: 'sk-zen', metering: 'zenmux', decision: 'zenmux' };
const ZENMUX_PAYG: LlmProviderConfig = { id: 'zenmux-payg', transport: 'openai', baseUrl: DEFAULT_LLM_ZENMUX_BASE_URL, apiKeyEnv: 'ZENMUX_PAYG_API_KEY', apiKey: 'payg-key', metering: 'zenmux', decision: 'zenmux' };
const ENV_DEFAULT: LlmProviderConfig = { id: 'env-default', transport: 'openai', baseUrl: DEFAULT_LLM_ZENMUX_BASE_URL, apiKeyEnv: 'OPENAI_API_KEY', apiKey: 'sk-env' };
const PROXY: LlmProviderConfig = { id: 'proxy', transport: 'openai', baseUrl: 'http://192.168.1.50:8000/v1', apiKeyEnv: 'PROXY_API_KEY', apiKey: 'sk-proxy', metering: 'zenmux' };
const LOCAL: LlmProviderConfig = { id: 'local', transport: 'openai', baseUrl: DEFAULT_LLM_ZENMUX_BASE_URL, apiKeyEnv: 'LOCAL_API_KEY', apiKey: 'sk-local', metering: 'none' };
const LOOKALIKE: LlmProviderConfig = { id: 'lookalike', transport: 'openai', baseUrl: 'https://zenmux.ai.example.com/api/v1', apiKeyEnv: 'LOOKALIKE_API_KEY', apiKey: 'sk-look' };

/**
 * The answer every seam gives unless a case names its own: ZenMux's not-found envelope.
 */
const NOT_FOUND = { status: 404, body: '{"success":false,"message":"Not Found","data":null}' };

/**
 * The url, method and bearer of every request a seam received.
 *
 * @param seam - The fetch fake.
 * @returns One entry per request.
 */
function recordedOf(seam: LlmFetchFake) {
  return seam.requests.map((request) => ({ url: request.url, method: request.init.method, auth: readLlmFetchFakeHeader(request, 'Authorization') }));
}

function registryOf(adapters: ReadonlyArray<LlmAdapter>) {
  return makeLlmAdapterRegistry([makeLlmCompletionAdapterFake({ kind: 'openai', defaultBaseUrl: 'https://api.openai.com/v1' }).adapter, ...adapters]);
}

const ADAPTERS = registryOf(makeLlmZenmuxAdapters({ managementApiKey: 'mgmt-key', billApiKey: 'payg-key' }));

describe('makeLlmZenmuxAdapters()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('shape', () => {
    it('returns the four adapters in facet order', () => {
      expect(makeLlmZenmuxAdapters().map((adapter) => [adapter.facet, adapter.kind])).toEqual([
        ['decision', 'zenmux'],
        ['metering', 'zenmux'],
        ['bill', 'zenmux'],
        ['credentialProbe', 'zenmux']
      ]);
    });

    it('registers without a collision and feeds the config schema lists', () => {
      expect(ADAPTERS.values()).toHaveLength(5);
      expect(readLlmModelConfigLists(ADAPTERS)).toEqual({ transports: ['openai'], meterings: ['zenmux'], decisionRoutes: ['zenmux'] });
      expect([...readLlmDecisionStrategyKinds(ADAPTERS)]).toEqual(['zenmux-systemone']);
    });

    it('pins the ZenMux constants', () => {
      expect(LLM_ZENMUX_PROVIDER_ID).toBe('zenmux');
      expect(LLM_ZENMUX_DECISION_ROUTE).toBe('zenmux');
      expect(DEFAULT_LLM_ZENMUX_BASE_URL).toBe('https://zenmux.ai/api/v1');
    });
  });

  describe('account', () => {
    it('resolves a declared ZenMux provider onto the list basis and the ZenMux status source', async () => {
      const seam = makeLlmFetchFake({ status: 200, body: '{"success":true,"data":{}}' });
      const account = resolveLlmProviderAccount({ provider: ZENMUX, adapters: ADAPTERS, fetch: seam.fetch });

      expect(account.metering).toBe('zenmux');
      expect(account.costBasis).toBe('list');
      expect(account.providerStatusSource?.providerId).toBe('zenmux');

      await account.providerStatusSource?.read();

      expect(recordedOf(seam).map((call) => call.url)).toEqual(['https://zenmux.ai/api/v1/management/subscription/detail', 'https://zenmux.ai/api/v1/management/payg/balance', 'https://zenmux.ai/api/v1/management/flow_rate']);
      expect(recordedOf(seam).every((call) => call.auth === 'Bearer mgmt-key')).toBe(true);
    });

    it('reads bills with the pay-as-you-go key, else the provider’s own key', async () => {
      const withBillKey = makeLlmFetchFake(NOT_FOUND);
      const withoutBillKey = makeLlmFetchFake(NOT_FOUND);
      const blankBillKey = makeLlmFetchFake(NOT_FOUND);

      await resolveLlmProviderAccount({ provider: ZENMUX, adapters: ADAPTERS, fetch: withBillKey.fetch }).billReader?.read('g1');
      await resolveLlmProviderAccount({ provider: ZENMUX, adapters: registryOf(makeLlmZenmuxAdapters()), fetch: withoutBillKey.fetch }).billReader?.read('g1');
      await resolveLlmProviderAccount({ provider: ZENMUX, adapters: registryOf(makeLlmZenmuxAdapters({ billApiKey: '  ' })), fetch: blankBillKey.fetch }).billReader?.read('g1');

      expect(recordedOf(withBillKey)).toEqual([{ url: 'https://zenmux.ai/api/v1/management/generation?id=g1', method: 'GET', auth: 'Bearer payg-key' }]);
      expect(recordedOf(withoutBillKey)[0]?.auth).toBe('Bearer sk-zen');
      expect(recordedOf(blankBillKey)[0]?.auth).toBe('Bearer sk-zen');
    });

    it('probes the provider’s own key at its inference URL', async () => {
      const seam = makeLlmFetchFake({ status: 404, body: '{"error":{"type":"invalid_model","message":"Requested model is not valid"}}' });
      const health = await resolveLlmProviderAccount({ provider: ZENMUX, adapters: ADAPTERS, fetch: seam.fetch }).credentialProbe?.();

      expect(health).toEqual({ ready: true, issues: [] });
      expect(recordedOf(seam)).toEqual([{ url: 'https://zenmux.ai/api/v1/chat/completions', method: 'POST', auth: 'Bearer sk-zen' }]);
    });

    it('reports a keyless provider unready without a request', async () => {
      const seam = makeLlmFetchFake(NOT_FOUND);
      const health = await resolveLlmProviderAccount({ provider: { ...ZENMUX, apiKey: '' }, adapters: ADAPTERS, fetch: seam.fetch }).credentialProbe?.();

      expect(health).toEqual({ ready: false, issues: [{ severity: 'error', message: 'no apiKey configured' }] });
      expect(recordedOf(seam)).toEqual([]);
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
      const seam = makeLlmFetchFake({ status: 404, body: '{"error":{"type":"invalid_model","message":"Requested model is not valid"}}' });
      const account = resolveLlmProviderAccount({ provider: PROXY, adapters: ADAPTERS, fetch: seam.fetch });

      await account.providerStatusSource?.read();
      await account.billReader?.read('g1');
      await account.credentialProbe?.();

      expect(recordedOf(seam).map((call) => call.url)).toEqual([
        'https://zenmux.ai/api/v1/management/subscription/detail',
        'https://zenmux.ai/api/v1/management/payg/balance',
        'https://zenmux.ai/api/v1/management/flow_rate',
        'https://zenmux.ai/api/v1/management/generation?id=g1',
        'http://192.168.1.50:8000/v1/chat/completions'
      ]);
    });

    it('reports a missing management key as unavailable, naming the default or the host’s label', async () => {
      const unnamed = await resolveLlmProviderAccount({ provider: ZENMUX, adapters: registryOf(makeLlmZenmuxAdapters()) }).providerStatusSource?.read();
      const named = await resolveLlmProviderAccount({ provider: ZENMUX, adapters: registryOf(makeLlmZenmuxAdapters({ managementApiKeyEnv: 'HOST_ZENMUX_MANAGEMENT_KEY' })) }).providerStatusSource?.read();

      expect(unnamed?.available).toBe(false);
      expect(unnamed?.issues[0]?.message).toContain('ZENMUX_MANAGEMENT_API_KEY');
      expect(named?.issues[0]?.message).toContain('HOST_ZENMUX_MANAGEMENT_KEY');
    });

    // The core resolver is the one cost-basis answer.
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
      const completion = makeLlmCompletionAdapterFake({ kind: 'openai', defaultBaseUrl: 'https://api.openai.com/v1' });
      const adapters = makeLlmAdapterRegistry([completion.adapter, ...makeLlmZenmuxAdapters({ managementApiKey: 'mgmt-key' })]);

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
      expect(resolveLlmProviderDecisionRoute({ provider: ENV_DEFAULT, adapters: ADAPTERS })).toBe('none');
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
