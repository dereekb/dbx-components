/**
 * The LLM error vocabulary — the one table that decides whether a provider blip is RETRIED or kills the whole call,
 * asserted against **REAL `openai` SDK error instances**.
 *
 * WHY REAL INSTANCES: the predicates used to classify by `error.name`, and the SDK never assigns `this.name` on ANY of
 * its error classes — every instance inherits `Error.prototype.name === 'Error'`. Specs that hand-fabricated `.name`
 * on a plain `Error`, a shape production never produces, kept both guards green in test while they were dead in
 * production. Every SDK case below FAILED before the class-based fix.
 *
 * A spec may import `openai` statically — it is a spec-only devDependency of this package. The library's own sources
 * never import it: strategies keep the SDK behind a lazy `await import('openai')` plus an injectable structural
 * client.
 *
 * GOTCHA when constructing `APIError` subclasses: the constructor calls `headers?.get('x-request-id')`, so a plain
 * `{}` throws `TypeError: headers?.get is not a function`. Pass a real `Headers`.
 */

import { describe, expect, it } from 'vitest';
import { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError, BadRequestError, ConflictError, InternalServerError, RateLimitError } from 'openai';
import { classifyLlmError, isLlmAbortError, isRetryableLlmErrorClassification, LLM_ERROR_SUMMARY_MAX_LENGTH, formatLlmErrorSummary } from './llm.error';

/*
 * Ported from the old unprefixed abort predicate and boolean retry predicate, outcomes unchanged. The invariant every
 * case below keeps: `classifyLlmError(e) === 'transient'` <=> the old "abort OR retryable" pair answered true.
 */

describe('isLlmAbortError / classifyLlmError against REAL openai SDK instances', () => {
  it('every SDK error instance reports `.name === "Error"`, the property the old guard read', () => {
    // NOT a test of the SDK: this is the fact that made the name-based guard dead code in production. If a future
    // `openai` starts setting `.name`, this goes red and the doc comments in `llm.error.ts` need revisiting.
    expect(new APIConnectionError({ message: 'Connection error.' }).name).toBe('Error');
    expect(new APIConnectionTimeoutError({}).name).toBe('Error');
    expect(new APIUserAbortError({}).name).toBe('Error');
    expect(new RateLimitError(429, { message: 'rate limited' }, undefined, new Headers()).name).toBe('Error');
    expect(new InternalServerError(503, { message: 'bad gateway' }, undefined, new Headers()).name).toBe('Error');
  });

  it('APIConnectionTimeoutError is BOTH an abort and a transport error; the abort lane is tested first, so it lands in `timeout`', () => {
    // undici's `headersTimeout` firing throws this class. It EXTENDS `APIConnectionError`, so a chain walk matches
    // both predicates; a caller's `if (isLlmAbortError) … else classifyLlmError` order is what puts it in the
    // identical-resend `'timeout'` lane rather than the jittered-backoff `'transport'` one. That order is load-bearing.
    const error = new APIConnectionTimeoutError({ message: 'Request timed out. Node.js fetch timed out waiting for response headers;' });

    expect(isLlmAbortError(error)).toBe(true);
    expect(classifyLlmError(error)).toBe('transient');
  });

  it('APIUserAbortError is an abort (transient, taken by the abort lane first)', () => {
    const error = new APIUserAbortError({});

    expect(isLlmAbortError(error)).toBe(true);
    expect(classifyLlmError(error)).toBe('transient');
  });

  it('APIConnectionError is a TRANSPORT failure, not an abort', () => {
    // The bare `Connection error.` a reset / DNS / refused socket raises. It carries NO `status`, so the `byStatus`
    // half of the guard cannot see it — this case is the one the fix exists for.
    const error = new APIConnectionError({ message: 'Connection error.' });

    expect(isLlmAbortError(error)).toBe(false);
    expect(classifyLlmError(error)).toBe('transient');
  });

  it('RateLimitError is a transport failure by CLASS, not only by its 429 status', () => {
    const error = new RateLimitError(429, { message: 'rate limited' }, undefined, new Headers());

    expect(isLlmAbortError(error)).toBe(false);
    expect(classifyLlmError(error)).toBe('transient');
  });

  it('InternalServerError is a transport failure by CLASS, not only by its 5xx status', () => {
    const error = new InternalServerError(503, { message: 'bad gateway' }, undefined, new Headers());

    expect(isLlmAbortError(error)).toBe(false);
    expect(classifyLlmError(error)).toBe('transient');
  });

  it('BadRequestError is PERMANENT: a 400 is not resent, because resending identical bytes cannot fix it', () => {
    const error = new BadRequestError(400, { message: 'bad request' }, undefined, new Headers());

    expect(isLlmAbortError(error)).toBe(false);
    expect(classifyLlmError(error)).toBe('permanent');
  });

  it('a HYPOTHETICAL future APIConnectionError subclass is retryable by INHERITANCE', () => {
    // The whole reason the walk climbs the chain instead of reading `error.constructor.name`: the leaf name alone
    // is exactly what let `APIConnectionError` fall through while its own subclass was caught, the first time.
    class APIConnectionResetError extends APIConnectionError {}

    expect(classifyLlmError(new APIConnectionResetError({ message: 'reset' }))).toBe('transient');
  });
});

