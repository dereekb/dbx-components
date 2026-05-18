import { MS_IN_SECOND, type Maybe, type Milliseconds, type ResetPeriodPromiseRateLimiter, resetPeriodPromiseRateLimiter } from '@dereekb/util';
import { rateLimitedFetchHandler, type RateLimitedFetchHandler } from '@dereekb/util/fetch';

/**
 * Documented per-token rate limit: 100 requests per 10 seconds.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/
 */
export const DEFAULT_TRELLO_API_RATE_LIMIT = 100;

/**
 * Reset period for the per-token rate limit (10 seconds).
 */
export const DEFAULT_TRELLO_API_RATE_LIMIT_RESET_PERIOD: Milliseconds = MS_IN_SECOND * 10;

export interface TrelloRateLimiterRef {
  readonly trelloRateLimiter: ResetPeriodPromiseRateLimiter;
}

export interface TrelloRateLimitedFetchHandlerConfig {
  /**
   * Maximum number of requests allowed per reset period.
   *
   * Defaults to DEFAULT_TRELLO_API_RATE_LIMIT.
   */
  readonly maxRateLimit?: number;
  /**
   * Reset period for the rate limiter, in milliseconds.
   *
   * Defaults to DEFAULT_TRELLO_API_RATE_LIMIT_RESET_PERIOD.
   */
  readonly resetPeriod?: Milliseconds;
}

export type TrelloRateLimitedFetchHandler = RateLimitedFetchHandler<ResetPeriodPromiseRateLimiter>;

/**
 * Creates a rate-limited fetch handler configured for the Trello API.
 *
 * Backs off after 429 responses and respects the documented per-token rate limit.
 *
 * @param config - Optional configuration for rate limiting behavior.
 * @returns A configured rate-limited fetch handler.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function trelloRateLimitedFetchHandler(config?: Maybe<TrelloRateLimitedFetchHandlerConfig>): TrelloRateLimitedFetchHandler {
  const limit = config?.maxRateLimit ?? DEFAULT_TRELLO_API_RATE_LIMIT;
  const resetPeriod = config?.resetPeriod ?? DEFAULT_TRELLO_API_RATE_LIMIT_RESET_PERIOD;

  const rateLimiter = resetPeriodPromiseRateLimiter({
    limit,
    startLimitAt: Math.max(2, Math.ceil(limit / 10)),
    cooldownRate: 1,
    exponentRate: 1.1,
    maxWaitTime: MS_IN_SECOND * 10,
    resetPeriod
  });

  return rateLimitedFetchHandler({
    rateLimiter,
    updateWithResponse: (response: Response) => {
      // Trello does not document rate limit headers, but it does return 429 when exceeded.
      // Schedule a retry after the rate limiter cooldown when a 429 is observed.
      return response.status === 429;
    }
  });
}
