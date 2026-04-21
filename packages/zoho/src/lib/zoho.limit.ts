import { MS_IN_SECOND, type Maybe, type Milliseconds, type PromiseOrValue, type ResetPeriodPromiseRateLimiter, type ResetPeriodPromiseRateLimiterConfig, resetPeriodPromiseRateLimiter } from '@dereekb/util';
import { type FetchResponseError, type RateLimitedFetchHandler, rateLimitedFetchHandler } from '@dereekb/util/fetch';
import { DEFAULT_ZOHO_API_RATE_LIMIT, DEFAULT_ZOHO_API_RATE_LIMIT_RESET_PERIOD, ZOHO_TOO_MANY_REQUESTS_HTTP_STATUS_CODE, type ZohoRateLimitHeaderDetails, zohoRateLimitHeaderDetails } from './zoho.error.api';

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
export type ZohoRateLimitedTooManyRequestsLogFunction = (headers: ZohoRateLimitHeaderDetails | ZohoRateLimitResponseDetails, response: Response, fetchResponseError?: FetchResponseError) => PromiseOrValue<void>;

/**
 * Default handler that logs a warning to the console when the Zoho API rate limit is exceeded.
 *
 * @param details - Rate limit details extracted from the Zoho API response headers
 */
export const DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUESTS_LOG_FUNCTION = (details: ZohoRateLimitHeaderDetails | ZohoRateLimitResponseDetails) => {
  const limit = 'limit' in details ? details.limit : undefined;
  const resetAt = 'resetAt' in details ? details.resetAt : undefined;
  const limitMessage = limit != null ? ' The limit is ' + String(limit) + ' requests per reset period.' : '';
  const resetMessage = resetAt != null ? ' Will be reset at ' + String(resetAt) + '.' : '';
  console.warn('zohoRateLimitedFetchHandler(): Too many requests made.' + limitMessage + resetMessage);
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
   * The actual limit may be dynamically adjusted based on rate limit response headers.
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
   * Defaults to {@link DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUESTS_LOG_FUNCTION}.
   * Pass `false` to disable the callback entirely.
   */
  readonly onTooManyRequests?: ZohoRateLimitedTooManyRequestsLogFunction | false;
}

/**
 * A {@link RateLimitedFetchHandler} configured with a {@link ResetPeriodPromiseRateLimiter}
 * for Zoho API rate limiting. Exposes the underlying `_rateLimiter` for sharing across contexts.
 */
export type ZohoRateLimitedFetchHandler = RateLimitedFetchHandler<ResetPeriodPromiseRateLimiter>;

// MARK: Configurable Rate Limiter
/**
 * Service-agnostic rate limit details parsed from response headers.
 *
 * Each Zoho service (CRM, Recruit, Desk, etc.) provides its own reader function
 * that maps service-specific headers to this common shape.
 */
export interface ZohoRateLimitResponseDetails {
  /**
   * Number of remaining allowed requests in the current period.
   */
  readonly remaining: number;
  /**
   * Total request limit for the current period. Optional because some services
   * (e.g., Zoho Desk) do not provide this in response headers.
   */
  readonly limit?: Maybe<number>;
  /**
   * The time at which the rate limit window resets. Optional because the computation
   * differs per service (e.g., CRM provides a Unix timestamp, Desk provides a Retry-After in seconds).
   */
  readonly resetAt?: Maybe<Date>;
}

/**
 * Reads rate limit details from HTTP response headers.
 * Returns null when the expected headers are absent (e.g., error responses).
 */
export type ZohoReadRateLimitDetailsFunction = (headers: Headers) => Maybe<ZohoRateLimitResponseDetails>;

/**
 * Configuration for {@link makeZohoRateLimitedFetchHandler}, extending the base handler config
 * with a service-specific header reader function.
 */
export interface MakeZohoRateLimitedFetchHandlerConfig extends ZohoRateLimitedFetchHandlerConfig {
  /**
   * Parses service-specific rate limit headers into the common {@link ZohoRateLimitResponseDetails} shape.
   */
  readonly readRateLimitDetails: ZohoReadRateLimitDetailsFunction;
}

/**
 * Creates a {@link ZohoRateLimitedFetchHandler} using a configurable header reader function.
 *
 * This is the core rate limiter factory that all service-specific wrappers delegate to.
 * The handler uses an exponential backoff strategy with the following behavior:
 * - Rate limiting begins after 10% of the allowed requests have been made (`startLimitAt`)
 * - Wait times increase exponentially (rate 1.08) as more requests are made, capped at 10 seconds
 * - On each response, the limiter updates its remaining count and reset time via the provided reader
 * - When the API reports a different limit than configured, the limiter dynamically adjusts
 * - On 429 responses, the request is automatically retried after the rate limiter delay
 * - The limiter is disabled when responses lack rate limit headers (e.g., error responses)
 *
 * @param config - Configuration including the service-specific header reader, rate limit, reset period, and 429 handling
 * @returns A rate-limited fetch handler with the underlying rate limiter accessible via `_rateLimiter`
 */
