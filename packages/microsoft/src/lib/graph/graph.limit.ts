import { type Maybe, type Milliseconds, MS_IN_SECOND, exponentialBackoffDelay, type ResetPeriodPromiseRateLimiter, resetPeriodPromiseRateLimiter } from '@dereekb/util';
import { type FetchHandler, type RateLimitedFetchHandler, type RequestWithTimeout, parseRetryAfterHeader, rateLimitedFetchHandler } from '@dereekb/util/fetch';
import { MICROSOFT_GRAPH_THROTTLE_WITH_RETRY_AFTER_STATUSES } from './graph.error.api';

/**
 * How many times a throttled Graph request is retried by default.
 */
export const DEFAULT_MICROSOFT_GRAPH_THROTTLE_MAX_RETRIES = 3;

/**
 * The longest `Retry-After` wait a throttled Graph request is retried after by default. A longer wait is not
 * retried: the throttle surfaces to the caller.
 */
export const DEFAULT_MICROSOFT_GRAPH_THROTTLE_MAX_RETRY_AFTER: Milliseconds = 60 * MS_IN_SECOND;

/**
 * The statuses that are a throttle only for a read (GET/HEAD), which is safe to send again: 503 (service
 * unavailable), 504 (gateway timeout) and 509 (bandwidth limit exceeded). A 429 is a throttle for any method.
 */
export const MICROSOFT_GRAPH_THROTTLE_READ_STATUSES: readonly number[] = [503, 504, 509];

/**
 * What a throttled response looked like and what the limiter does about it.
 */
export interface MicrosoftGraphThrottleDetails {
  readonly status: number;
  /**
   * How long every request of the client now waits.
   */
  readonly wait: Milliseconds;
  /**
   * Whether the throttled request is sent again after the wait.
   */
  readonly retrying: boolean;
}

/**
 * Configures {@link microsoftGraphRateLimitedFetchHandler}.
 */
export interface MicrosoftGraphRateLimitedFetchHandlerConfig {
  /**
   * How many times a throttled request is retried. Defaults to {@link DEFAULT_MICROSOFT_GRAPH_THROTTLE_MAX_RETRIES}.
   */
  readonly maxRetries?: Maybe<number>;
  /**
   * The longest wait a throttled request is retried after. A longer `Retry-After` is not retried (the 429
   * reaches the caller). Defaults to {@link DEFAULT_MICROSOFT_GRAPH_THROTTLE_MAX_RETRY_AFTER}.
   */
  readonly maxRetryAfter?: Maybe<Milliseconds>;
  /**
   * Called on every throttled response, e.g. to tell the user why a command is waiting.
   */
  readonly onThrottled?: Maybe<(details: MicrosoftGraphThrottleDetails) => void>;
}

/**
 * Returns whether a response is a throttle for the request that got it.
 *
 * @param status - The response status.
 * @param method - The request method.
 * @param retryAfter - The response's `Retry-After` wait, if any.
 * @returns True for a 429, a 503/504/509 to a GET or HEAD, or a 503/509 with `Retry-After` to any method.
 */
function isMicrosoftGraphThrottleResponse(status: number, method: string, retryAfter: Maybe<Milliseconds>): boolean {
  return status === 429 || (MICROSOFT_GRAPH_THROTTLE_READ_STATUSES.includes(status) && isMicrosoftGraphReadMethod(method)) || (retryAfter != null && MICROSOFT_GRAPH_THROTTLE_WITH_RETRY_AFTER_STATUSES.includes(status));
}

/**
 * Returns whether a method only reads, so sending it again cannot repeat a change.
 *
 * @param method - The request method.
 * @returns True for GET and HEAD.
 */
function isMicrosoftGraphReadMethod(method: string): boolean {
  const upper = method.toUpperCase();
  return upper === 'GET' || upper === 'HEAD';
}

