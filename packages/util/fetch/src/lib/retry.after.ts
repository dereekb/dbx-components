import { type Maybe, type Milliseconds } from '@dereekb/util';

/**
 * Parses an HTTP `Retry-After` header: either delay-seconds (`120`) or an HTTP-date (`Wed, 21 Oct 2026 07:28:00 GMT`).
 *
 * @param value - The header value.
 * @param now - The current time, for an HTTP-date. Defaults to now.
 * @returns The milliseconds to wait (0 for a date in the past), or undefined when the header is absent or unparseable.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, http, retry, retry-after, throttle, 429, 503, rate-limit
 *
 * @see https://www.rfc-editor.org/rfc/rfc9110#field.retry-after
 *
 * @example
 * ```ts
 * parseRetryAfterHeader('120'); // 120000
 * parseRetryAfterHeader(response.headers.get('Retry-After')); // undefined when absent
 * ```
 */
export function parseRetryAfterHeader(value: Maybe<string>, now?: Maybe<Date>): Maybe<Milliseconds> {
  const trimmed = value?.trim();
  let result: Maybe<Milliseconds>;

  if (trimmed) {
    if (/^\d+$/.test(trimmed)) {
      result = Number(trimmed) * 1000;
    } else if (/[a-z]/i.test(trimmed)) {
      // an HTTP-date always names a day and month; requiring a letter keeps bare numbers like "-5" out of Date.parse()
      const at = Date.parse(trimmed);

      if (!Number.isNaN(at)) {
        result = Math.max(0, at - (now ?? new Date()).getTime());
      }
    }
  }

  return result;
}

/**
 * Reads one header off a headers carrier — a `Headers` (or anything with `get(name)`), else a plain record read
 * case-insensitively.
 *
 * @param headers - The carrier.
 * @param name - The lowercase header name.
 * @returns The header value, or undefined when absent or not a string / number.
 */
function readRetryAfterHeaderValue(headers: object, name: string): Maybe<string> {
  let value: unknown;

  if (typeof (headers as { readonly get?: unknown }).get === 'function') {
    value = (headers as { readonly get: (name: string) => unknown }).get(name);
  } else {
    const key = Object.keys(headers).find((x) => x.toLowerCase() === name);
    value = key == null ? undefined : (headers as Record<string, unknown>)[key];
  }

  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

/**
 * The headers a thrown error carries — `error.headers`, else `error.response.headers`.
 *
 * @param error - The thrown value.
 * @returns The headers carrier, or undefined when the error carries none.
 */
function retryAfterHeadersOfError(error: unknown): Maybe<object> {
  let headers: unknown;

  if (error != null && typeof error === 'object') {
    const carrier = error as { readonly headers?: unknown; readonly response?: unknown };
    headers = carrier.headers;

    if ((headers == null || typeof headers !== 'object') && carrier.response != null && typeof carrier.response === 'object') {
      headers = (carrier.response as { readonly headers?: unknown }).headers;
    }
  }

  return headers != null && typeof headers === 'object' ? headers : undefined;
}

/**
 * Reads a server-requested retry wait off a thrown error — `error.headers`, else `error.response.headers` (a `Headers`
 * or anything with `get(name)`, or a plain record read case-insensitively). The non-standard `retry-after-ms` (OpenAI,
 * Azure) wins when it reads as a finite number ≥ 0; else `Retry-After` through {@link parseRetryAfterHeader}.
 *
 * Browser-safe: no Node import.
 *
 * @param error - The thrown value — an SDK error with `headers`, a `FetchResponseError`, anything else.
 * @param now - The current time, for an HTTP-date `Retry-After`. Defaults to now.
 * @returns The milliseconds to wait, or undefined when the error carries no readable wait.
 *
 * @dbxUtil
 * @dbxUtilCategory fetch
 * @dbxUtilTags fetch, http, retry, retry-after, throttle, 429, 503, error, headers
 * @dbxUtilRelated parse-retry-after-header
 *
 * @example
 * ```ts
 * readFetchErrorRetryAfter({ headers: new Headers({ 'retry-after': '2' }) }); // 2000
 * readFetchErrorRetryAfter({ headers: { 'Retry-After': '1', 'retry-after-ms': '1500' } }); // 1500
 * readFetchErrorRetryAfter(new Error('boom')); // undefined
 * ```
 */
export function readFetchErrorRetryAfter(error: unknown, now?: Maybe<Date>): Maybe<Milliseconds> {
  const headers = retryAfterHeadersOfError(error);
  let result: Maybe<Milliseconds>;

  if (headers != null) {
    const ms = readRetryAfterHeaderValue(headers, 'retry-after-ms');
    const parsedMs = ms == null ? Number.NaN : Number.parseFloat(ms);
    result = Number.isFinite(parsedMs) && parsedMs >= 0 ? parsedMs : parseRetryAfterHeader(readRetryAfterHeaderValue(headers, 'retry-after'), now);
  }

  return result;
}
