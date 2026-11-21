import { describe, expect, it } from 'vitest';
import { type LlmCompletionAdapterConfig } from '@dereekb/llm';
import { makeLlmCompletionAdapterFake } from './llm.test.adapter';

const PROVIDER = { id: 'acme', transport: 'openai', apiKeyEnv: 'ACME_API_KEY', apiKey: 'k' } as const;

describe('makeLlmCompletionAdapterFake()', () => {
  it('should claim its kind and default base URL, and omit an unset default', () => {
    expect(makeLlmCompletionAdapterFake({ kind: 'openai', defaultBaseUrl: 'https://api.openai.com/v1' }).adapter).toMatchObject({ facet: 'completion', kind: 'openai', defaultBaseUrl: 'https://api.openai.com/v1' });
    expect('defaultBaseUrl' in makeLlmCompletionAdapterFake({ kind: 'openai' }).adapter).toBe(false);
  });

  it('should record each config and mint a strategy under the provider id', () => {
    const fake = makeLlmCompletionAdapterFake({ kind: 'openai' });
    const config: LlmCompletionAdapterConfig = { provider: PROVIDER, baseUrl: 'https://acme.example/v1' };
    const strategy = fake.adapter.make(config);

    expect(fake.received).toEqual([config]);
    expect(strategy.id).toBe('acme');
    expect(strategy.kind).toBe('openai');
    expect(strategy.describe).toBe('openai at https://acme.example/v1');
    expect(strategy.credentialProbe).toBeUndefined();
  });

  it('should mint under mintId and pass the credential probe through', () => {
    const credentialProbe = () => Promise.resolve({ ready: true, issues: [] });
    const strategy = makeLlmCompletionAdapterFake({ kind: 'openai', mintId: 'fixed' }).adapter.make({ provider: PROVIDER, credentialProbe });

    expect(strategy.id).toBe('fixed');
    expect(strategy.describe).toBe('openai at (default)');
    expect(strategy.credentialProbe).toBe(credentialProbe);
  });

  it('should count complete calls and reject them', async () => {
    const fake = makeLlmCompletionAdapterFake({ kind: 'openai' });
    const strategy = fake.adapter.make({ provider: PROVIDER });

    await expect(strategy.complete({ prompt: 'hi', capability: 'summarize' })).rejects.toThrow('not called');
    expect(fake.calls.complete).toBe(1);
  });
});
