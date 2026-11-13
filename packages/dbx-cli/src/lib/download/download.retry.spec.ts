import { describe, expect, it } from 'vitest';
import { FetchResponseError, FetchTimeoutError } from '@dereekb/util/fetch';
import { CliDownloadAbortedError, CliDownloadIncompleteError, CliDownloadStalledError } from './download.file';
import { type CliDownloadFailure, CliDownloadTaskFailedError, composeCliDownloadFailureClassifiers, defaultCliDownloadFailureClassifier, runCliTaskWithRetry } from './download.retry';

function responseError(status: number, headers?: Record<string, string>): FetchResponseError {
  return new FetchResponseError(new Response(null, { status, headers }));
}

function errnoError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

const classify = composeCliDownloadFailureClassifiers(defaultCliDownloadFailureClassifier);

describe('defaultCliDownloadFailureClassifier()', () => {
  it.each<[string, unknown, CliDownloadFailure]>([
    ['aborted', new CliDownloadAbortedError(), { kind: 'aborted', code: 'ABORTED' }],
    ['stalled', new CliDownloadStalledError(1000), { kind: 'transient', code: 'TIMEOUT' }],
    ['incomplete', new CliDownloadIncompleteError(1, 2), { kind: 'transient', code: 'DOWNLOAD_INCOMPLETE' }],
    ['404', responseError(404), { kind: 'item', code: 'NOT_FOUND' }],
    ['401', responseError(401), { kind: 'fatal', code: 'UNAUTHORIZED' }],
    ['403', responseError(403), { kind: 'item', code: 'HTTP_403' }],
    ['client timeout', new DOMException('The operation was aborted', 'AbortError'), { kind: 'transient', code: 'TIMEOUT' }],
    ['fetch timeout', new FetchTimeoutError(new Response(null), 30_000), { kind: 'transient', code: 'TIMEOUT' }],
    ['connection reset', errnoError('ECONNRESET'), { kind: 'transient', code: 'NETWORK' }],
    ['undici socket', errnoError('UND_ERR_SOCKET'), { kind: 'transient', code: 'NETWORK' }],
    ['fetch failed', Object.assign(new TypeError('fetch failed'), { cause: errnoError('ECONNREFUSED') }), { kind: 'transient', code: 'NETWORK' }],
    ['disk full', errnoError('ENOSPC'), { kind: 'fatal', code: 'DISK_FULL' }],
    ['read-only', errnoError('EROFS'), { kind: 'fatal', code: 'WRITE_FAILED' }]
  ])('classifies %s', (_label, error, expected) => {
    expect(defaultCliDownloadFailureClassifier(error)).toEqual(expected);
  });

  it('reads Retry-After from a 429 and a 503', () => {
    expect(defaultCliDownloadFailureClassifier(responseError(429, { 'Retry-After': '7' }))).toEqual({ kind: 'throttled', code: 'RATE_LIMITED', retryAfter: 7000 });
    expect(defaultCliDownloadFailureClassifier(responseError(503, { 'Retry-After': '2' }))).toEqual({ kind: 'transient', code: 'SERVICE_UNAVAILABLE', retryAfter: 2000 });
    expect(defaultCliDownloadFailureClassifier(responseError(408))).toEqual({ kind: 'transient', code: 'SERVICE_UNAVAILABLE', retryAfter: undefined });
  });

  it('returns undefined for an unknown error, and the composer falls back to an item failure', () => {
    expect(defaultCliDownloadFailureClassifier(new Error('?'))).toBeUndefined();
    expect(classify(new Error('?'))).toEqual({ kind: 'item', code: 'ERROR' });
  });

  it('lets an earlier classifier win', () => {
    const custom = composeCliDownloadFailureClassifiers((error) => (error instanceof RangeError ? { kind: 'fatal', code: 'CUSTOM' } : undefined), defaultCliDownloadFailureClassifier);
    expect(custom(new RangeError('x'))).toEqual({ kind: 'fatal', code: 'CUSTOM' });
    expect(custom(responseError(404))).toEqual({ kind: 'item', code: 'NOT_FOUND' });
  });
});

