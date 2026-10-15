import { describe, it, expect } from 'vitest';
import { callModelOverHttp, getModelOverHttp, getMultipleModelsOverHttp, MAX_MODEL_ACCESS_MULTI_READ_KEYS } from './call-model.client';
import { CliHttpError } from '../util/output';

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

  it('appends the validation summary and reports VALIDATION_ERROR for a 400 validation error', async () => {
    const body = { statusCode: 400, message: 'One or more data/form validation errors occurred.', code: 'VALIDATION_ERROR', details: { code: 'VALIDATION_ERROR', message: 'One or more data/form validation errors occurred.', data: { message: 'key must be a string (was number)' } } };
    const fetcher = (async () => new Response(JSON.stringify(body), { status: 400 })) as typeof fetch;

    const error = await callModelOverHttp({
      apiBaseUrl: 'http://localhost/api',
      accessToken: 'token',
      params: { modelType: 'profile', call: 'update', specifier: 'onboard', data: { key: 5 } },
      fetcher
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliHttpError);
    expect((error as CliHttpError).code).toBe('VALIDATION_ERROR');
    expect((error as CliHttpError).message.endsWith('key must be a string (was number)')).toBe(true);
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

describe('getModelOverHttp', () => {
  it('GETs <apiBaseUrl>/model/<modelType>/get?key=<encoded key> with bearer header and returns parsed body', async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const fetcher = (async (input: any, init?: any) => {
      captured = { url: input as string, init };
      return new Response(JSON.stringify({ key: 'jws/abc', data: { foo: 'bar' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await getModelOverHttp({
      apiBaseUrl: 'http://localhost/api',
      accessToken: 'token-abc',
      modelType: 'jobWorkerSchedule',
      key: 'jws/abc',
      fetcher
    });

    expect(captured.url).toBe('http://localhost/api/model/jobWorkerSchedule/get?key=jws%2Fabc');
    expect(captured.init?.method).toBe('GET');
    const headers = (captured.init?.headers ?? {}) as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer token-abc');
    expect(result).toEqual({ key: 'jws/abc', data: { foo: 'bar' } });
  });

  it('throws CliError with NOT_FOUND on 404', async () => {
    const fetcher = (async () => new Response(JSON.stringify({ message: 'no such doc' }), { status: 404 })) as typeof fetch;

    await expect(
      getModelOverHttp({
        apiBaseUrl: 'http://localhost/api',
        accessToken: 'token',
        modelType: 'jobWorkerSchedule',
        key: 'jws/missing',
        fetcher
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('encodes modelType segments containing reserved characters', async () => {
    let url = '';
    const fetcher = (async (input: any) => {
      url = input as string;
      return new Response('{"key":"x","data":{}}', { status: 200 });
    }) as typeof fetch;

    await getModelOverHttp({
      apiBaseUrl: 'http://localhost/api',
      accessToken: 'token',
      modelType: 'foo bar',
      key: 'foo/abc',
      fetcher
    });

    expect(url).toBe('http://localhost/api/model/foo%20bar/get?key=foo%2Fabc');
  });
});

describe('getMultipleModelsOverHttp', () => {
  it('POSTs to <apiBaseUrl>/model/<modelType>/get with {keys} and returns parsed body', async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const fetcher = (async (input: any, init?: any) => {
      captured = { url: input as string, init };
      return new Response(JSON.stringify({ results: [{ key: 'jws/a', data: {} }], errors: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    const result = await getMultipleModelsOverHttp({
      apiBaseUrl: 'http://localhost/api',
      accessToken: 'token',
      modelType: 'jobWorkerSchedule',
      keys: ['jws/a', 'jws/b'],
      fetcher
    });

    expect(captured.url).toBe('http://localhost/api/model/jobWorkerSchedule/get');
    expect(captured.init?.method).toBe('POST');
    const body = JSON.parse(captured.init?.body as string);
    expect(body).toEqual({ keys: ['jws/a', 'jws/b'] });
    expect(result.results.length).toBe(1);
  });

  it('throws INVALID_ARGUMENT when keys list is empty', async () => {
    await expect(
      getMultipleModelsOverHttp({
        apiBaseUrl: 'http://localhost/api',
        accessToken: 'token',
        modelType: 'jobWorkerSchedule',
        keys: []
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it(`throws INVALID_ARGUMENT when keys.length exceeds ${MAX_MODEL_ACCESS_MULTI_READ_KEYS}`, async () => {
    const keys = Array.from({ length: MAX_MODEL_ACCESS_MULTI_READ_KEYS + 1 }, (_, i) => `jws/k${i}`);
    await expect(
      getMultipleModelsOverHttp({
        apiBaseUrl: 'http://localhost/api',
        accessToken: 'token',
        modelType: 'jobWorkerSchedule',
        keys
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('maps 403 to AUTH_FORBIDDEN', async () => {
    const fetcher = (async () => new Response(JSON.stringify({ message: 'denied' }), { status: 403 })) as typeof fetch;

    await expect(
      getMultipleModelsOverHttp({
        apiBaseUrl: 'http://localhost/api',
        accessToken: 'token',
        modelType: 'jobWorkerSchedule',
        keys: ['jws/a'],
        fetcher
      })
    ).rejects.toMatchObject({ code: 'AUTH_FORBIDDEN' });
  });

  it('throws a CliHttpError carrying the status and the server code on 403', async () => {
    const fetcher = (async () => new Response(JSON.stringify({ message: 'missing scope', code: 'CALL_MODEL_MISSING_OIDC_SCOPE' }), { status: 403 })) as typeof fetch;

    const error = await getModelOverHttp({ apiBaseUrl: 'http://localhost/api', accessToken: 'token', modelType: 'guestbook', key: 'gb/a', fetcher }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliHttpError);
    expect(error).toMatchObject({ status: 403, serverCode: 'CALL_MODEL_MISSING_OIDC_SCOPE', code: 'AUTH_FORBIDDEN' });
    expect((error as CliHttpError).suggestion).not.toContain('auth login');
  });
});
