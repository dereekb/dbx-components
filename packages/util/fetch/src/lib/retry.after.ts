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
