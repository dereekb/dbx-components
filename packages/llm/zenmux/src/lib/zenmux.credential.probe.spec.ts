import { describe, expect, it } from 'vitest';
import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { probeLlmZenmuxCredential, LLM_ZENMUX_CREDENTIAL_PROBE_GENERATION_ID, LLM_ZENMUX_CREDENTIAL_PROBE_MODEL } from './zenmux.credential.probe';

// ZenMux's literal answers, measured 2026-11-14 against the live gateway, EXCEPT `NOT_FOUND`: a live pay-as-you-go key's answer
// to an unknown generation id was not measurable; it is the shape the bill reader reads.
const INVALID_MODEL = '{"error":{"code":"404","type":"invalid_model","message":"Requested model is not valid"}}';
const ACCESS_DENIED = '{"error":{"code":"403","type":"access_denied","message":"You have no permission to access this resource (api_key_source: payg)"}}';
const LEGACY_DISABLED = '{"success":false,"message":"The API key upgrade window (October 22–November 10, 2026) has ended. Legacy keys have been disabled since November 10, 2026, at 00:00 UTC."}';
const NOT_FOUND = '{"success":false,"message":"Not Found","data":null}';

function recordingFetch(answer: (url: string) => { readonly status: number; readonly body: string }): { readonly fetch: ConfiguredFetch; readonly urls: string[]; readonly bodies: Array<string | undefined> } {
  const urls: string[] = [];
  const bodies: Array<string | undefined> = [];
  const fetchImpl: ConfiguredFetch = async (input, init) => {
    const url = String(input);
    urls.push(url);
    bodies.push(typeof init?.body === 'string' ? init.body : undefined);
    const { status, body } = answer(url);
    const response = new Response(body, { status: status });
    return response;
  };
  return { fetch: fetchImpl, urls, bodies };
}

describe('probeLlmZenmuxCredential()', () => {
  it('a live SUBSCRIPTION key: one auth-gated request naming the sentinel model, refused 404 ⇒ live', async () => {
    const seam = recordingFetch(() => ({ status: 404, body: INVALID_MODEL }));
    const health = await probeLlmZenmuxCredential({ strategyId: 'zenmux', apiKey: 'sk-zen', fetch: seam.fetch });

    expect(health).toEqual({ ready: true, issues: [] });
    expect(seam.urls).toEqual(['https://zenmux.ai/api/v1/chat/completions']);
    expect(JSON.parse(seam.bodies[0] ?? '{}').model).toBe(LLM_ZENMUX_CREDENTIAL_PROBE_MODEL);
  });

  it('a live PAY-AS-YOU-GO key: refused 403 by its allow-list, then read as live by management/generation', async () => {
    const seam = recordingFetch((url) => (url.includes('/management/generation') ? { status: 404, body: NOT_FOUND } : { status: 403, body: ACCESS_DENIED }));
    const health = await probeLlmZenmuxCredential({ strategyId: 'zenmux-payg', apiKey: 'payg-key', fetch: seam.fetch });

    expect(health.ready).toBe(true);
    expect(seam.urls).toEqual(['https://zenmux.ai/api/v1/chat/completions', `https://zenmux.ai/api/v1/management/generation?id=${LLM_ZENMUX_CREDENTIAL_PROBE_GENERATION_ID}`]);
  });

  it("a disabled legacy key: refused at both, and the verdict carries ZenMux's own reason", async () => {
    const seam = recordingFetch((url) => (url.includes('/management/generation') ? { status: 403, body: LEGACY_DISABLED } : { status: 403, body: ACCESS_DENIED }));
    const health = await probeLlmZenmuxCredential({ strategyId: 'zenmux-payg', apiKey: 'sk-ai-v1-old', fetch: seam.fetch });

    expect(health.ready).toBe(false);
    expect(health.issues.map((issue) => issue.message).join(' ')).toContain('Legacy keys have been disabled');
  });

  it('a LAN proxy: the chat request goes to the proxy, the management/generation lookup to the ZenMux account base', async () => {
    const seam = recordingFetch((url) => (url.includes('/management/generation') ? { status: 404, body: NOT_FOUND } : { status: 403, body: ACCESS_DENIED }));
    await probeLlmZenmuxCredential({ strategyId: 'proxy', apiKey: 'payg-key', baseUrl: 'http://192.168.1.50:8000/v1', fetch: seam.fetch });

    expect(seam.urls).toEqual(['http://192.168.1.50:8000/v1/chat/completions', `https://zenmux.ai/api/v1/management/generation?id=${LLM_ZENMUX_CREDENTIAL_PROBE_GENERATION_ID}`]);
  });

  it('strips trailing slashes from the base URL', async () => {
    const seam = recordingFetch(() => ({ status: 404, body: INVALID_MODEL }));
    await probeLlmZenmuxCredential({ strategyId: 'zenmux', apiKey: 'sk-zen', baseUrl: 'https://eu.zenmux.ai/api/v1//', fetch: seam.fetch });

    expect(seam.urls).toEqual(['https://eu.zenmux.ai/api/v1/chat/completions']);
  });

  it('pins neutral sentinel values that no gateway serves', () => {
    expect(LLM_ZENMUX_CREDENTIAL_PROBE_MODEL).toBe('llm-credential-probe/no-such-model');
    expect(LLM_ZENMUX_CREDENTIAL_PROBE_GENERATION_ID).toBe('llm-credential-probe');
  });
});
