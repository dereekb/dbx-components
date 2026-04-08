import { MS_IN_SECOND, type Maybe, type Milliseconds, type PromiseOrValue, type ResetPeriodPromiseRateLimiter, type ResetPeriodPromiseRateLimiterConfig, resetPeriodPromiseRateLimiter } from '@dereekb/util';
import { type FetchResponseError, type RateLimitedFetchHandler, rateLimitedFetchHandler } from '@dereekb/util/fetch';
import { DEFAULT_ZOHO_API_RATE_LIMIT, DEFAULT_ZOHO_API_RATE_LIMIT_RESET_PERIOD, ZOHO_RATE_LIMIT_REMAINING_HEADER, ZOHO_TOO_MANY_REQUESTS_HTTP_STATUS_CODE, type ZohoRateLimitHeaderDetails, zohoRateLimitHeaderDetails } from './zoho.error.api';

/**
 * Reference interface for objects that expose the shared Zoho rate limiter instance.
 */
export interface ZohoRateLimiterRef {
  readonly zohoRateLimiter: ResetPeriodPromiseRateLimiter;
}

/**
 * Callback invoked when a 429 Too Many Requests response is received from the Zoho API.
 *
 * Typically used for logging or alerting. Any errors thrown by this function are silently ignored.
 */
export type ZohoRateLimitedTooManyRequestsLogFunction = (headers: ZohoRateLimitHeaderDetails, response: Response, fetchResponseError?: FetchResponseError) => PromiseOrValue<void>;

/**
 * Default handler that logs a warning to the console when the Zoho API rate limit is exceeded.
 *
 * @param headers - Rate limit details extracted from the Zoho API response headers
 */
export const DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUESTS_LOG_FUNCTION = (headers: ZohoRateLimitHeaderDetails) => {
  console.warn(`zohoRateLimitedFetchHandler(): Too many requests made. The limit is ${headers.limit} requests per reset period. Will be reset at ${headers.resetAt}.`);
};

/**
 * Configuration for the Zoho rate-limited fetch handler, allowing customization of
 * the rate limit, reset period, and 429 response handling.
 */
export interface ZohoRateLimitedFetchHandlerConfig {
  /**
   * Custom maximum number of requests allowed per reset period.
   *
   * Defaults to {@link DEFAULT_ZOHO_API_RATE_LIMIT} (100 requests).
   * The actual limit may be dynamically adjusted based on `X-RATELIMIT-LIMIT` response headers.
   *
   * Rate limits vary by Zoho account type:
   *
   * @see https://help.zoho.com/portal/en/community/topic/key-changes-in-api-limits-26-9-2018#:~:text=X%2DRATELIMIT%2DREMAINING%20%2D%20Represents,time%20of%20the%20current%20window.&text=Please%20note%20that%20these%20Rate,API%20limit%20changes%20are%20implemented.
   */
  readonly maxRateLimit?: number;
  /**
   * Custom reset period for the rate limiter in milliseconds.
   *
   * Defaults to {@link DEFAULT_ZOHO_API_RATE_LIMIT_RESET_PERIOD} (1 minute).
   */
  readonly resetPeriod?: Milliseconds;
  /**
   * Maximum number of automatic retries when a 429 Too Many Requests response is received.
   *
   * Defaults to 1. Set to 0 to disable retries entirely, which causes the 429 error to be
   * immediately thrown to the caller instead of waiting for the rate limit reset.
   */
  readonly maxRetries?: number;
  /**
   * Optional callback invoked when a 429 Too Many Requests response is received.
   *
   * Defaults to {@link DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUETS_LOG_FUNCTION}.
   * Pass `false` to disable the callback entirely.
   */
  readonly onTooManyRequests?: ZohoRateLimitedTooManyRequestsLogFunction | false;
}

/**
 * A {@link RateLimitedFetchHandler} configured with a {@link ResetPeriodPromiseRateLimiter}
 * for Zoho API rate limiting. Exposes the underlying `_rateLimiter` for sharing across contexts.
 */
