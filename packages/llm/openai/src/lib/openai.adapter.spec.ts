import { describe, expect, it } from 'vitest';
import { llmModelConfigListsOf, makeLlmAdapterRegistry, makeLlmProviderStrategy, type LlmAdapterInput, type LlmCompletionAdapterConfig, type LlmCredentialProbeAdapter, type LlmCredentialProbeFetch, type LlmMeteringAdapter, type LlmProviderConfig } from '@dereekb/llm';
import { LLM_OPENAI_ADAPTERS, LLM_OPENAI_COMPLETION_ADAPTER, llmOpenAiStrategyConfigOf } from './openai.adapter';

const PROVIDER: LlmProviderConfig = { id: 'gateway-a', transport: 'openai', apiKeyEnv: 'GATEWAY_KEY', apiKey: 'k' };

function recordingFetch() {
  const calls: string[] = [];
  const fetch: LlmCredentialProbeFetch = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, text: async () => '{"data":[]}' };
  };
  return { fetch, calls };
}

describe('LLM_OPENAI_COMPLETION_ADAPTER', () => {
  it('declares the openai completion transport and its default base URL', () => {
    expect(LLM_OPENAI_COMPLETION_ADAPTER).toMatchObject({ facet: 'completion', kind: 'openai', defaultBaseUrl: 'https://api.openai.com/v1' });
    expect(LLM_OPENAI_ADAPTERS).toEqual([LLM_OPENAI_COMPLETION_ADAPTER]);
  });

  it('registers through the adapter registry and lists transport openai', () => {
    const adapters = makeLlmAdapterRegistry(LLM_OPENAI_ADAPTERS);
    expect(llmModelConfigListsOf(adapters).transports).toEqual(['openai']);
  });
});

describe('llmOpenAiStrategyConfigOf()', () => {
  it('maps a bare provider onto exactly its id and key', () => {
    expect(llmOpenAiStrategyConfigOf({ provider: PROVIDER })).toEqual({ id: 'gateway-a', apiKey: 'k' });
  });

  it('maps every input', () => {
    const { fetch } = recordingFetch();
    const providerStatusSource = { providerId: 'meter', read: async () => ({ providerId: 'meter', available: true, windows: [], issues: [] }) };
    const credentialProbe = async () => ({ ready: true, issues: [] });
    const config: LlmCompletionAdapterConfig = {
      provider: { ...PROVIDER, tokenLimitParam: 'max_completion_tokens', reasoningOff: 'effort-minimal', usageAccounting: true },
      baseUrl: 'https://zenmux.ai/api/v1',
      fetch,
      defaultModel: 'vendor/model-flash',
      maxOutputTokens: 2048,
      timeoutMs: 30_000,
      visionByModel: { 'vendor/model-flash': true },
      reasoningOffByModel: { 'vendor/model-pro': 'omit' },
      costBasis: 'list',
      providerStatusSource,
      credentialProbe
    };

    expect(llmOpenAiStrategyConfigOf(config)).toEqual({
      id: 'gateway-a',
      apiKey: 'k',
      baseUrl: 'https://zenmux.ai/api/v1',
      defaultModel: 'vendor/model-flash',
      maxOutputTokens: 2048,
      timeoutMs: 30_000,
      tokenLimitParam: 'max_completion_tokens',
      reasoningOffEncoding: 'effort-minimal',
      reasoningOffByModel: { 'vendor/model-pro': 'omit' },
      visionByModel: { 'vendor/model-flash': true },
      usageAccounting: true,
      costBasis: 'list',
      providerStatusSource,
      credentialProbeSource: credentialProbe,
      probeFetch: fetch
    });
  });
});

describe('makeLlmProviderStrategy() with LLM_OPENAI_ADAPTERS', () => {
  it('builds the openai strategy under the provider id', async () => {
    const { fetch, calls } = recordingFetch();
    const strategy = makeLlmProviderStrategy({ provider: PROVIDER, adapters: makeLlmAdapterRegistry(LLM_OPENAI_ADAPTERS), defaultModel: 'vendor/model-flash', fetch });

    expect(strategy.id).toBe('gateway-a');
    expect(strategy.kind).toBe('openai');
    expect(strategy.caching).toBe('auto-prefix');
    await expect(strategy.credentialProbe?.()).resolves.toEqual({ ready: true, issues: [] });
    expect(calls).toEqual(['https://api.openai.com/v1/models']);
  });

  it("wires an account's metering and credential probe adapters through the openai strategy", async () => {
    const { fetch, calls } = recordingFetch();
    const probed: LlmAdapterInput[] = [];
    const metering: LlmMeteringAdapter = {
      facet: 'metering',
      kind: 'zenmux',
      isAccountBaseUrl: (url) => new URL(url).hostname === 'zenmux.ai',
      make: () => ({ providerId: 'zenmux', read: async () => ({ providerId: 'zenmux', available: true, windows: [], issues: [] }) })
    };
    const probe: LlmCredentialProbeAdapter = {
      facet: 'credentialProbe',
      kind: 'zenmux',
      make: (input) => {
        probed.push(input);
        return async () => ({ ready: true, issues: [{ severity: 'warning', message: 'probed by the account' }] });
      }
    };
    const adapters = makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, metering, probe]);
    const strategy = makeLlmProviderStrategy({ provider: { ...PROVIDER, baseUrl: 'https://zenmux.ai/api/v1' }, adapters, defaultModel: 'vendor/model-flash', fetch });

    expect(strategy.providerStatusId).toBe('zenmux');
    await expect(strategy.providerStatus?.()).resolves.toMatchObject({ providerId: 'zenmux', available: true });
    await expect(strategy.credentialProbe?.()).resolves.toEqual({ ready: true, issues: [{ severity: 'warning', message: 'probed by the account' }] });
    expect(probed).toHaveLength(1);
    expect(calls).toEqual([]);
  });
});
