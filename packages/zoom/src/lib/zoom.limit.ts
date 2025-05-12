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
   * The QPS is the main rate limit to watch for. We start slowing down requets after 2 requests per second.
   */
  readonly maxRateLimit?: number;
  /**
   * Custom reset period for the rate limiter.
   *
   * Defaults to 1 second in milliseconds.
   */
  readonly resetPeriod?: Milliseconds;
  /**
   * Optional function to execute when too many requests is reached.
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
      startLimitAt: 2,
      cooldownRate: 1,
      exponentRate: 1.2,
      maxWaitTime: MS_IN_SECOND * 5,
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
      // let enabled = false;   // rate limiter should not be turned off

      if (hasLimitHeader) {
        const headerDetails = zoomRateLimitHeaderDetails(response.headers);

        if (headerDetails) {
          const { type, limit, retryAfterAt, remaining } = headerDetails;

          if (response.status === ZOOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE) {
            // For simple query-per-second rate limits, just schedule a retry
            if (type === 'QPS') {
              shouldRetry = true;

              try {
                onTooManyRequests?.(headerDetails, response, fetchResponseError);
              } catch (e) {}
            }
          }

          // NOTE: typically it seems like these headers are not available usually.
          // There is a daily limit for message requests
          if (limit != null && retryAfterAt != null && remaining != null) {
            if (limit !== defaultLimit) {
              const newConfig = configForLimit(limit, retryAfterAt);
              rateLimiter.setConfig(newConfig, false);
            }

            rateLimiter.setRemainingLimit(remaining);
            rateLimiter.setNextResetAt(retryAfterAt);
            // enabled = true;
          }
        }
      }

      // rateLimiter.setEnabled(enabled);
      return shouldRetry;
    }
  });
}
