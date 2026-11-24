import { classifyFetchError, classifyFetchErrorStatus, DEFAULT_FETCH_ABORT_ERROR_NAMES, type FetchErrorClassification, isFetchAbortError, isFetchNetworkError, isRetryableFetchErrorClassification, readFetchErrorStatus } from './error.classify';
import { FetchResponseError } from './error';
import { FetchTimeoutError } from './timeout';

describe('readFetchErrorStatus()', () => {
  it('should read a numeric status', () => {
    expect(readFetchErrorStatus({ status: 429 })).toBe(429);
  });

  it('should read the status of a FetchResponseError', () => {
    expect(readFetchErrorStatus(new FetchResponseError(new Response(null, { status: 503 })))).toBe(503);
  });

  it('should read the status of an error carrying a response', () => {
    expect(readFetchErrorStatus(Object.assign(new Error('x'), { response: new Response(null, { status: 429 }) }))).toBe(429);
  });

  it('should ignore a string status', () => {
    expect(readFetchErrorStatus({ status: '503' })).toBeUndefined();
  });

  it('should return undefined for non-objects', () => {
    expect(readFetchErrorStatus(null)).toBeUndefined();
    expect(readFetchErrorStatus(undefined)).toBeUndefined();
    expect(readFetchErrorStatus('503')).toBeUndefined();
    expect(readFetchErrorStatus(503)).toBeUndefined();
  });
});

describe('classifyFetchErrorStatus()', () => {
  it.each([408, 429, 500, 503, 599])('should classify %s as transient', (status) => {
    expect(classifyFetchErrorStatus(status)).toBe('transient');
  });

  it.each([400, 401, 402, 403, 404])('should classify %s as permanent', (status) => {
    expect(classifyFetchErrorStatus(status)).toBe('permanent');
  });

  it.each([409, 405, 410, 422, 200, 302])('should classify %s as unknown', (status) => {
    expect(classifyFetchErrorStatus(status)).toBe('unknown');
  });

  it('should let a configured permanent status outrank the >= 500 rule', () => {
    expect(classifyFetchErrorStatus(501, { permanentStatuses: new Set([501]) })).toBe('permanent');
  });

  it('should replace the default transient statuses when given', () => {
    expect(classifyFetchErrorStatus(408, { transientStatuses: new Set([429]) })).toBe('unknown');
  });
});

describe('isFetchAbortError()', () => {
  it('should match an AbortController reason', () => {
    const controller = new AbortController();
    controller.abort();
    expect(isFetchAbortError(controller.signal.reason)).toBe(true);
  });

  it('should match an AbortSignal.timeout() reason', async () => {
    const signal = AbortSignal.timeout(1);
    // GOTCHA: the reason is undefined until the timer fires.
    await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
    expect(isFetchAbortError(signal.reason)).toBe(true);
  });

  it('should match a FetchTimeoutError', () => {
    expect(isFetchAbortError(new FetchTimeoutError(new Response(null), 10))).toBe(true);
  });

  it('should match a .name of AbortError', () => {
    expect(isFetchAbortError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
  });

  it('should match a configured class name on the chain, including a subclass', () => {
    class UserAbortError extends Error {}
    class SubUserAbortError extends UserAbortError {}
    const config = { abortErrorNames: new Set([...DEFAULT_FETCH_ABORT_ERROR_NAMES, 'UserAbortError']) };

    expect(isFetchAbortError(new UserAbortError(), config)).toBe(true);
    expect(isFetchAbortError(new SubUserAbortError(), config)).toBe(true);
    expect(isFetchAbortError(new SubUserAbortError())).toBe(false);
  });

  it('should not match other errors', () => {
    expect(isFetchAbortError(new TypeError('fetch failed'))).toBe(false);
    expect(isFetchAbortError(new Error('boom'))).toBe(false);
    expect(isFetchAbortError(null)).toBe(false);
    expect(isFetchAbortError('AbortError')).toBe(false);
  });
});

describe('isFetchNetworkError()', () => {
  describe('rules moved from @dereekb/llm', () => {
    it('should match undici fetch failed with a socket cause code', () => {
      expect(isFetchNetworkError(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }))).toBe(true);
    });

    it('should match a bare fetch failed TypeError', () => {
      expect(isFetchNetworkError(new TypeError('fetch failed'))).toBe(true);
    });

    it('should match an own socket code', () => {
      expect(isFetchNetworkError(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }))).toBe(true);
    });

    it('should match an undici code on the cause of any message', () => {
      expect(isFetchNetworkError(new TypeError('other', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }))).toBe(true);
    });

    it('should not match ENOTFOUND', () => {
      expect(isFetchNetworkError(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }))).toBe(false);
    });

    it('should not match an unrelated TypeError', () => {
      expect(isFetchNetworkError(new TypeError('x is not a function'))).toBe(false);
    });
  });

  describe('browser messages', () => {
    it.each(['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'The Internet connection appears to be offline.'])('should match a TypeError of "%s"', (message) => {
      expect(isFetchNetworkError(new TypeError(message))).toBe(true);
    });

    it('should not match the same message on a plain Error', () => {
      expect(isFetchNetworkError(new Error('Failed to fetch'))).toBe(false);
    });
  });

  describe('a specific code outranks the generic message', () => {
    it('should not match fetch failed with an ENOTFOUND cause', () => {
      expect(isFetchNetworkError(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }))).toBe(false);
    });

    it('should not match fetch failed with a certificate cause', () => {
      expect(isFetchNetworkError(new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED' } }))).toBe(false);
    });

    it('should match ENOTFOUND when the configured codes include it', () => {
      expect(isFetchNetworkError(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }), { networkErrorCodes: new Set(['ENOTFOUND']) })).toBe(true);
    });
  });

  it('should match a wrapper whose direct cause is a network TypeError', () => {
    expect(isFetchNetworkError(new Error('wrapped', { cause: new TypeError('Failed to fetch') }))).toBe(true);
  });

  it('should not match non-objects', () => {
    expect(isFetchNetworkError('fetch failed')).toBe(false);
    expect(isFetchNetworkError(undefined)).toBe(false);
  });
});