describe('isLlmAbortError / classifyLlmError on the NON-SDK shapes that already worked', () => {
  it('an aborted AbortController reason (DOMException `AbortError`) is an abort', () => {
    // A plain `AbortSignal` rejection DOES set `.name` correctly — its `constructor.name` is only `DOMException`,
    // so `.name` is the ONLY thing that distinguishes it. This is why the `.name` branch must survive the fix.
    const controller = new AbortController();
    controller.abort();
    const reason = controller.signal.reason as unknown;

    expect((reason as { readonly constructor: { readonly name: string } }).constructor.name).toBe('DOMException');
    expect(isLlmAbortError(reason)).toBe(true);
    expect(classifyLlmError(reason)).toBe('transient');
  });

  it('an AbortSignal.timeout reason (DOMException `TimeoutError`) is an abort', async () => {
    // `.reason` is `undefined` until the timer actually fires, so the signal must be AWAITED — reading it
    // eagerly would assert against `undefined` and pass for the wrong reason.
    const signal = AbortSignal.timeout(1);
    await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
    const reason = signal.reason as unknown;

    expect((reason as { readonly name: string }).name).toBe('TimeoutError');
    expect(isLlmAbortError(reason)).toBe(true);
    expect(classifyLlmError(reason)).toBe('transient');
  });

  it('a bare status-bearing error still retries on `byStatus`, the half of the guard that always worked', () => {
    expect(classifyLlmError(Object.assign(new Error('http 429'), { status: 429 }))).toBe('transient');
    expect(classifyLlmError(Object.assign(new Error('http 503'), { status: 503 }))).toBe('transient');
    expect(classifyLlmError(Object.assign(new Error('http 400'), { status: 400 }))).toBe('permanent');
  });

  it("a RAW fetch socket failure (undici's `fetch failed`, a socket code on the error or its cause) is a transport failure; a DNS miss is not", () => {
    expect(classifyLlmError(new TypeError('fetch failed', { cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8080'), { code: 'ECONNREFUSED' }) }))).toBe('transient');
    expect(classifyLlmError(new TypeError('fetch failed'))).toBe('transient');
    expect(classifyLlmError(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }))).toBe('transient');
    expect(classifyLlmError(new TypeError('other', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }))).toBe('transient');
    expect(classifyLlmError(Object.assign(new Error('getaddrinfo ENOTFOUND box'), { code: 'ENOTFOUND' }))).toBe('unknown');
    expect(classifyLlmError(new TypeError('x is not a function'))).toBe('unknown');
    expect(isLlmAbortError(new TypeError('fetch failed'))).toBe(false);
  });

  it('a gateway wrapper that DOES set `.name` still matches: the `.name` branch is kept for both predicates', () => {
    expect(isLlmAbortError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
    expect(isLlmAbortError(Object.assign(new Error('x'), { name: 'APIUserAbortError' }))).toBe(true);
    expect(classifyLlmError(Object.assign(new Error('x'), { name: 'APIConnectionError' }))).toBe('transient');
  });

  it('an ordinary error and a non-object throw are NEITHER an abort nor transient: they classify as unknown', () => {
    for (const value of [new Error('boom'), null, undefined, 'string', 42]) {
      expect(isLlmAbortError(value)).toBe(false);
      expect(classifyLlmError(value)).toBe('unknown');
    }
  });
});

describe('classifyLlmError: rules added with the util/fetch classifier', () => {
  it('HTTP 408 is transient', () => {
    expect(classifyLlmError(new APIError(408, { message: 'request timeout' }, undefined, new Headers()))).toBe('transient');
  });

  it('HTTP 409 is unknown', () => {
    expect(classifyLlmError(new ConflictError(409, { message: 'conflict' }, undefined, new Headers()))).toBe('unknown');
  });

  it('a browser network failure is transient', () => {
    expect(classifyLlmError(new TypeError('Failed to fetch'))).toBe('transient');
  });

  it("undici's fetch failed with an ENOTFOUND cause is unknown: the code decides", () => {
    expect(classifyLlmError(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }))).toBe('unknown');
  });
});

