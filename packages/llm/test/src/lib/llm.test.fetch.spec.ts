import { describe, expect, it } from 'vitest';
import { makeLlmFetchFake, readLlmFetchFakeHeader } from './llm.test.fetch';

describe('makeLlmFetchFake()', () => {
  it('should answer every request with a fixed answer and record it', async () => {
    const fake = makeLlmFetchFake({ status: 201, body: { ok: true }, headers: { 'x-a': '1' } });
    const response = await fake.fetch('https://gw.test/v1/a', { method: 'POST', headers: { Authorization: 'Bearer k' }, body: '{"q":1}' });

    expect(response.status).toBe(201);
    expect(response.headers.get('x-a')).toBe('1');
    expect(await response.json()).toEqual({ ok: true });
    expect(fake.requests).toEqual([{ url: 'https://gw.test/v1/a', init: { method: 'POST', headers: { Authorization: 'Bearer k' }, body: '{"q":1}', signal: undefined } }]);
  });

  it('should default to a 200 with an empty body and a GET', async () => {
    const fake = makeLlmFetchFake({});
    const response = await fake.fetch(new URL('https://gw.test/v1/b'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(fake.requests[0]?.url).toBe('https://gw.test/v1/b');
    expect(fake.requests[0]?.init.method).toBe('GET');
  });

  it('should call a respond function per request', async () => {
    const fake = makeLlmFetchFake((request) => ({ status: request.url.endsWith('/missing') ? 404 : 200, body: 'x' }));

    expect((await fake.fetch('https://gw.test/v1/missing')).status).toBe(404);
    expect((await fake.fetch('https://gw.test/v1/found')).status).toBe(200);
    expect(fake.requests.map((x) => x.url)).toEqual(['https://gw.test/v1/missing', 'https://gw.test/v1/found']);
  });

  it('should pass a returned Response through', async () => {
    const given = new Response('raw', { status: 418 });
    const fake = makeLlmFetchFake(() => given);

    expect(await fake.fetch('https://gw.test/v1/c')).toBe(given);
  });

  it("should hang on 'hang' until the request signal aborts, rejecting with its reason", async () => {
    const fake = makeLlmFetchFake('hang');
    const controller = new AbortController();
    const pending = fake.fetch('https://gw.test/v1/d', { signal: controller.signal });
    const reason = new Error('stop');

    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(fake.requests[0]?.init.signal).toBe(controller.signal);
  });

  it('should record a request whose respond throws', async () => {
    const fake = makeLlmFetchFake(() => {
      throw new Error('socket closed');
    });

    await expect(fake.fetch('https://gw.test/v1/e')).rejects.toThrow('socket closed');
    expect(fake.requests).toHaveLength(1);
  });
});

describe('readLlmFetchFakeHeader()', () => {
  it('should read a header in any case from a plain-object or Headers init', async () => {
    const fake = makeLlmFetchFake({});

    await fake.fetch('https://gw.test/v1/a', { headers: { Authorization: 'Bearer a' } });
    await fake.fetch('https://gw.test/v1/b', { headers: new Headers({ Authorization: 'Bearer b' }) });

    const [plain, instance] = fake.requests;
    expect(plain && readLlmFetchFakeHeader(plain, 'authorization')).toBe('Bearer a');
    expect(instance && readLlmFetchFakeHeader(instance, 'AUTHORIZATION')).toBe('Bearer b');
    expect(plain && readLlmFetchFakeHeader(plain, 'x-missing')).toBeUndefined();
  });
});