export function makeZohoRateLimitedFetchHandler(config: MakeZohoRateLimitedFetchHandlerConfig): ZohoRateLimitedFetchHandler {
  const { readRateLimitDetails } = config;
  const onTooManyRequests = config.onTooManyRequests !== false ? (config.onTooManyRequests ?? DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUESTS_LOG_FUNCTION) : undefined;
  const defaultLimit = config.maxRateLimit ?? DEFAULT_ZOHO_API_RATE_LIMIT;
  const defaultResetPeriod = config.resetPeriod ?? DEFAULT_ZOHO_API_RATE_LIMIT_RESET_PERIOD;

  /**
   * Builds a rate limiter config derived from the given limit.
   * Called once at initialization with `defaultLimit`, and again dynamically
   * when the API's response headers report a different limit value.
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
    maxRetries: config.maxRetries,
    /**
     * Inspects each response for rate limit headers via the configured reader and updates
     * the limiter accordingly. Returns `true` to signal a retry when a 429 status is received.
     *
     * @param response - The HTTP response to inspect for rate limit headers
     * @param fetchResponseError - Optional fetch error if the response was an error
     * @returns Whether the request should be retried
     */
    updateWithResponse: function (response: Response, fetchResponseError?: FetchResponseError): PromiseOrValue<boolean> {
      const details = readRateLimitDetails(response.headers);
      let shouldRetry = false;
      let enabled = false;

      if (details) {
        const { remaining, limit, resetAt } = details;

        if (limit != null && limit !== defaultLimit) {
          const newConfig = configForLimit(limit, resetAt ?? undefined);
          rateLimiter.setConfig(newConfig, false);
        }

        rateLimiter.setRemainingLimit(remaining);

        if (resetAt) {
          rateLimiter.setNextResetAt(resetAt);
        }

        enabled = true;

        // only retry if it's a TOO MANY REQUESTS error
        if (response.status === ZOHO_TOO_MANY_REQUESTS_HTTP_STATUS_CODE) {
          shouldRetry = true;

          try {
            void onTooManyRequests?.(details, response, fetchResponseError);
          } catch {
            /* ignored */
          }
        }
      }

      rateLimiter.setEnabled(enabled);
      return shouldRetry;
    }
  });
}

/**
 * Creates a {@link ZohoRateLimitedFetchHandler} that throttles outgoing requests based on
 * Zoho's CRM/Recruit/Sign rate limit headers (`X-RATELIMIT-LIMIT`, `X-RATELIMIT-REMAINING`, `X-RATELIMIT-RESET`).
 *
 * This is a convenience wrapper around {@link makeZohoRateLimitedFetchHandler} pre-configured
 * with the standard Zoho rate limit header reader.
 *
 * @param config - Optional configuration for rate limit, reset period, and 429 handling
 * @returns A rate-limited fetch handler with the underlying rate limiter accessible via `_rateLimiter`
 */
export function zohoRateLimitedFetchHandler(config?: Maybe<ZohoRateLimitedFetchHandlerConfig>): ZohoRateLimitedFetchHandler {
  return makeZohoRateLimitedFetchHandler({
    ...config,
    readRateLimitDetails: zohoStandardRateLimitDetailsReader
  });
}

/**
 * Reads rate limit details from standard Zoho API response headers (`X-RATELIMIT-*`).
 * Used by CRM, Recruit, and Sign services.
 *
 * @param headers - HTTP response headers
 * @returns Parsed rate limit details, or null if headers are absent
 */
export function zohoStandardRateLimitDetailsReader(headers: Headers): Maybe<ZohoRateLimitResponseDetails> {
  const details = zohoRateLimitHeaderDetails(headers);
  let result: Maybe<ZohoRateLimitResponseDetails>;

  if (details) {
    result = {
      remaining: details.remaining,
      limit: details.limit,
      resetAt: details.resetAt
    };
  }

  return result;
}

// MARK: Compat
/**
 * @deprecated use DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUESTS_LOG_FUNCTION instead.
 */
export const DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUETS_LOG_FUNCTION = DEFAULT_ZOHO_RATE_LIMITED_TOO_MANY_REQUESTS_LOG_FUNCTION;
