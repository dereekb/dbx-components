/**
 * The shared credential-probe primitive — proves the one mapping every strategy's `credentialProbe` leans on: a 2xx
 * is ready, a rejected credential is `ready:false` carrying the PROVIDER'S OWN words, a 404 is policy-driven (hard
 * error by default, an advisory warning for a neutral gateway), and a thrown transport is REPORTED rather than
 * propagated. Every case rides an injected fetch seam, so the whole file is network-free.
 */

import { describe, it, expect, vi } from 'vitest';
import { probeLlmCredentialEndpoint, llmProviderErrorMessage, type LlmCredentialProbeFetch, type LlmCredentialProbeResponse } from './llm.credential.probe';

/**
 * The literal body OpenRouter answers a revoked key with — the message an operator needs to see verbatim.
 */
const REVOKED_BODY = '{"error":{"message":"User not found.","code":401}}';

/**
 * Build a fetch seam that answers ONE canned response and records the calls it received.
 *
 * @param response - The status / body to answer with.
 * @returns The seam plus the recorded calls.
 */
function fakeFetch(response: { readonly status: number; readonly body?: string }): { readonly fetch: LlmCredentialProbeFetch; readonly calls: Array<{ readonly url: string; readonly authorization: string | undefined }> } {
  const calls: Array<{ readonly url: string; readonly authorization: string | undefined }> = [];
  const fetchImpl: LlmCredentialProbeFetch = async (url, init) => {
    calls.push({ url, authorization: init.headers['Authorization'] });
    const answer: LlmCredentialProbeResponse = { ok: response.status >= 200 && response.status < 300, status: response.status, text: async () => response.body ?? '' };
    return answer;
  };
  return { fetch: fetchImpl, calls };
}

describe('llmProviderErrorMessage', () => {
  it('extracts the nested provider message (the OpenRouter / OpenAI error envelope)', () => {
    expect(llmProviderErrorMessage(REVOKED_BODY)).toBe('User not found.');
  });

  it('extracts a flat `message` and degrades a non-JSON body to its trimmed raw text', () => {
    expect(llmProviderErrorMessage('{"message":"invalid api key"}')).toBe('invalid api key');
    expect(llmProviderErrorMessage('  <html>502 Bad Gateway</html>  ')).toBe('<html>502 Bad Gateway</html>');
  });

  it('is undefined for an empty body', () => {
    expect(llmProviderErrorMessage('')).toBeUndefined();
    expect(llmProviderErrorMessage('   ')).toBeUndefined();
  });
});

describe('probeLlmCredentialEndpoint', () => {
  it('sends an authenticated GET at the named url and reports ready on a 200', async () => {
    const { fetch, calls } = fakeFetch({ status: 200, body: '{"data":{"label":"test"}}' });

    const health = await probeLlmCredentialEndpoint({ strategyId: 'openrouter', url: 'https://openrouter.ai/api/v1/key', apiKey: 'sk-live', fetch });

    expect(health).toEqual({ ready: true, issues: [] });
    expect(calls).toEqual([{ url: 'https://openrouter.ai/api/v1/key', authorization: 'Bearer sk-live' }]);
  });

  it('reports NOT ready on a 401, carrying the provider message verbatim', async () => {
    // The reason the probe exists, in one assertion: the key is well-formed, every non-network check passed, and
    // only this probe can tell the operator the provider itself says "User not found."
    const { fetch } = fakeFetch({ status: 401, body: REVOKED_BODY });

    const health = await probeLlmCredentialEndpoint({ strategyId: 'openrouter', url: 'https://openrouter.ai/api/v1/key', apiKey: 'sk-dead', fetch });

    expect(health.ready).toBe(false);
    expect(health.issues).toHaveLength(1);
    expect(health.issues[0]?.severity).toBe('error');
    expect(health.issues[0]?.message).toContain('User not found.');
    expect(health.issues[0]?.message).toContain('HTTP 401');
    expect(health.issues[0]?.message).toContain('openrouter');
  });

  it('never leaks the credential into the issue message', async () => {
    const { fetch } = fakeFetch({ status: 401, body: REVOKED_BODY });

    const health = await probeLlmCredentialEndpoint({ strategyId: 'openrouter', url: 'https://openrouter.ai/api/v1/key', apiKey: 'sk-super-secret', fetch });

    expect(health.issues[0]?.message).not.toContain('sk-super-secret');
  });

  it('treats a 404 as a hard error by default', async () => {
    const { fetch } = fakeFetch({ status: 404, body: '{"error":{"message":"Not found"}}' });

    const health = await probeLlmCredentialEndpoint({ strategyId: 'openrouter', url: 'https://openrouter.ai/api/v1/key', apiKey: 'sk-live', fetch });

    expect(health.ready).toBe(false);
  });

  it('degrades a 404 to a READY warning under the lenient policy (an unknown-but-working gateway stays launchable)', async () => {
    const { fetch } = fakeFetch({ status: 404, body: '' });

    const health = await probeLlmCredentialEndpoint({ strategyId: 'openai', url: 'https://gateway.example/v1/models', apiKey: 'sk-live', fetch, notFoundSeverity: 'warning' });

    expect(health.ready).toBe(true);
    expect(health.issues).toEqual([{ severity: 'warning', message: expect.stringContaining('not implemented') }]);
  });

  it('a 401 under the lenient 404 policy is STILL a hard error (not-implemented ≠ not-authorized)', async () => {
    const { fetch } = fakeFetch({ status: 401, body: REVOKED_BODY });

    const health = await probeLlmCredentialEndpoint({ strategyId: 'openai', url: 'https://gateway.example/v1/models', apiKey: 'sk-dead', fetch, notFoundSeverity: 'warning' });

    expect(health.ready).toBe(false);
    expect(health.issues[0]?.message).toContain('User not found.');
  });

  it('REPORTS a thrown transport as unready and never propagates it', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND gateway.example');
    });

    const health = await probeLlmCredentialEndpoint({ strategyId: 'openai', url: 'https://gateway.example/v1/models', apiKey: 'sk-live', fetch: fetchImpl as unknown as LlmCredentialProbeFetch });

    expect(health.ready).toBe(false);
    expect(health.issues[0]?.message).toContain('ENOTFOUND');
  });

  it('reports a status-only failure when the provider answered no body', async () => {
    const { fetch } = fakeFetch({ status: 500 });

    const health = await probeLlmCredentialEndpoint({ strategyId: 'openrouter', url: 'https://openrouter.ai/api/v1/key', apiKey: 'sk-live', fetch });

    expect(health.ready).toBe(false);
    expect(health.issues[0]?.message).toContain('HTTP 500');
  });
});