/**
 * Creates the fetch handler that makes a Graph client honor throttling. It does nothing until a response is
 * throttled. Then it pauses every request of the client for the `Retry-After` wait (or an exponential backoff
 * when the response has none) and sends the throttled request again, as follows.
 *
 * - a 429 to any method is retried;
 * - a 503/504/509 to a GET or HEAD is retried. A 503/509 with `Retry-After` to any other method still pauses
 *   the client, but is not retried, because a write could be applied twice;
 * - a wait longer than `maxRetryAfter` pauses the client but is not retried;
 * - after `maxRetries` retries the last response reaches the caller.
 *
 * The first response that is not a throttle, once the pause is over, turns the pause off again.
 *
 * Wire it as the `fetchHandler` of the client's configured fetch, so it sits above the per-attempt timeout and
 * the ok-check: each attempt gets the full timeout, and the waits between attempts are not cut short.
 *
 * @param config - Retry limits and the throttle callback.
 * @returns The fetch handler.
 *
 * @see https://learn.microsoft.com/en-us/graph/throttling
 * @see https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online
 *
 * @__NO_SIDE_EFFECTS__
 */
export function microsoftGraphRateLimitedFetchHandler(config?: Maybe<MicrosoftGraphRateLimitedFetchHandlerConfig>): RateLimitedFetchHandler<ResetPeriodPromiseRateLimiter> {
  const maxRetries = config?.maxRetries ?? DEFAULT_MICROSOFT_GRAPH_THROTTLE_MAX_RETRIES;
  const maxRetryAfter = config?.maxRetryAfter ?? DEFAULT_MICROSOFT_GRAPH_THROTTLE_MAX_RETRY_AFTER;
  const onThrottled = config?.onThrottled;

  // a pause only: while enabled with nothing remaining, every request waits until the reset time. After it the
  // limit is never reached, and a zero maxWaitTime keeps the exponential wait at zero, so nothing else waits.
  const rateLimiter = resetPeriodPromiseRateLimiter({ limit: Number.MAX_SAFE_INTEGER, resetPeriod: MS_IN_SECOND, maxWaitTime: 0 });
  rateLimiter.setEnabled(false);

  let consecutiveThrottles = 0;
  let pausedUntil = 0;

  const inner = rateLimitedFetchHandler({
    rateLimiter,
    maxRetries,
    updateWithResponse: (response: Response, _error, request?: Request) => {
      const method = request?.method ?? 'GET';
      let retry = false;

      const retryAfter = parseRetryAfterHeader(response.headers.get('retry-after'));

      if (isMicrosoftGraphThrottleResponse(response.status, method, retryAfter)) {
        consecutiveThrottles += 1;
        const wait = retryAfter ?? exponentialBackoffDelay({ attempt: consecutiveThrottles });
        retry = wait <= maxRetryAfter && (response.status === 429 || isMicrosoftGraphReadMethod(method));

        pausedUntil = Math.max(pausedUntil, Date.now() + wait);
        rateLimiter.setEnabled(true);
        rateLimiter.setRemainingLimit(0);
        rateLimiter.setNextResetAt(new Date(pausedUntil));
        onThrottled?.({ status: response.status, wait, retrying: retry });
      } else if (rateLimiter.getEnabled() && Date.now() >= pausedUntil) {
        consecutiveThrottles = 0;
        rateLimiter.setEnabled(false);
      }

      return retry;
    }
  });

  // Request.clone() drops the non-standard `timeout` the request factory puts on the request, so hand it to
  // each attempt explicitly; otherwise the per-attempt timeout would silently turn off
  const fetchHandler: FetchHandler = (request, makeFetch) => {
    const timeout = (request as RequestWithTimeout).timeout;
    const attemptFetch = timeout == null ? makeFetch : (((input: RequestInfo | URL, init?: RequestInit) => makeFetch(input, { ...init, timeout } as RequestInit)) as typeof fetch);
    return inner(request, attemptFetch);
  };

  return Object.assign(fetchHandler, { _rateLimiter: rateLimiter });
}