export type ZohoRateLimitedFetchHandler = RateLimitedFetchHandler<ResetPeriodPromiseRateLimiter>;

/**
 * Creates a {@link ZohoRateLimitedFetchHandler} that throttles outgoing requests based on
 * Zoho's rate limit headers (`X-RATELIMIT-LIMIT`, `X-RATELIMIT-REMAINING`, `X-RATELIMIT-RESET`).
 *
 * The handler uses an exponential backoff strategy with the following behavior:
 * - Rate limiting begins after 10% of the allowed requests have been made (`startLimitAt`)
 * - Wait times increase exponentially (rate 1.08) as more requests are made, capped at 10 seconds
 * - On each response, the limiter updates its remaining count and reset time from headers
 * - When the API returns a different limit than configured, the limiter dynamically adjusts
 * - On 429 responses, the request is automatically retried after the rate limiter delay
 * - The limiter is disabled when responses lack rate limit headers (e.g., error responses)
 *
 * @param config - Optional configuration for rate limit, reset period, and 429 handling
 * @returns A rate-limited fetch handler with the underlying rate limiter accessible via `_rateLimiter`
 */
export function zohoRateLimitedFetchHandler(config?: Maybe<ZohoRateLimitedFetchHandlerConfig>): ZohoRateLimitedFetchHandler {
  const onTooManyRequests = config?.onTooManyRequests !== false ? (config?.onTooManyRequests ?? DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUESTS_LOG_FUNCTION) : undefined;
  const defaultLimit = config?.maxRateLimit ?? DEFAULT_ZOHO_API_RATE_LIMIT;
  const defaultResetPeriod = config?.resetPeriod ?? DEFAULT_ZOHO_API_RATE_LIMIT_RESET_PERIOD;

  /**
   * Builds a rate limiter config derived from the given limit.
   * Called once at initialization with `defaultLimit`, and again dynamically
   * when the API's `X-RATELIMIT-LIMIT` header reports a different value.
   *
   * @param limit - Maximum number of requests allowed per reset period
   * @param resetAt - Optional date when the rate limit window resets
   * @returns Rate limiter configuration scaled to the given limit
   */
  function configForLimit(limit: number, resetAt?: Date): ResetPeriodPromiseRateLimiterConfig {
    return {
      limit,
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
    maxRetries: config?.maxRetries,
    /**
     * Inspects each response for Zoho rate limit headers and updates the limiter accordingly.
     * Returns `true` to signal a retry when a 429 status is received.
     *
     * @param response - The HTTP response to inspect for rate limit headers
     * @param fetchResponseError - Optional fetch error if the response was an error
     * @returns Whether the request should be retried
     */
    updateWithResponse: function (response: Response, fetchResponseError?: FetchResponseError): PromiseOrValue<boolean> {
      const hasLimitHeader = response.headers.has(ZOHO_RATE_LIMIT_REMAINING_HEADER);
      let shouldRetry = false;
      let enabled = false;

      if (hasLimitHeader) {
        const headerDetails = zohoRateLimitHeaderDetails(response.headers);

        if (headerDetails) {
          const { limit, resetAt, remaining } = headerDetails;

          if (limit && limit !== defaultLimit) {
            const newConfig = configForLimit(limit, resetAt);
            rateLimiter.setConfig(newConfig, false);
          }

          rateLimiter.setRemainingLimit(remaining);
          rateLimiter.setNextResetAt(resetAt);
          enabled = true;

          // only retry if it's a TOO MANY REQUESTS error
          if (response.status === ZOHO_TOO_MANY_REQUESTS_HTTP_STATUS_CODE) {
            shouldRetry = true;

            try {
              void onTooManyRequests?.(headerDetails, response, fetchResponseError);
            } catch {
              /* ignored */
            }
          }
        }
      }

      rateLimiter.setEnabled(enabled);
      return shouldRetry;
    }
  });
}

// MARK: Compat
/**
 * @deprecated use DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUESTS_LOG_FUNCTION instead.
 */
export const DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUETS_LOG_FUNCTION = DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUESTS_LOG_FUNCTION;
