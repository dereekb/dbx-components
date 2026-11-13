import { type Maybe, type PromiseOrValue, type PromiseRateLimiter } from '@dereekb/util';
import { type FetchHandler } from './fetch';
import { type FetchResponseError } from './error';

/**
 * A FetchRequestFactory with PromiseRateLimiter
 */
export type RateLimitedFetchHandler<T extends PromiseRateLimiter = PromiseRateLimiter> = FetchHandler & {
  /**
   * Internal limiter used by the RateLimitedFetchRequestFactory.
   */
  readonly _rateLimiter: T;
};

export interface RateLimitedFetchHandlerConfig<T extends PromiseRateLimiter> {
  /**
   * Rate limiter configuration. Should be based on the target API.
   */
  readonly rateLimiter: T;
  /**
   * The maximum number of retries to try.
   *
   * Defaults to 1.
   */
  readonly maxRetries?: number;
  /**
   * Update the fetch handler with the response, ideally setting/updating the time at which the rate limiter can be reset.
   *
   * Return true if the response should be retried. Should typically also only return true if the response is a throttle error by the remote server.
   *
   * The response is only allowed to be retried once not guranteed to be retried if it returns true on a second retry.
   *
   * Only called when there is a response: an error without one (an abort, a timeout, a network failure) is rethrown
   * to the caller untouched.
   *
   * @param response - The response, or the response of the thrown FetchResponseError.
   * @param fetchResponseError - The error the fetch threw for a non-ok response, if any.
   * @param request - The request that was sent, e.g. to only retry idempotent methods.
   */
  updateWithResponse(response: Response, fetchResponseError?: Maybe<FetchResponseError>, request?: Request): PromiseOrValue<boolean>;
}

/**
 * Creates a FetchHandler that enforces rate limiting via the provided PromiseRateLimiter and supports
 * automatic retry when the server signals throttling.
 *
 * @param config - Configuration containing the rate limiter, retry settings, and response handler.
 * @returns A RateLimitedFetchHandler that rate-limits outgoing requests and retries on throttle responses.
 */
export function rateLimitedFetchHandler<T extends PromiseRateLimiter>(config: RateLimitedFetchHandlerConfig<T>): RateLimitedFetchHandler<T> {
  const { updateWithResponse, maxRetries: inputMaxRetries } = config;
  const maxRetries = inputMaxRetries ?? 1;

  const _rateLimiter: T = config.rateLimiter;

  const fetchHandler = async (request: Request, makeFetch: typeof fetch) => {
    async function tryFetch(retriesAttempted: number): Promise<Response> {
      // wait for the rate limiter
      await _rateLimiter.waitForRateLimit();

      let response: Response;
      let fetchResponseError: Maybe<FetchResponseError>;

      try {
        response = await makeFetch(request.clone());
      } catch (e) {
        // an abort, timeout or network error carries no response: there is nothing to rate-limit on, so it reaches the caller as-is
        if ((e as Maybe<Partial<FetchResponseError>>)?.response == null) {
          throw e;
        }

        fetchResponseError = e as FetchResponseError;
        response = fetchResponseError.response;
      }

      const shouldRetry = await updateWithResponse(response, fetchResponseError, request);

      if (shouldRetry && retriesAttempted < maxRetries) {
        response = await tryFetch(retriesAttempted + 1);
      } else {
        // re-throw the fetch response error if it exists and we cannot retry
        if (fetchResponseError != null) {
          throw fetchResponseError;
        }
      }

      return response;
    }

    return tryFetch(0);
  };

  fetchHandler._rateLimiter = _rateLimiter;
  return fetchHandler;
}
