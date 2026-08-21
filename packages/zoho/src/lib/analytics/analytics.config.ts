import { type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZohoApiUrl, type ZohoApiUrlKey, type ZohoConfig, type ZohoApiServiceName } from '../zoho.config';
import { type ZohoAccessTokenStringFactory, type ZohoServiceAccessTokenKey } from '../accounts';
import { type ZohoRateLimiterRef } from '../zoho.limit';
import { type ZohoAnalyticsOrgId } from './analytics';

/**
 * Service identifier used for Zoho Analytics API access token resolution and service routing.
 */
export const ZOHO_ANALYTICS_SERVICE_NAME: ZohoApiServiceName | ZohoServiceAccessTokenKey = 'analytics';

/**
 * Header that carries the {@link ZohoAnalyticsOrgId} on Zoho Analytics API requests.
 *
 * Required by every endpoint except `GET /orgs`.
 *
 * @see https://www.zoho.com/analytics/api/v2/api-specification.html
 */
export const ZOHO_ANALYTICS_ORG_ID_HEADER = 'ZANALYTICS-ORGID';

/**
 * Full base URL for the Zoho Analytics API.
 */
export type ZohoAnalyticsApiUrl = ZohoApiUrl;

/**
 * Well-known environment key for selecting a Zoho Analytics API endpoint.
 *
 * Zoho Analytics has no documented sandbox environment, so only 'production' is a known key.
 * Custom URLs — including the regional variants below — can be passed directly.
 *
 * Zoho Analytics is served from eight data centers, each with its own host:
 * `analyticsapi.zoho.com` (US), `.eu`, `.in`, `.com.au`, `.com.cn`, `.jp`, `.sa`, and
 * `analyticsapi.zohocloud.ca` (CA). Pass the full URL for any non-US data center.
 *
 * @see https://www.zoho.com/analytics/api/v2/api-specification.html
 */
export type ZohoAnalyticsApiUrlKey = ZohoApiUrlKey;

/**
 * Accepts either a well-known environment key or a custom full URL, allowing callers to target
 * production or an arbitrary Analytics endpoint (e.g., regional variants).
 */
export type ZohoAnalyticsConfigApiUrlInput = ZohoAnalyticsApiUrlKey | ZohoAnalyticsApiUrl;

/**
 * Resolves an Analytics API URL input to its full base URL. The 'production' key maps to the
 * primary US Zoho Analytics endpoint; custom URLs pass through unchanged.
 *
 * @param input - A well-known environment key or a custom Analytics API URL.
 * @returns The resolved full Zoho Analytics API base URL.
 */
export function zohoAnalyticsConfigApiUrl(input: ZohoAnalyticsConfigApiUrlInput): ZohoApiUrl {
  let result: ZohoApiUrl;

  switch (input) {
    case 'sandbox':
    case 'production':
      result = 'https://analyticsapi.zoho.com/restapi/v2';
      break;
    default:
      result = input;
      break;
  }

  return result;
}

/**
 * Configuration for a Zoho Analytics service instance, including the target API URL and organization ID.
 *
 * Unlike Zoho Desk — where the org id is required — the Analytics org id is optional, because
 * `GET /orgs` is the bootstrap call that discovers it and is the one endpoint that does not
 * require the {@link ZOHO_ANALYTICS_ORG_ID_HEADER}.
 */
export interface ZohoAnalyticsConfig extends ZohoConfig {
  /**
   * Organization ID sent as the `ZANALYTICS-ORGID` header.
   *
   * Optional so that a client can be created before the org id is known; every endpoint other
   * than `GET /orgs` will fail without it.
   */
  readonly orgId?: Maybe<ZohoAnalyticsOrgId>;
}

/**
 * Input provided to an Analytics fetch factory to construct an authenticated fetch instance for a specific API base URL.
 */
export interface ZohoAnalyticsFetchFactoryParams {
  readonly apiUrl: ZohoAnalyticsApiUrl;
  readonly orgId?: Maybe<ZohoAnalyticsOrgId>;
}

/**
 * Factory that produces a pre-configured fetch instance bound to a specific Zoho Analytics API URL and organization.
 */
export type ZohoAnalyticsFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoAnalyticsFetchFactoryParams>;

/**
 * Core context for making authenticated Zoho Analytics API calls. Bundles the configured fetch,
 * JSON parsing, access token management, rate limiting, and service configuration needed
 * by all Analytics operations.
 */
export interface ZohoAnalyticsContext extends ZohoRateLimiterRef {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly accessTokenStringFactory: ZohoAccessTokenStringFactory;
  readonly config: ZohoAnalyticsConfig;
}

/**
 * Reference wrapper providing access to a {@link ZohoAnalyticsContext}. Used for dependency injection across Analytics service consumers.
 */
export interface ZohoAnalyticsContextRef {
  readonly analyticsContext: ZohoAnalyticsContext;
}
