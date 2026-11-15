import { itShouldFail, failDueToSuccess, failSuccessfully } from '@dereekb/util/test';
import { configureFetch, fetchService, type FetchService } from './fetch';
import { type RequestInitWithTimeout } from './fetch.type';
import { requireOkResponse } from './error';
import { waitForMs } from '@dereekb/util';
import { FetchTimeoutError } from './timeout';

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
   * signal aborted, or undefined when nothing aborted it within 2 s.
   */
  function abortWatchingFetch() {
    const result: { abortedAfter?: number } = {};
    const makeFetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const start = Date.now();

      return new Promise<Response>((_, reject) => {
        const fallback = setTimeout(() => reject(new Error('never aborted')), 2000);
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
});
