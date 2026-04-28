import { MS_IN_SECOND, type Maybe } from '@dereekb/util';
import { type ZohoRateLimitResponseDetails, type ZohoRateLimitedFetchHandler, type ZohoRateLimitedFetchHandlerConfig, makeZohoRateLimitedFetchHandler } from '../zoho.limit';

// MARK: Desk Rate Limit Headers
/**
 * Header name for the credit weight consumed by the last Zoho Desk API request.
 */
export const ZOHO_DESK_RATE_LIMIT_WEIGHT_HEADER = 'X-Rate-Limit-Request-Weight-v3';

/**
 * Header name for the remaining API credits in the current Zoho Desk rate limit window.
 */
export const ZOHO_DESK_RATE_LIMIT_REMAINING_HEADER = 'X-Rate-Limit-Remaining-v3';

/**
 * Header name indicating how many seconds to wait before retrying after a Zoho Desk 429 response.
 */
export const ZOHO_DESK_RETRY_AFTER_HEADER = 'Retry-After';

/**
 * Default rate limit for Zoho Desk API requests (credits per minute).
 */
export const DEFAULT_ZOHO_DESK_API_RATE_LIMIT = 200;

/**
 * Reads rate limit details from Zoho Desk v3 response headers.
 *
 * Desk uses a credit-based system with `X-Rate-Limit-Remaining-v3` and `Retry-After` (in seconds)
 * rather than the `X-RATELIMIT-*` headers used by CRM/Recruit/Sign.
 *
 * @param headers - HTTP response headers from a Zoho Desk API call
 * @returns Parsed rate limit details, or null if the Desk rate limit headers are absent
 */
export function zohoDeskRateLimitDetailsReader(headers: Headers): Maybe<ZohoRateLimitResponseDetails> {
  const remainingHeader = headers.get(ZOHO_DESK_RATE_LIMIT_REMAINING_HEADER);
  let result: Maybe<ZohoRateLimitResponseDetails>;

  if (remainingHeader != null) {
    const remaining = Number(remainingHeader);
    let resetAt: Maybe<Date>;

    const retryAfterHeader = headers.get(ZOHO_DESK_RETRY_AFTER_HEADER);

    if (retryAfterHeader != null) {
      const retryAfterSeconds = Number(retryAfterHeader);

      if (!Number.isNaN(retryAfterSeconds)) {
        resetAt = new Date(Date.now() + retryAfterSeconds * MS_IN_SECOND);
      }
    }

    if (!Number.isNaN(remaining)) {
      result = { remaining, resetAt };
    }
  }

  return result;
}

/**
 * Creates a {@link ZohoRateLimitedFetchHandler} configured for Zoho Desk's v3 rate limit headers.
 *
 * This is a convenience wrapper around {@link makeZohoRateLimitedFetchHandler} pre-configured
 * with the Desk-specific header reader. Unlike CRM, Desk does not provide a total limit header,
 * so the configured `maxRateLimit` (defaulting to {@link DEFAULT_ZOHO_DESK_API_RATE_LIMIT}) is used throughout.
 *
 * @param config - Optional configuration for rate limit, reset period, and 429 handling
 * @returns A rate-limited fetch handler with the underlying rate limiter accessible via `_rateLimiter`
 */
export function zohoDeskRateLimitedFetchHandler(config?: Maybe<ZohoRateLimitedFetchHandlerConfig>): ZohoRateLimitedFetchHandler {
  return makeZohoRateLimitedFetchHandler({
    maxRateLimit: DEFAULT_ZOHO_DESK_API_RATE_LIMIT,
    ...config,
    readRateLimitDetails: zohoDeskRateLimitDetailsReader
  });
}
