import { describe, it, expect } from 'vitest';
import { callModelOverHttp } from './call-model.client';

describe('callModelOverHttp', () => {
  it('POSTs to <apiBaseUrl>/model/call with bearer header and JSON body, returns parsed body', async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const fetcher = (async (input: any, init?: any) => {
      captured = { url: input as string, init };
      return new Response(JSON.stringify({ ok: true, data: { hello: 'world' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await callModelOverHttp({
      apiBaseUrl: 'http://localhost/api',
      accessToken: 'token-abc',
      params: { modelType: 'profile', call: 'read', data: { uid: '1' } },
      fetcher
    });

    expect(captured.url).toBe('http://localhost/api/model/call');
    const headers = (captured.init?.headers ?? {}) as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer token-abc');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(captured.init?.body as string);
    expect(body).toEqual({ modelType: 'profile', call: 'read', data: { uid: '1' } });
    expect(result).toEqual({ ok: true, data: { hello: 'world' } });
  });

  it('throws CliError with AUTH_UNAUTHORIZED on 401', async () => {
    const fetcher = (async () => new Response(JSON.stringify({ message: 'no token' }), { status: 401 })) as typeof fetch;

    await expect(
      callModelOverHttp({
        apiBaseUrl: 'http://localhost/api',
        accessToken: 'token',
        params: { modelType: 'profile', call: 'read', data: {} },
        fetcher
      })
    ).rejects.toMatchObject({ code: 'AUTH_UNAUTHORIZED' });
  });

  it('strips trailing slash from apiBaseUrl before appending /model/call', async () => {
    let url = '';
    const fetcher = (async (input: any) => {
      url = input as string;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    await callModelOverHttp({
      apiBaseUrl: 'http://localhost/api/',
      accessToken: 'token',
      params: { modelType: 'profile', call: 'read', data: {} },
      fetcher
    });

    expect(url).toBe('http://localhost/api/model/call');
  });
});
