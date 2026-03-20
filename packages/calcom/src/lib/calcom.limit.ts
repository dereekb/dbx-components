import { MS_IN_SECOND, type Maybe, type Milliseconds, type PromiseOrValue, type ResetPeriodPromiseRateLimiter, type ResetPeriodPromiseRateLimiterConfig, resetPeriodPromiseRateLimiter } from '@dereekb/util';
import { type FetchResponseError, type RateLimitedFetchHandler, rateLimitedFetchHandler } from '@dereekb/util/fetch';
import { CALCOM_RATE_LIMIT_REMAINING_HEADER, CALCOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE, DEFAULT_CALCOM_API_RATE_LIMIT, DEFAULT_CALCOM_API_RATE_LIMIT_RESET_PERIOD, type CalcomRateLimitHeaderDetails, calcomRateLimitHeaderDetails } from './calcom.error.api';

export interface CalcomRateLimiterRef {
  readonly calcomRateLimiter: ResetPeriodPromiseRateLimiter;
}

/**
 * Function to execute when too many requests is reached.
 *
 * Typically used for logging of some sort. Thrown errors are ignored.
 */
export type CalcomRateLimitedTooManyRequestsLogFunction = (headers: CalcomRateLimitHeaderDetails, response: Response, fetchResponseError?: FetchResponseError) => PromiseOrValue<void>;

export const DEFAULT_CALCOM_RATE_LIMITED_TOO_MANY_REQUESTS_LOG_FUNCTION = (headers: CalcomRateLimitHeaderDetails) => {
  console.warn(`calcomRateLimitedFetchHandler(): Too many requests made. The limit is ${headers.limit} requests per reset period. ResetAt is set for ${headers.resetAt}.`);
};

export interface CalcomRateLimitedFetchHandlerConfig {
  /**
   * Custom max rate limit.
   *
   * Cal.com allows 120 req/min. We default to 100 as a conservative limit.
   */
  readonly maxRateLimit?: number;
  /**
   * Custom reset period for the rate limiter.
   *
   * Defaults to 1 minute in milliseconds.
   */
  readonly resetPeriod?: Milliseconds;
  /**
   * Optional function to execute when too many requests is reached.
   *
   * Defaults to the default logging function, unless false is passed.
   */
  readonly onTooManyRequests?: CalcomRateLimitedTooManyRequestsLogFunction | false;
}

export type CalcomRateLimitedFetchHandler = RateLimitedFetchHandler<ResetPeriodPromiseRateLimiter>;

/**
 * Creates a rate-limited fetch handler configured for Cal.com API rate limits.
 * Automatically adjusts based on rate limit response headers and retries on 429 responses.
 *
 * @param config - optional rate limiter configuration overrides
 * @returns a CalcomRateLimitedFetchHandler that enforces rate limiting
 */
export function calcomRateLimitedFetchHandler(config?: Maybe<CalcomRateLimitedFetchHandlerConfig>): CalcomRateLimitedFetchHandler {
  const onTooManyRequests = config?.onTooManyRequests !== false ? (config?.onTooManyRequests ?? DEFAULT_CALCOM_RATE_LIMITED_TOO_MANY_REQUESTS_LOG_FUNCTION) : undefined;
  const defaultLimit = config?.maxRateLimit ?? DEFAULT_CALCOM_API_RATE_LIMIT;
  const defaultResetPeriod = config?.resetPeriod ?? DEFAULT_CALCOM_API_RATE_LIMIT_RESET_PERIOD;

  function configForLimit(limit: number, resetAt?: Date): ResetPeriodPromiseRateLimiterConfig {
    return {
      limit: defaultLimit,
      startLimitAt: 10,
      cooldownRate: 1.2,
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
      const hasRemainingHeader = response.headers.has(CALCOM_RATE_LIMIT_REMAINING_HEADER);
      let shouldRetry = false;

      if (hasRemainingHeader) {
        const headerDetails = calcomRateLimitHeaderDetails(response.headers);

        if (headerDetails) {
          const { limit, remaining, resetAt } = headerDetails;

          if (response.status === CALCOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE) {
            shouldRetry = true;

            try {
              void onTooManyRequests?.(headerDetails, response, fetchResponseError);
            } catch {
              // ignore logging errors
            }
          }

          if (limit != null && resetAt != null && remaining != null) {
            if (limit !== defaultLimit) {
              const newConfig = configForLimit(limit, resetAt);
              rateLimiter.setConfig(newConfig, false);
            }

            rateLimiter.setRemainingLimit(remaining);
            rateLimiter.setNextResetAt(resetAt);
          }
        }
      } else if (response.status === CALCOM_TOO_MANY_REQUESTS_HTTP_STATUS_CODE) {
        shouldRetry = true;

        try {
          const headerDetails: CalcomRateLimitHeaderDetails = {};
          void onTooManyRequests?.(headerDetails, response, fetchResponseError);
        } catch {
          // ignore logging errors
        }
      }

      return shouldRetry;
    }
  });
}