describe('classifyFetchError()', () => {
  it('should classify a non-object as unknown', () => {
    expect(classifyFetchError('boom')).toBe('unknown');
    expect(classifyFetchError(null)).toBe('unknown');
    expect(classifyFetchError(42)).toBe('unknown');
  });

  it('should let a permanent class name beat a 503 status', () => {
    class BadConfigError extends Error {
      readonly status = 503;
    }

    expect(classifyFetchError(new BadConfigError(), { permanentClassNames: new Set(['BadConfigError']) })).toBe('permanent');
  });

  it('should classify an abort as transient', () => {
    expect(classifyFetchError(new DOMException('stop', 'AbortError'))).toBe('transient');
  });

  it('should let a transient class name beat a 400 status', () => {
    class ConnectionError extends Error {
      readonly status = 400;
    }

    expect(classifyFetchError(new ConnectionError(), { transientClassNames: new Set(['ConnectionError']) })).toBe('transient');
  });

  it('should let a status beat the network check', () => {
    expect(classifyFetchError({ status: 409, code: 'ECONNRESET' })).toBe('unknown');
  });

  it('should classify a status', () => {
    expect(classifyFetchError({ status: 503 })).toBe('transient');
    expect(classifyFetchError({ status: 401 })).toBe('permanent');
    expect(classifyFetchError(new FetchResponseError(new Response(null, { status: 408 })))).toBe('transient');
  });

  it('should classify a network failure as transient', () => {
    expect(classifyFetchError(new TypeError('Failed to fetch'))).toBe('transient');
  });

  it('should classify a plain Error as unknown', () => {
    expect(classifyFetchError(new Error('boom'))).toBe('unknown');
  });

  it('should use a configured status reader', () => {
    const readStatus = (error: object) => {
      const { statusCode } = error as { readonly statusCode?: unknown };
      return typeof statusCode === 'number' ? statusCode : undefined;
    };

    expect(classifyFetchError({ statusCode: 402 }, { readStatus })).toBe('permanent');
    expect(classifyFetchError({ status: 402 }, { readStatus })).toBe('unknown');
  });
});

describe('isRetryableFetchErrorClassification()', () => {
  const error = new Error('boom');
  const answers: { readonly label: string; readonly fn?: (error: unknown) => boolean | undefined; readonly answer?: boolean }[] = [{ label: 'true', fn: () => true, answer: true }, { label: 'false', fn: () => false, answer: false }, { label: 'undefined', fn: () => undefined }, { label: 'absent' }];

  describe.each([true, false])('retryUnknownByDefault %s', (retryUnknownByDefault) => {
    describe.each(answers)('with a function answering $label', ({ fn, answer }) => {
      it('should always retry transient without asking the function', () => {
        const spy = fn ? vi.fn(fn) : undefined;
        expect(isRetryableFetchErrorClassification({ classification: 'transient', error, isRetryableUnknownError: spy, retryUnknownByDefault })).toBe(true);
        expect(spy?.mock.calls.length ?? 0).toBe(0);
      });

      it('should never retry permanent without asking the function', () => {
        const spy = fn ? vi.fn(fn) : undefined;
        expect(isRetryableFetchErrorClassification({ classification: 'permanent', error, isRetryableUnknownError: spy, retryUnknownByDefault })).toBe(false);
        expect(spy?.mock.calls.length ?? 0).toBe(0);
      });

      it('should ask the function about unknown, then fall back to the default', () => {
        const spy = fn ? vi.fn(fn) : undefined;
        const classification: FetchErrorClassification = 'unknown';
        const expected = answer ?? retryUnknownByDefault;

        expect(isRetryableFetchErrorClassification({ classification, error, isRetryableUnknownError: spy, retryUnknownByDefault })).toBe(expected);

        if (spy) {
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy).toHaveBeenCalledWith(error);
        }
      });
    });
  });
});