describe('isRetryableLlmErrorClassification', () => {
  const error = new Error('boom');

  it('resends an unknown error only when the host answers true', () => {
    expect(isRetryableLlmErrorClassification('unknown', error, () => true)).toBe(true);
    expect(isRetryableLlmErrorClassification('unknown', error, () => undefined)).toBe(false);
    expect(isRetryableLlmErrorClassification('unknown', error)).toBe(false);
  });

  it('never resends a permanent error and never asks the host about it', () => {
    let called = false;
    expect(
      isRetryableLlmErrorClassification('permanent', error, () => {
        called = true;
        return true;
      })
    ).toBe(false);
    expect(called).toBe(false);
  });

  it('always resends a transient error', () => {
    expect(isRetryableLlmErrorClassification('transient', error, () => false)).toBe(true);
  });
});

describe('formatLlmErrorSummary', () => {
  it('names the leaf class, the status and the message for a REAL SDK error', () => {
    // `RateLimitError 429` on every breadcrumb of a run is an exhausted key; `APIConnectionError` with no status
    // is the network. The summary is what lets a log reader tell them apart without re-sending a request.
    expect(formatLlmErrorSummary(new RateLimitError(429, { message: 'Rate limit exceeded' }, undefined, new Headers()))).toBe('RateLimitError 429: Rate limit exceeded');
    expect(formatLlmErrorSummary(new InternalServerError(502, { message: 'bad gateway' }, undefined, new Headers()))).toBe('InternalServerError 502: bad gateway');
    expect(formatLlmErrorSummary(new APIConnectionError({ message: 'Connection error.' }))).toBe('APIConnectionError: Connection error.');
  });

  it('a status-bearing plain Error keeps its status; a bare throw degrades to `unknown`', () => {
    expect(formatLlmErrorSummary(Object.assign(new Error('http 503'), { status: 503 }))).toBe('Error 503: http 503');
    expect(formatLlmErrorSummary(new Error(''))).toBe('Error');
    expect(formatLlmErrorSummary('boom')).toBe('boom');
    expect(formatLlmErrorSummary(undefined)).toBe('unknown');
  });

  it('is cut to one log line', () => {
    const summary = formatLlmErrorSummary(new Error('x'.repeat(1000)));
    expect(summary.length).toBe(LLM_ERROR_SUMMARY_MAX_LENGTH);
  });
});
