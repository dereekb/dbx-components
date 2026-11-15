import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type FetchHandler, type RequestWithTimeout } from '@dereekb/util/fetch';
import { microsoftGraphRequest } from './graph.api';
import { MicrosoftGraphError } from './graph.error.api';
import { microsoftGraphFactory } from './graph.factory';
import { type MicrosoftGraphRateLimitedFetchHandlerConfig, type MicrosoftGraphThrottleDetails, microsoftGraphRateLimitedFetchHandler } from './graph.limit';

// models: B9 (SharePoint throttling: 429/503 carry Retry-After in seconds; pause every request), B10 (a Graph 429 carries TooManyRequests; back off without Retry-After)

function jsonResponse(status: number, headers: Record<string, string> = {}): Response {
  const body = status === 200 ? { id: 'me' } : { error: { code: status === 429 ? 'TooManyRequests' : 'serviceNotAvailable', message: 'Throttled.' } };
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function throttledGraph(answers: (request: Request, index: number) => Response, config: MicrosoftGraphRateLimitedFetchHandlerConfig = {}) {
  const requests: Request[] = [];
  const throttles: MicrosoftGraphThrottleDetails[] = [];
  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request);
    return answers(request, requests.length - 1);
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler, rateLimiterConfig: { ...config, onThrottled: (x) => throttles.push(x) } })({ accessTokenGetter: () => 'token' });
  return { request: microsoftGraphRequest(graphContext), requests, throttles };
}

/**
 * Settles a request under fake timers: every attempt first waits a (possibly zero) timer.
 *
 * @param promise - The request.
 * @param ms - How far to move the clock.
 * @returns The result, or the thrown error.
 */
async function settle<T>(promise: Promise<T>, ms = 10): Promise<T | unknown> {
  const caught = promise.catch((e: unknown) => e);
  await vi.advanceTimersByTimeAsync(ms);
  return caught;
}

describe('microsoftGraphRateLimitedFetchHandler()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should wait out a 429 Retry-After and send the request again', async () => {
    const graph = throttledGraph((_, i) => (i === 0 ? jsonResponse(429, { 'Retry-After': '2' }) : jsonResponse(200)));
    const result = graph.request({ method: 'GET', path: '/me' });

    await vi.advanceTimersByTimeAsync(1900);
    expect(graph.requests).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toEqual({ id: 'me' });
    expect(graph.requests).toHaveLength(2);
    expect(graph.throttles).toEqual([{ status: 429, wait: 2000, retrying: true }]);
  });

  it('should back off exponentially on a 429 without Retry-After', async () => {
    const graph = throttledGraph((_, i) => (i === 0 ? jsonResponse(429) : jsonResponse(200)));
    const result = graph.request({ method: 'GET', path: '/me' });

    await vi.advanceTimersByTimeAsync(1000); // the first backoff is 0.5 to 1 s
    await expect(result).resolves.toEqual({ id: 'me' });
    expect(graph.requests).toHaveLength(2);
    expect(graph.throttles[0].wait).toBeGreaterThanOrEqual(500);
    expect(graph.throttles[0].wait).toBeLessThanOrEqual(1000);
  });

  it('should retry a 503 to a GET but not to a POST', async () => {
    const getGraph = throttledGraph((_, i) => (i === 0 ? jsonResponse(503, { 'Retry-After': '1' }) : jsonResponse(200)));
    const getResult = getGraph.request({ method: 'GET', path: '/me' });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(getResult).resolves.toEqual({ id: 'me' });
    expect(getGraph.requests).toHaveLength(2);

    // a write might have been applied, so it is not sent twice
    const postGraph = throttledGraph(() => jsonResponse(503, { 'Retry-After': '1' }));
    const postError = await settle(postGraph.request({ method: 'POST', path: '/me/sendMail', body: {} }));
    expect(postError).toBeInstanceOf(MicrosoftGraphError);
    expect((postError as MicrosoftGraphError).status).toBe(503);
    expect(postGraph.requests).toHaveLength(1);
    expect(postGraph.throttles).toEqual([{ status: 503, wait: 1000, retrying: false }]);
  });

  it('should not retry a wait longer than maxRetryAfter', async () => {
    const graph = throttledGraph(() => jsonResponse(429, { 'Retry-After': '120' }));
    const error = await settle(graph.request({ method: 'GET', path: '/me' }));

    expect((error as MicrosoftGraphError).status).toBe(429);
    expect(graph.requests).toHaveLength(1);
    expect(graph.throttles).toEqual([{ status: 429, wait: 120_000, retrying: false }]);
  });

  it('should give up after maxRetries retries', async () => {
    const graph = throttledGraph(() => jsonResponse(429, { 'Retry-After': '0' }), { maxRetries: 2 });
    const error = await settle(graph.request({ method: 'GET', path: '/me' }));

    expect((error as MicrosoftGraphError).status).toBe(429);
    expect(graph.requests).toHaveLength(1 + 2);
  });

  it('should hold every request of the client during the pause', async () => {
    const graph = throttledGraph((_, i) => (i === 0 ? jsonResponse(429, { 'Retry-After': '2' }) : jsonResponse(200)));
    const first = graph.request({ method: 'GET', path: '/me' });

    // let the first request get its 429 before the second starts
    for (let i = 0; i < 100 && graph.throttles.length === 0; i += 1) {
      await vi.advanceTimersByTimeAsync(0);
    }

    expect(graph.requests).toHaveLength(1);
    expect(graph.throttles).toHaveLength(1);

    const second = graph.request({ method: 'GET', path: '/me/drive' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(graph.requests).toHaveLength(1); // the second request waits too

    await vi.advanceTimersByTimeAsync(600);
    await expect(first).resolves.toEqual({ id: 'me' });
    await expect(second).resolves.toEqual({ id: 'me' });
    expect(graph.requests).toHaveLength(3);
  });

  it('should turn the pause off after the first success, so later requests do not wait', async () => {
    const handler = microsoftGraphRateLimitedFetchHandler();
    let calls = 0;
    const makeFetch = (async () => {
      calls += 1;
      return calls === 1 ? jsonResponse(429, { 'Retry-After': '1' }) : jsonResponse(200);
    }) as unknown as typeof fetch;

    const result = handler(new Request('https://graph.microsoft.com/v1.0/me'), makeFetch);
    expect(handler._rateLimiter.getEnabled()).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await result).status).toBe(200);
    expect(handler._rateLimiter.getEnabled()).toBe(false);

    const next = await settle(handler(new Request('https://graph.microsoft.com/v1.0/me'), makeFetch), 0);
    expect((next as Response).status).toBe(200);
    expect(calls).toBe(3);
  });

  it("should keep the request's timeout on every attempt", async () => {
    const handler = microsoftGraphRateLimitedFetchHandler();
    const timeouts: unknown[] = [];
    const makeFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      timeouts.push((init as { timeout?: number } | undefined)?.timeout);
      return jsonResponse(timeouts.length === 1 ? 429 : 200, { 'Retry-After': '0' });
    }) as typeof fetch;

    const request = new Request('https://graph.microsoft.com/v1.0/me') as RequestWithTimeout;
    request.timeout = 30_000;

    const result = await settle(handler(request, makeFetch));
    expect((result as Response).status).toBe(200);
    expect(timeouts).toEqual([30_000, 30_000]);
  });
});
