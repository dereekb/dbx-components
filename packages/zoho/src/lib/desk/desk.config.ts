import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZohoApiUrl, type ZohoApiUrlKey, type ZohoConfig, type ZohoApiServiceName } from '../zoho.config';
import { type ZohoAccessTokenStringFactory, type ZohoServiceAccessTokenKey } from '../accounts';
import { type ZohoRateLimiterRef } from '../zoho.limit';
import { type ZohoDeskOrgId } from './desk';

/**
 * Service identifier used for Zoho Desk API access token resolution and service routing.
 */
export const ZOHO_DESK_SERVICE_NAME: ZohoApiServiceName | ZohoServiceAccessTokenKey = 'desk';

/**
 * Full base URL for the Zoho Desk API.
 */
export type ZohoDeskApiUrl = ZohoApiUrl;

/**
 * Well-known environment key for selecting a Zoho Desk API endpoint.
 *
 * Zoho Desk does not have a documented sandbox environment, so only 'production' is a known key.
 * Custom URLs (including regional variants like desk.zoho.eu) can be passed directly.
 */
export type ZohoDeskApiUrlKey = ZohoApiUrlKey;

/**
 * Accepts either a well-known environment key or a custom full URL, allowing callers to target
 * production or an arbitrary Desk endpoint (e.g., regional variants).
 */
export type ZohoDeskConfigApiUrlInput = ZohoDeskApiUrlKey | ZohoDeskApiUrl;

/**
 * Resolves a Desk API URL input to its full base URL. The 'production' key maps to the
 * primary Zoho Desk endpoint; custom URLs pass through unchanged.
 *
 * @param input - A well-known environment key or a custom Desk API URL
 * @returns The resolved full Zoho Desk API base URL
 */
export function zohoDeskConfigApiUrl(input: ZohoDeskConfigApiUrlInput): ZohoApiUrl {
  let result: ZohoApiUrl;

  switch (input) {
    case 'sandbox':
    case 'production':
      result = 'https://desk.zoho.com/api/v1';
      break;
    default:
      result = input;
      break;
  }

  return result;
}

/**
 * Configuration for a Zoho Desk service instance, including the target API URL and organization ID.
 *
 * Unlike other Zoho services (CRM, Recruit, Sign), the Desk API requires an `orgId` header
 * on all requests.
 */
export interface ZohoDeskConfig extends ZohoConfig {
  /**
   * Organization ID required by all Zoho Desk API calls.
   * Obtained from the Zoho Desk organization settings.
   */
  readonly orgId: ZohoDeskOrgId;
}

/**
 * Input provided to a Desk fetch factory to construct an authenticated fetch instance for a specific API base URL.
 */
export interface ZohoDeskFetchFactoryParams {
  readonly apiUrl: ZohoDeskApiUrl;
  readonly orgId: ZohoDeskOrgId;
}

/**
 * Factory that produces a pre-configured fetch instance bound to a specific Zoho Desk API URL and organization.
 */
export type ZohoDeskFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoDeskFetchFactoryParams>;

/**
 * Core context for making authenticated Zoho Desk API calls. Bundles the configured fetch,
 * JSON parsing, access token management, rate limiting, and service configuration needed
 * by all Desk operations.
 */
export interface ZohoDeskContext extends ZohoRateLimiterRef {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly accessTokenStringFactory: ZohoAccessTokenStringFactory;
  readonly config: ZohoDeskConfig;
}

/**
 * Reference wrapper providing access to a {@link ZohoDeskContext}. Used for dependency injection across Desk service consumers.
 */
export interface ZohoDeskContextRef {
  readonly deskContext: ZohoDeskContext;
}
