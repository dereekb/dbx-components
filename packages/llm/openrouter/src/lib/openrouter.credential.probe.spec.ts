import { describe, expect, it } from 'vitest';
import { makeLlmFetchFake } from '@dereekb/llm/test';
import { DEFAULT_LLM_OPENROUTER_BASE_URL } from './openrouter.constants';
import { probeLlmOpenRouterCredential } from './openrouter.credential.probe';

describe('probeLlmOpenRouterCredential()', () => {
  it('sends an authenticated GET to {baseUrl}/key at the default base and reports ready on a 200', async () => {
    const fake = makeLlmFetchFake({ status: 200, body: { data: { label: 'test' } } });
    const health = await probeLlmOpenRouterCredential({ strategyId: 'openrouter', apiKey: 'sk-or', fetch: fake.fetch });

    expect(health).toEqual({ ready: true, issues: [] });
    expect(fake.requests.map((request) => `${request.init.method} ${request.url}`)).toEqual([`GET ${DEFAULT_LLM_OPENROUTER_BASE_URL}/key`]);
    expect(fake.requests[0]?.init.headers['Authorization']).toBe('Bearer sk-or');
  });

  it('trims trailing slashes from a custom base', async () => {
    const fake = makeLlmFetchFake({ status: 200 });
    await probeLlmOpenRouterCredential({ strategyId: 'openrouter', apiKey: 'sk-or', baseUrl: 'https://gateway.test/api/v1//', fetch: fake.fetch });

    expect(fake.requests[0]?.url).toBe('https://gateway.test/api/v1/key');
  });

  it("reports a revoked key with OpenRouter's own words", async () => {
    const fake = makeLlmFetchFake({ status: 401, body: { error: { message: 'User not found.', code: 401 } } });
    const health = await probeLlmOpenRouterCredential({ strategyId: 'openrouter', apiKey: 'sk-dead', fetch: fake.fetch });

    expect(health.ready).toBe(false);
    expect(health.issues[0]?.message).toContain('User not found.');
  });

  it('keeps a 404 an error (OpenRouter always implements /key)', async () => {
    const fake = makeLlmFetchFake({ status: 404, body: '' });
    const health = await probeLlmOpenRouterCredential({ strategyId: 'openrouter', apiKey: 'sk-or', fetch: fake.fetch });

    expect(health.ready).toBe(false);
    expect(health.issues[0]?.severity).toBe('error');
  });
});
