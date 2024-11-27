import { MS_IN_MINUTE, MS_IN_SECOND, Maybe, Milliseconds, PromiseOrValue, ResetPeriodPromiseRateLimiter, resetPeriodPromiseRateLimiter } from '@dereekb/util';
import { FetchResponseError, RateLimitedFetchHandler, rateLimitedFetchHandler } from '@dereekb/util/fetch';
import { DEFAULT_ZOHO_API_RATE_LIMIT, DEFAULT_ZOHO_API_RATE_LIMIT_RESET_PERIOD, ZOHO_RATE_LIMIT_REMAINING_HEADER, ZOHO_RATE_LIMIT_RESET_HEADER, ZOHO_TOO_MANY_REQUESTS_HTTP_STATUS_CODE, zohoRateLimitHeaderDetails } from './zoho.error.api';

export interface ZohoRateLimiterRef {
  readonly zohoRateLimiter: ResetPeriodPromiseRateLimiter;
}

export interface ZohoRateLimitedFetchHandlerConfig {
  /**
   * Custom max rate limit.
   *
   * Rate limits are different between account types and are described here:
   *
   * https://help.zoho.com/portal/en/community/topic/key-changes-in-api-limits-26-9-2018#:~:text=X%2DRATELIMIT%2DREMAINING%20%2D%20Represents,time%20of%20the%20current%20window.&text=Please%20note%20that%20these%20Rate,API%20limit%20changes%20are%20implemented.
   */
  readonly maxRateLimit?: number;
  /**
   * Custom reset period for the rate limiter.
   *
   * Defaults to 1 minute in milliseconds.
   */
  readonly resetPeriod?: Milliseconds;
}

export type ZohoRateLimitedFetchHandler = RateLimitedFetchHandler<ResetPeriodPromiseRateLimiter>;

export function zohoRateLimitedFetchHandler(config?: Maybe<ZohoRateLimitedFetchHandlerConfig>): ZohoRateLimitedFetchHandler {
  const defaultLimit = config?.maxRateLimit ?? DEFAULT_ZOHO_API_RATE_LIMIT;
  const defaultResetPeriod = config?.resetPeriod ?? DEFAULT_ZOHO_API_RATE_LIMIT_RESET_PERIOD;

  function configForLimit(limit: number, resetAt?: Date) {
    return {
      limit: defaultLimit,
      cooldownRate: limit / (defaultResetPeriod / MS_IN_SECOND),
      exponentRate: 1.12,
      maxWaitTime: MS_IN_SECOND * 10,
      resetPeriod: defaultResetPeriod
    };
  }

  const defaultConfig = configForLimit(defaultLimit);
  const rateLimiter = resetPeriodPromiseRateLimiter(defaultConfig);

  return rateLimitedFetchHandler({
    rateLimiter,
    updateWithResponse: function (response: Response, fetchResponseError?: FetchResponseError): PromiseOrValue<boolean> {
      const hasLimitHeader = response.headers.has(ZOHO_RATE_LIMIT_REMAINING_HEADER);
      let shouldRetry = false;
      let enabled = false;

      if (hasLimitHeader) {
        const headerDetails = zohoRateLimitHeaderDetails(response.headers);

        if (headerDetails) {
          const { limit, resetAt, remaining } = headerDetails;

          if (limit !== defaultLimit) {
            const newConfig = configForLimit(limit, resetAt);
            rateLimiter.setConfig(newConfig, false);
          }

          rateLimiter.setRemainingLimit(remaining);
          rateLimiter.setNextResetAt(resetAt);
          enabled = true;

          // only retry if it's a TOO MANY REQUESTS error
          shouldRetry = response.status === ZOHO_TOO_MANY_REQUESTS_HTTP_STATUS_CODE;
        }
      }

      rateLimiter.setEnabled(enabled);
      return shouldRetry;
    }
  });
}
