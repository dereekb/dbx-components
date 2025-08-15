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
   */
  updateWithResponse(response: Response, fetchResponseError?: Maybe<FetchResponseError>): PromiseOrValue<boolean>;
}

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
        fetchResponseError = e as FetchResponseError;
        response = fetchResponseError.response;
      }

      // response could be null in some cases
      const shouldRetry = response ? await updateWithResponse(response, fetchResponseError) : false;

      if (shouldRetry && retriesAttempted < maxRetries) {
        response = await tryFetch(retriesAttempted + 1);
      } else {
        // re-throw the fetch response error if it exists and we cannot retry
        if (fetchResponseError != null) {
          throw fetchResponseError;
        }
      }

      // if response is null at this point but fetchResponseError is not, rethrow the error
      if (response == null && fetchResponseError != null) {
        throw fetchResponseError;
      }

      return response;
    }

    return tryFetch(0);
  };

  fetchHandler._rateLimiter = _rateLimiter;
  return fetchHandler;
}
