import { type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZohoApiUrl, type ZohoApiUrlKey, type ZohoConfig, type ZohoApiServiceName } from '../zoho.config';
import { type ZohoAccessTokenStringFactory, type ZohoDatacenterApiUrlInput, type ZohoServiceAccessTokenKey, zohoDatacenterApiDomain, zohoDatacenterDomain } from '../accounts';
import { type ZohoRateLimiterRef } from '../zoho.limit';

/**
 * Service identifier used for Zoho CRM API access token resolution and service routing.
 */
export const ZOHO_CRM_SERVICE_NAME: ZohoApiServiceName | ZohoServiceAccessTokenKey = 'crm';

/**
 * Full base URL for the Zoho CRM API, scoped to the CRM service.
 */
export type ZohoCrmApiUrl = ZohoApiUrl;

/**
 * Well-known environment key for selecting a Zoho CRM API endpoint.
 */
export type ZohoCrmApiUrlKey = ZohoApiUrlKey;

/**
 * Accepts either a well-known environment key or a custom full URL, allowing callers to target sandbox, production, or an arbitrary CRM endpoint.
 */
export type ZohoCrmConfigApiUrlInput = ZohoCrmApiUrlKey | ZohoCrmApiUrl;

/**
 * Resolves a CRM API URL input to its full base URL. Well-known keys ('sandbox', 'production') map to their respective Zoho CRM endpoints; custom URLs pass through unchanged.
 *
 * @param input - A well-known environment key or a custom CRM API URL.
 * @returns The resolved full Zoho CRM API base URL.
 */
export function zohoCrmConfigApiUrl(input: ZohoCrmConfigApiUrlInput): ZohoApiUrl {
  let result: ZohoApiUrl;
  switch (input) {
    case 'sandbox':
      result = 'https://crmsandbox.zoho.com/crm';
      break;
    case 'production':
      result = 'https://www.zohoapis.com/crm';
      break;
    default:
      result = input;
      break;
  }
  return result;
}

/**
 * Resolves the Zoho CRM API URL of a datacenter. Production CRM is served from the datacenter's api
 * domain (e.g. `https://www.zohoapis.eu/crm`), and the sandbox from its `crmsandbox` host.
 *
 * {@link zohoCrmConfigApiUrl}'s keys always target the `us` datacenter; use this for an account
 * that lives in another one (e.g. one whose access token reports `location: 'eu'`).
 *
 * @param input - The datacenter (default `us`) and mode (default `production`).
 * @returns The full Zoho CRM API base URL for that datacenter.
 *
 * @example
 * ```typescript
 * zohoCrmConfigApiUrlForDatacenter({ datacenter: 'eu' }); // 'https://www.zohoapis.eu/crm'
 * zohoCrmConfigApiUrlForDatacenter({ datacenter: 'eu', mode: 'sandbox' }); // 'https://crmsandbox.zoho.eu/crm'
 * ```
 */
export function zohoCrmConfigApiUrlForDatacenter(input?: Maybe<ZohoDatacenterApiUrlInput>): ZohoCrmApiUrl {
  return input?.mode === 'sandbox' ? `https://crmsandbox.${zohoDatacenterDomain(input)}/crm` : `${zohoDatacenterApiDomain(input)}/crm`;
}

/**
 * Configuration for a Zoho CRM service instance, including the target API URL.
 */
export type ZohoCrmConfig = ZohoConfig;

/**
 * Input provided to a CRM fetch factory to construct an authenticated fetch instance for a specific API base URL.
 */
export interface ZohoCrmFetchFactoryParams {
  readonly apiUrl: ZohoCrmApiUrl;
}

/**
 * Factory that produces a pre-configured fetch instance bound to a specific Zoho CRM API URL, used to customize HTTP transport (e.g., timeouts, headers).
 */
export type ZohoCrmFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoCrmFetchFactoryParams>;

/**
 * Core context for making authenticated Zoho CRM API calls. Bundles the configured fetch, JSON parsing, access token management, rate limiting, and service configuration needed by all CRM operations.
 */
export interface ZohoCrmContext extends ZohoRateLimiterRef {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly accessTokenStringFactory: ZohoAccessTokenStringFactory;
  readonly config: ZohoCrmConfig;
}

/**
 * Reference wrapper providing access to a {@link ZohoCrmContext}. Used for dependency injection across CRM service consumers.
 */
export interface ZohoCrmContextRef {
  readonly crmContext: ZohoCrmContext;
}