describe('probeLlmCredentialEndpoint — the AUTH-GATED mode', () => {
  it('POSTs the body and reads any non-rejected 4xx as a live key (the gateway refused the request, not the key)', async () => {
    const seen: Array<{ readonly method: string; readonly body: string | undefined }> = [];
    const fetchImpl: LlmCredentialProbeFetch = async (_url, init) => {
      seen.push({ method: init.method, body: init.body });
      return { ok: false, status: 404, text: async () => '{"error":{"type":"invalid_model","message":"Requested model is not valid"}}' };
    };

    const health = await probeLlmCredentialEndpoint({ strategyId: 'zenmux', url: 'https://gw.test/v1/chat/completions', apiKey: 'sk', postBody: '{"model":"x"}', rejectedStatuses: [401, 403], fetch: fetchImpl });

    expect(health).toEqual({ ready: true, issues: [] });
    expect(seen).toEqual([{ method: 'POST', body: '{"model":"x"}' }]);
  });

  it('reads a listed status as a rejected key, and a 5xx as unverified (never live)', async () => {
    const rejected = await probeLlmCredentialEndpoint({ strategyId: 'zenmux', url: 'https://gw.test/v1/x', apiKey: 'sk', rejectedStatuses: [401, 403], fetch: fakeFetch({ status: 403, body: '{"error":{"message":"You have no permission"}}' }).fetch });
    const failed = await probeLlmCredentialEndpoint({ strategyId: 'zenmux', url: 'https://gw.test/v1/x', apiKey: 'sk', rejectedStatuses: [401, 403], fetch: fakeFetch({ status: 502 }).fetch });

    expect(rejected.ready).toBe(false);
    expect(rejected.issues[0]?.message).toContain('You have no permission');
    expect(failed.ready).toBe(false);
  });
});

describe('probeLlmCredentialEndpoint — an engine without AbortSignal.any', () => {
  it('resolves an unready verdict instead of rejecting', async () => {
    const anySpy = vi.spyOn(AbortSignal, 'any').mockImplementation(() => {
      throw new TypeError('AbortSignal.any is not a function');
    });

    try {
      const { fetch, calls } = fakeFetch({ status: 200 });
      const health = await probeLlmCredentialEndpoint({ strategyId: 'openai', url: 'https://gateway.example/v1/models', apiKey: 'sk-live', fetch, signal: new AbortController().signal });

      expect(health.ready).toBe(false);
      expect(health.issues).toHaveLength(1);
      expect(health.issues[0]?.severity).toBe('error');
      expect(health.issues[0]?.message).toContain('could not reach');
      expect(calls).toHaveLength(0);
    } finally {
      anySpy.mockRestore();
    }
  });
});
