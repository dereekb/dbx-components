import { MS_IN_MINUTE, type Maybe } from '@dereekb/util';
import { type ZohoRateLimitedFetchHandler, type ZohoRateLimitedFetchHandlerConfig, makeZohoRateLimitedFetchHandler, zohoStandardRateLimitDetailsReader } from '../zoho.limit';

/**
 * Overall Zoho Analytics API request limit per minute, across every API type.
 *
 * @see https://www.zoho.com/analytics/api/v2/api-limits-pricing/api-frequency.html
 */
export const DEFAULT_ZOHO_ANALYTICS_API_RATE_LIMIT = 100;

/**
 * Per-minute request limit for Zoho Analytics bulk (import/export) operations.
 *
 * Pass this as `maxRateLimit` for a client dedicated to bulk work.
 *
 * @see https://www.zoho.com/analytics/api/v2/api-limits-pricing/api-frequency.html
 */
export const ZOHO_ANALYTICS_BULK_API_RATE_LIMIT = 40;

/**
 * Per-minute request limit for Zoho Analytics metadata operations.
 *
 * @see https://www.zoho.com/analytics/api/v2/api-limits-pricing/api-frequency.html
 */
export const ZOHO_ANALYTICS_METADATA_API_RATE_LIMIT = 60;

/**
 * Per-minute request limit for Zoho Analytics DML (row-level) operations.
 *
 * @see https://www.zoho.com/analytics/api/v2/api-limits-pricing/api-frequency.html
 */
export const ZOHO_ANALYTICS_DML_API_RATE_LIMIT = 100;

/**
 * Reset period for the Zoho Analytics request frequency limit.
 */
export const ZOHO_ANALYTICS_API_RATE_LIMIT_RESET_PERIOD = MS_IN_MINUTE;

/**
 * Creates a {@link ZohoRateLimitedFetchHandler} configured for Zoho Analytics' documented request
 * frequency limit.
 *
 * Zoho Analytics documents a fixed limit but returns no rate limit headers at all, and does not
 * document a status code for a throttled request — throttling is reported as error code `6045`
 * (per-minute) or `6043`/`6044` (daily unit quota) inside the response body, which this handler
 * cannot inspect without consuming it. The limiter therefore runs in self-counting mode via
 * `enabledWithoutRateLimitDetails`, pacing requests against {@link DEFAULT_ZOHO_ANALYTICS_API_RATE_LIMIT}
 * rather than synchronizing with the server.
 *
 * The standard `X-RATELIMIT-*` reader is still supplied so that the limiter synchronizes
 * automatically should Analytics begin returning those headers.
 *
 * Throttling that does slip through is surfaced to callers as a `ZohoTooManyRequestsError` by
 * the Analytics error parser.
 *
 * @param config - Optional configuration for rate limit, reset period, and 429 handling.
 * @returns A rate-limited fetch handler with the underlying rate limiter accessible via `_rateLimiter`
 *
 * @see https://www.zoho.com/analytics/api/v2/api-limits-pricing/api-frequency.html
 */
export function zohoAnalyticsRateLimitedFetchHandler(config?: Maybe<ZohoRateLimitedFetchHandlerConfig>): ZohoRateLimitedFetchHandler {
  return makeZohoRateLimitedFetchHandler({
    maxRateLimit: DEFAULT_ZOHO_ANALYTICS_API_RATE_LIMIT,
    resetPeriod: ZOHO_ANALYTICS_API_RATE_LIMIT_RESET_PERIOD,
    ...config,
    readRateLimitDetails: zohoStandardRateLimitDetailsReader,
    enabledWithoutRateLimitDetails: true
  });
}
