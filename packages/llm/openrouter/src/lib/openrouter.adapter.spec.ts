import { describe, expect, it } from 'vitest';
import { makeLlmFetchFake } from '@dereekb/llm/test';
import { readLlmDecisionStrategyKinds, readLlmModelConfigLists, toLlmSystemOneDecisionStrategyConfig, makeLlmAdapterRegistry, makeLlmDecisionStrategies, makeLlmProviderStrategy, type LlmCompletionAdapterConfig, type LlmProviderConfig } from '@dereekb/llm';
import { toLlmOpenAiCompatibleChatStrategyConfig } from '@dereekb/llm/openai';
import { LLM_OPENROUTER_ADAPTERS, LLM_OPENROUTER_COMPLETION_ADAPTER, LLM_OPENROUTER_DECISION_ADAPTER } from './openrouter.adapter';

const ROUTER: LlmProviderConfig = { id: 'router-a', transport: 'openrouter', apiKeyEnv: 'ROUTER_KEY', apiKey: 'or-key' };

describe('LLM_OPENROUTER_ADAPTERS', () => {
  it('declares the completion and decision adapters', () => {
    expect(LLM_OPENROUTER_COMPLETION_ADAPTER).toMatchObject({ facet: 'completion', kind: 'openrouter', defaultBaseUrl: 'https://openrouter.ai/api/v1' });
    expect(LLM_OPENROUTER_DECISION_ADAPTER).toMatchObject({ facet: 'decision', kind: 'openrouter', strategyKind: 'openrouter-systemone', transports: ['openrouter'] });
    expect(LLM_OPENROUTER_ADAPTERS).toEqual([LLM_OPENROUTER_COMPLETION_ADAPTER, LLM_OPENROUTER_DECISION_ADAPTER]);
  });

  it('registers the openrouter transport and decision route', () => {
    const adapters = makeLlmAdapterRegistry(LLM_OPENROUTER_ADAPTERS);
    const lists = readLlmModelConfigLists(adapters);

    expect(lists.transports).toEqual(['openrouter']);
    expect(lists.decisionRoutes).toEqual(['openrouter']);
    expect(readLlmDecisionStrategyKinds(adapters).has('openrouter-systemone')).toBe(true);
  });
});

describe('toLlmOpenAiCompatibleChatStrategyConfig() (the OpenRouter completion mapping)', () => {
  it('maps a bare provider onto exactly its id and key', () => {
    expect(toLlmOpenAiCompatibleChatStrategyConfig({ provider: ROUTER })).toEqual({ id: 'router-a', apiKey: 'or-key' });
  });

  it('maps every input and ignores the knobs the OpenRouter wire spells one way', () => {
    const { fetch } = makeLlmFetchFake({ body: '{"data":{}}' });
    const providerStatusSource = { providerId: 'meter', read: async () => ({ providerId: 'meter', available: true, windows: [], issues: [] }) };
    const credentialProbe = async () => ({ ready: true, issues: [] });
    const config: LlmCompletionAdapterConfig = {
      provider: { ...ROUTER, tokenLimitParam: 'max_completion_tokens', reasoningOff: 'effort-minimal', usageAccounting: false },
      baseUrl: 'https://gateway.test/api/v1',
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

    expect(toLlmOpenAiCompatibleChatStrategyConfig(config)).toEqual({
      id: 'router-a',
      apiKey: 'or-key',
      baseUrl: 'https://gateway.test/api/v1',
      defaultModel: 'vendor/model-flash',
      maxOutputTokens: 2048,
      timeoutMs: 30_000,
      visionByModel: { 'vendor/model-flash': true },
      costBasis: 'list',
      providerStatusSource,
      credentialProbeSource: credentialProbe,
      probeFetch: fetch
    });
  });
});

describe('toLlmSystemOneDecisionStrategyConfig() (the OpenRouter decision mapping)', () => {
  it('maps a bare provider onto exactly its id and key', () => {
    expect(toLlmSystemOneDecisionStrategyConfig({ provider: ROUTER })).toEqual({ id: 'router-a', apiKey: 'or-key' });
  });

  it('maps every input', () => {
    const { fetch } = makeLlmFetchFake({ body: '{"data":{}}' });
    expect(toLlmSystemOneDecisionStrategyConfig({ provider: ROUTER, baseUrl: 'https://gateway.test/api/v1', timeoutMs: 4_000, fetch })).toEqual({ id: 'router-a', apiKey: 'or-key', baseUrl: 'https://gateway.test/api/v1', timeoutMs: 4_000, probeFetch: fetch });
  });
});

describe('the root resolution with LLM_OPENROUTER_ADAPTERS', () => {
  it('builds the openrouter chat strategy under the provider id', async () => {
    const { fetch, requests } = makeLlmFetchFake({ body: '{"data":{}}' });
    const strategy = makeLlmProviderStrategy({ provider: ROUTER, adapters: makeLlmAdapterRegistry(LLM_OPENROUTER_ADAPTERS), defaultModel: 'vendor/model-flash', fetch });

    expect(strategy.id).toBe('router-a');
    expect(strategy.kind).toBe('openrouter');
    expect(strategy.caching).toBe('breakpoint');
    await expect(strategy.credentialProbe?.()).resolves.toEqual({ ready: true, issues: [] });
    expect(requests.map((request) => request.url)).toEqual(['https://openrouter.ai/api/v1/key']);
  });

  it('derives the decision strategy for an openrouter-transport provider', () => {
    const adapters = makeLlmAdapterRegistry(LLM_OPENROUTER_ADAPTERS);
    const registry = makeLlmDecisionStrategies({ providers: [ROUTER], adapters });
    const strategies = registry.values();

    expect(strategies).toHaveLength(1);
    expect(strategies[0]?.id).toBe('router-a');
    expect(strategies[0]?.kind).toBe('openrouter-systemone');
    expect(strategies[0]?.describe).toBe('OpenRouter System One at https://openrouter.ai/api/v1/systemone');
  });

  it('leaves an openai-transport provider with no declared decision route undecided', () => {
    const adapters = makeLlmAdapterRegistry(LLM_OPENROUTER_ADAPTERS);
    const registry = makeLlmDecisionStrategies({ providers: [{ id: 'bare', transport: 'openai', apiKeyEnv: 'OPENAI_KEY', apiKey: 'k' }], adapters });

    expect(registry.values()).toEqual([]);
  });
});
