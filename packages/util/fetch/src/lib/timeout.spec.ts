import { itShouldFail, failDueToSuccess, failSuccessfully } from '@dereekb/util/test';
import { configureFetch, fetchService, type FetchService } from './fetch';
import { type RequestInitWithTimeout, type RequestWithTimeout } from './fetch.type';
import { requireOkResponse } from './error';
import { waitForMs } from '@dereekb/util';
import { cloneRequestWithTimeout, FetchTimeoutError } from './timeout';
import { rateLimitedFetchHandler } from './fetch.limit';

const testFetch: FetchService = fetchService({
  makeFetch: (url, init) => {
    const req = fetch(url, init);
    return req.then((x) => waitForMs(100000).then((x) => ({}) as Response)); // if successful, just wait
  },
  makeRequest: (x, y) => new Request(x, y as RequestInit)
});

describe('timeoutFetch()', () => {
  const forbiddenUrl = 'https://components.dereekb.com/api/webhook';

  itShouldFail('if the request times out', async () => {
    const fetch = testFetch.makeFetch({
      useTimeout: true,
      timeout: 1 // timeout "instantly"
    });

    const response = fetch(forbiddenUrl, {
      method: 'GET'
    });

    try {
      await requireOkResponse(response);
      failDueToSuccess();
    } catch (e: unknown) {
      expect(e instanceof FetchTimeoutError);
      failSuccessfully();
    }
  });
});

describe('configureFetch() timeout and abort signal', () => {
  /**
   * A fetch that never answers on its own: it resolves with how many ms passed before its request's
   * signal aborted, or undefined when nothing aborted it within fallbackMs (2 s by default).
   *
   * @param fallbackMs - How long to wait for an abort before giving up.
   * @returns The fetch and the result it records.
   */
  function abortWatchingFetch(fallbackMs = 2000) {
    const result: { abortedAfter?: number } = {};
    const makeFetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const start = Date.now();

      return new Promise<Response>((_, reject) => {
        const fallback = setTimeout(() => reject(new Error('never aborted')), fallbackMs);
        request.signal.addEventListener('abort', () => {
          clearTimeout(fallback);
          result.abortedAfter = Date.now() - start;
          reject(new DOMException('This operation was aborted', 'AbortError'));
        });
      });
    };

    return { makeFetch: makeFetch as typeof fetch, result };
  }

  it('uses a per-request timeout in place of the configured one', async () => {
    const { makeFetch, result } = abortWatchingFetch();
    const configured = configureFetch({ makeFetch, baseUrl: 'https://example.com', timeout: 2000, useTimeout: true });

    await configured('/slow', { timeout: 50 } as RequestInitWithTimeout).catch(() => undefined);

    expect(result.abortedAfter).toBeDefined();
    expect(result.abortedAfter).toBeLessThan(1000);
  });

  it("aborts when the caller's signal aborts, not only on the timeout", async () => {
    const { makeFetch, result } = abortWatchingFetch();
    const configured = configureFetch({ makeFetch, baseUrl: 'https://example.com', timeout: 1500, useTimeout: true });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);

    await configured('/slow', { signal: controller.signal }).catch(() => undefined);

    expect(result.abortedAfter).toBeDefined();
    expect(result.abortedAfter).toBeLessThan(1000);
  });

  it('still aborts on the timeout when the caller passes a signal that never aborts', async () => {
    const { makeFetch, result } = abortWatchingFetch();
    const configured = configureFetch({ makeFetch, baseUrl: 'https://example.com', timeout: 50, useTimeout: true });

    await configured('/slow', { signal: new AbortController().signal }).catch(() => undefined);

    expect(result.abortedAfter).toBeDefined();
    expect(result.abortedAfter).toBeLessThan(1000);
  });

  describe('through rateLimitedFetchHandler', () => {
    function noWaitFetchHandler() {
      return rateLimitedFetchHandler({
        rateLimiter: { getNextWaitTime: () => 0, waitForRateLimit: () => Promise.resolve() },
        updateWithResponse: () => false
      });
    }

    it('aborts on the configured timeout', async () => {
      const { makeFetch, result } = abortWatchingFetch();
      const configured = configureFetch({ makeFetch, baseUrl: 'https://example.com', timeout: 50, useTimeout: true, fetchHandler: noWaitFetchHandler() });

      await configured('/slow').catch(() => undefined);

      expect(result.abortedAfter).toBeDefined();
      expect(result.abortedAfter).toBeLessThan(1000);
    });

    it('uses a per-request timeout in place of the configured one, through the clone', async () => {
      const { makeFetch, result } = abortWatchingFetch();
      const configured = configureFetch({ makeFetch, baseUrl: 'https://example.com', timeout: 2000, useTimeout: true, fetchHandler: noWaitFetchHandler() });

      await configured('/slow', { timeout: 50 } as RequestInitWithTimeout).catch(() => undefined);

      expect(result.abortedAfter).toBeDefined();
      expect(result.abortedAfter).toBeLessThan(1000);
    });

    it('sends no timer when the request sets a timeout of 0', async () => {
      const { makeFetch, result } = abortWatchingFetch(300);
      const configured = configureFetch({ makeFetch, baseUrl: 'https://example.com', timeout: 50, useTimeout: true, fetchHandler: noWaitFetchHandler() });

      await configured('/slow', { timeout: 0 } as RequestInitWithTimeout).catch(() => undefined);

      expect(result.abortedAfter).toBeUndefined();
    });

    it('sends no timer when the configured timeout is 0', async () => {
      const { makeFetch, result } = abortWatchingFetch(300);
      const configured = configureFetch({ makeFetch, baseUrl: 'https://example.com', timeout: 0, useTimeout: true, fetchHandler: noWaitFetchHandler() });

      await configured('/slow').catch(() => undefined);

      expect(result.abortedAfter).toBeUndefined();
    });
  });
});

describe('cloneRequestWithTimeout()', () => {
  it('copies the timeout to the clone', () => {
    const request = new Request('https://example.com/test') as RequestWithTimeout;
    request.timeout = 5000;

    const clone = cloneRequestWithTimeout(request);

    expect(clone.timeout).toBe(5000);
  });

  it('copies a timeout of 0', () => {
    const request = new Request('https://example.com/test') as RequestWithTimeout;
    request.timeout = 0;

    const clone = cloneRequestWithTimeout(request);

    expect(clone.timeout).toBe(0);
  });

  it('gives a clone without a timeout when the request has none', () => {
    const request = new Request('https://example.com/test');

    const clone = cloneRequestWithTimeout(request);

    expect(clone.timeout).toBeUndefined();
  });

  it('returns a new request', () => {
    const request = new Request('https://example.com/test');

    const clone = cloneRequestWithTimeout(request);

    expect(clone).not.toBe(request);
    expect(clone.url).toBe(request.url);
  });

  it('keeps a POST body readable from the clone', async () => {
    const request = new Request('https://example.com/test', { method: 'POST', body: '{"a":1}' }) as RequestWithTimeout;
    request.timeout = 1000;

    const clone = cloneRequestWithTimeout(request);

    expect(clone.method).toBe('POST');
    expect(await clone.text()).toBe('{"a":1}');
  });
});
