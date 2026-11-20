import { describe, expect, it } from 'vitest';
import { makeLlmFetchFake } from '@dereekb/llm/test';
import { probeLlmZenmuxCredential, LLM_ZENMUX_CREDENTIAL_PROBE_GENERATION_ID, LLM_ZENMUX_CREDENTIAL_PROBE_MODEL } from './zenmux.credential.probe';

// ZenMux's literal answers, EXCEPT `NOT_FOUND`: the shape the bill reader reads for an unknown generation id.
const INVALID_MODEL = '{"error":{"code":"404","type":"invalid_model","message":"Requested model is not valid"}}';
const ACCESS_DENIED = '{"error":{"code":"403","type":"access_denied","message":"You have no permission to access this resource (api_key_source: payg)"}}';
const LEGACY_DISABLED = '{"success":false,"message":"The API key upgrade window (October 22–November 10, 2026) has ended. Legacy keys have been disabled since November 10, 2026, at 00:00 UTC."}';
const NOT_FOUND = '{"success":false,"message":"Not Found","data":null}';

describe('probeLlmZenmuxCredential()', () => {
  it('a live SUBSCRIPTION key: one auth-gated request naming the sentinel model, refused 404 ⇒ live', async () => {
    const seam = makeLlmFetchFake(() => ({ status: 404, body: INVALID_MODEL }));
    const health = await probeLlmZenmuxCredential({ strategyId: 'zenmux', apiKey: 'sk-zen', fetch: seam.fetch });

    expect(health).toEqual({ ready: true, issues: [] });
    expect(seam.requests.map((request) => request.url)).toEqual(['https://zenmux.ai/api/v1/chat/completions']);
    expect(JSON.parse(seam.requests[0]?.init.body ?? '{}').model).toBe(LLM_ZENMUX_CREDENTIAL_PROBE_MODEL);
  });

  it('a live PAY-AS-YOU-GO key: refused 403 by its allow-list, then read as live by management/generation', async () => {
    const seam = makeLlmFetchFake(({ url }) => (url.includes('/management/generation') ? { status: 404, body: NOT_FOUND } : { status: 403, body: ACCESS_DENIED }));
    const health = await probeLlmZenmuxCredential({ strategyId: 'zenmux-payg', apiKey: 'payg-key', fetch: seam.fetch });

    expect(health.ready).toBe(true);
    expect(seam.requests.map((request) => request.url)).toEqual(['https://zenmux.ai/api/v1/chat/completions', `https://zenmux.ai/api/v1/management/generation?id=${LLM_ZENMUX_CREDENTIAL_PROBE_GENERATION_ID}`]);
  });

  it("a disabled legacy key: refused at both, and the verdict carries ZenMux's own reason", async () => {
    const seam = makeLlmFetchFake(({ url }) => (url.includes('/management/generation') ? { status: 403, body: LEGACY_DISABLED } : { status: 403, body: ACCESS_DENIED }));
    const health = await probeLlmZenmuxCredential({ strategyId: 'zenmux-payg', apiKey: 'sk-ai-v1-old', fetch: seam.fetch });

    expect(health.ready).toBe(false);
    expect(health.issues.map((issue) => issue.message).join(' ')).toContain('Legacy keys have been disabled');
  });

  it('a LAN proxy: the chat request goes to the proxy, the management/generation lookup to the ZenMux account base', async () => {
    const seam = makeLlmFetchFake(({ url }) => (url.includes('/management/generation') ? { status: 404, body: NOT_FOUND } : { status: 403, body: ACCESS_DENIED }));
    await probeLlmZenmuxCredential({ strategyId: 'proxy', apiKey: 'payg-key', baseUrl: 'http://192.168.1.50:8000/v1', fetch: seam.fetch });

    expect(seam.requests.map((request) => request.url)).toEqual(['http://192.168.1.50:8000/v1/chat/completions', `https://zenmux.ai/api/v1/management/generation?id=${LLM_ZENMUX_CREDENTIAL_PROBE_GENERATION_ID}`]);
  });

  it('strips trailing slashes from the base URL', async () => {
    const seam = makeLlmFetchFake(() => ({ status: 404, body: INVALID_MODEL }));
    await probeLlmZenmuxCredential({ strategyId: 'zenmux', apiKey: 'sk-zen', baseUrl: 'https://eu.zenmux.ai/api/v1//', fetch: seam.fetch });

    expect(seam.requests.map((request) => request.url)).toEqual(['https://eu.zenmux.ai/api/v1/chat/completions']);
  });

  it('pins neutral sentinel values that no gateway serves', () => {
    expect(LLM_ZENMUX_CREDENTIAL_PROBE_MODEL).toBe('llm-credential-probe/no-such-model');
    expect(LLM_ZENMUX_CREDENTIAL_PROBE_GENERATION_ID).toBe('llm-credential-probe');
  });
});
