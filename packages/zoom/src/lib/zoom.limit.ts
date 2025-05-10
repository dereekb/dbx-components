import { MS_IN_SECOND, Maybe, Milliseconds, PromiseOrValue, ResetPeriodPromiseRateLimiter, ResetPeriodPromiseRateLimiterConfig, resetPeriodPromiseRateLimiter } from '@dereekb/util';
import { FetchResponseError, RateLimitedFetchHandler, rateLimitedFetchHandler } from '@dereekb/util/fetch';
import { DEFAULT_ZOOM_API_RATE_LIMIT, DEFAULT_ZOOM_API_RATE_LIMIT_RESET_PERIOD, ZOOM_RATE_LIMIT_REMAINING_HEADER, ZOOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE, ZoomRateLimitHeaderDetails, zoomRateLimitHeaderDetails } from './zoom.error.api';

export interface ZoomRateLimiterRef {
  readonly zoomRateLimiter: ResetPeriodPromiseRateLimiter;
}

/**
 * Function to execute when too many requests is reached.
 *
 * Typically used for logging of some sort. Thrown errors are ignored.
 */
export type ZoomRateLimitedTooManyRequestsLogFunction = (headers: ZoomRateLimitHeaderDetails, response: Response, fetchResponseError?: FetchResponseError) => PromiseOrValue<void>;

export const DEFAULT_ZOOM_RATE_LIMITED_TOO_MANY_REQUETS_LOG_FUNCTION = (headers: ZoomRateLimitHeaderDetails) => {
  console.warn(`zoomRateLimitedFetchHandler(): Too many requests made. The limit is ${headers.limit} requests per reset period. RetryAt is set for ${headers.retryAfterAt}.`);
};

export interface ZoomRateLimitedFetchHandlerConfig {
  /**
   * Custom max rate limit.
   *
   * Rate limits are different between account types and are described here:
   *
   * https://help.zoom.com/portal/en/community/topic/key-changes-in-api-limits-26-9-2018#:~:text=X%2DRATELIMIT%2DREMAINING%20%2D%20Represents,time%20of%20the%20current%20window.&text=Please%20note%20that%20these%20Rate,API%20limit%20changes%20are%20implemented.
   */
  readonly maxRateLimit?: number;
  /**
   * Custom reset period for the rate limiter.
   *
   * Defaults to 1 minute in milliseconds.
   */
  readonly resetPeriod?: Milliseconds;
  /**
   * Optional function to execute when too many requests is reached.t
   *
   * Defaults to the default logging function, unless false is passed.
   */
  readonly onTooManyRequests?: ZoomRateLimitedTooManyRequestsLogFunction | false;
}

export type ZoomRateLimitedFetchHandler = RateLimitedFetchHandler<ResetPeriodPromiseRateLimiter>;

export function zoomRateLimitedFetchHandler(config?: Maybe<ZoomRateLimitedFetchHandlerConfig>): ZoomRateLimitedFetchHandler {
  const onTooManyRequests = config?.onTooManyRequests !== false ? (config?.onTooManyRequests ?? DEFAULT_ZOOM_RATE_LIMITED_TOO_MANY_REQUETS_LOG_FUNCTION) : undefined;
  const defaultLimit = config?.maxRateLimit ?? DEFAULT_ZOOM_API_RATE_LIMIT;
  const defaultResetPeriod = config?.resetPeriod ?? DEFAULT_ZOOM_API_RATE_LIMIT_RESET_PERIOD;

  function configForLimit(limit: number, resetAt?: Date): ResetPeriodPromiseRateLimiterConfig {
    return {
      limit: defaultLimit,
      startLimitAt: Math.ceil(limit / 10), // can do 10% of the requests of the limit before rate limiting begins
      cooldownRate: 1.2 * (limit / (defaultResetPeriod / MS_IN_SECOND)),
      exponentRate: 1.08,
      maxWaitTime: MS_IN_SECOND * 10,
      resetPeriod: defaultResetPeriod,
      resetAt
    };
  }

  const defaultConfig = configForLimit(defaultLimit);
  const rateLimiter = resetPeriodPromiseRateLimiter(defaultConfig);

  return rateLimitedFetchHandler({
    rateLimiter,
    updateWithResponse: function (response: Response, fetchResponseError?: FetchResponseError): PromiseOrValue<boolean> {
      const hasLimitHeader = response.headers.has(ZOOM_RATE_LIMIT_REMAINING_HEADER);
      let shouldRetry = false;
      let enabled = false;

      if (hasLimitHeader) {
        const headerDetails = zoomRateLimitHeaderDetails(response.headers);

        if (headerDetails) {
          const { limit, retryAfterAt, remaining } = headerDetails;

          if (limit !== defaultLimit) {
            const newConfig = configForLimit(limit, retryAfterAt);
            rateLimiter.setConfig(newConfig, false);
          }

          rateLimiter.setRemainingLimit(remaining);
          rateLimiter.setNextResetAt(retryAfterAt);
          enabled = true;

          // only retry if it's a TOO MANY REQUESTS error
          if (response.status === ZOOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE) {
            shouldRetry = true;

            try {
              onTooManyRequests?.(headerDetails, response, fetchResponseError);
            } catch (e) {}
          }
        }
      }

      rateLimiter.setEnabled(enabled);
      return shouldRetry;
    }
  });
}