describe('runCliTaskWithRetry()', () => {
  function recorder() {
    const delays: number[] = [];
    return { delays, wait: async (ms: number) => void delays.push(ms) };
  }

  it('backs off on transient failures with growing, capped delays, then succeeds', async () => {
    const { delays, wait } = recorder();
    let calls = 0;

    const result = await runCliTaskWithRetry({
      task: async (_signal, attempt) => {
        calls += 1;

        if (attempt < 4) {
          throw new CliDownloadStalledError(1000);
        }

        return 'ok';
      },
      classify,
      retry: { initialDelay: 1000, maxDelay: 2500 },
      wait
    });

    expect(result).toBe('ok');
    expect(calls).toBe(4);
    expect(delays).toHaveLength(3);
    // equal jitter: each delay is within [d/2, d] of 1000, 2000, 2500 (capped)
    expect(delays[0]).toBeGreaterThanOrEqual(500);
    expect(delays[0]).toBeLessThanOrEqual(1000);
    expect(delays[1]).toBeGreaterThanOrEqual(1000);
    expect(delays[1]).toBeLessThanOrEqual(2000);
    expect(delays[2]).toBeGreaterThanOrEqual(1250);
    expect(delays[2]).toBeLessThanOrEqual(2500);
  });

  it('uses the failure retryAfter, capped at maxRetryAfter', async () => {
    const { delays, wait } = recorder();
    let attempts = 0;
    const retried: string[] = [];

    await runCliTaskWithRetry({
      task: async () => {
        attempts += 1;

        if (attempts === 1) {
          throw responseError(429, { 'Retry-After': '12' });
        } else if (attempts === 2) {
          throw responseError(429, { 'Retry-After': '900' });
        }

        return 1;
      },
      classify,
      retry: { maxRetryAfter: 60_000 },
      wait,
      onRetry: (failure) => retried.push(failure.code)
    });

    expect(delays).toEqual([12_000, 60_000]);
    expect(retried).toEqual(['RATE_LIMITED', 'RATE_LIMITED']);
  });

  it('does not retry an item failure', async () => {
    const { delays, wait } = recorder();
    const cause = responseError(404);
    const error = await runCliTaskWithRetry({ task: () => Promise.reject(cause), classify, wait }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliDownloadTaskFailedError);
    expect((error as CliDownloadTaskFailedError).failure).toEqual({ kind: 'item', code: 'NOT_FOUND' });
    expect((error as CliDownloadTaskFailedError).cause).toBe(cause);
    expect(delays).toEqual([]);
  });

  it('gives up after maxAttempts', async () => {
    const { delays, wait } = recorder();
    let calls = 0;
    const error = await runCliTaskWithRetry({
      task: () => {
        calls += 1;
        return Promise.reject(errnoError('ECONNRESET'));
      },
      classify,
      retry: { maxAttempts: 3 },
      wait
    }).catch((e: unknown) => e);

    expect(calls).toBe(3);
    expect(delays).toHaveLength(2);
    expect((error as CliDownloadTaskFailedError).failure.code).toBe('NETWORK');
  });

  it('reports an aborted failure once the signal fires, and stops retrying', async () => {
    const controller = new AbortController();
    let calls = 0;
    const error = await runCliTaskWithRetry({
      task: () => {
        calls += 1;
        controller.abort();
        return Promise.reject(new CliDownloadStalledError(1));
      },
      classify,
      signal: controller.signal,
      wait: async () => undefined
    }).catch((e: unknown) => e);

    expect(calls).toBe(1);
    expect((error as CliDownloadTaskFailedError).failure).toEqual({ kind: 'aborted', code: 'ABORTED' });
  });

  it('cuts a backoff wait short when the signal fires', async () => {
    const controller = new AbortController();
    const started = Date.now();
    setTimeout(() => controller.abort(), 20);

    const error = await runCliTaskWithRetry({ task: () => Promise.reject(new CliDownloadStalledError(1)), classify, signal: controller.signal, retry: { initialDelay: 10_000, maxDelay: 10_000 } }).catch((e: unknown) => e);

    expect(Date.now() - started).toBeLessThan(5000);
    expect((error as CliDownloadTaskFailedError).failure.kind).toBe('aborted');
  });
});
