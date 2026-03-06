import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZohoApiUrl, type ZohoApiUrlKey, type ZohoConfig, type ZohoApiServiceName } from '../zoho.config';
import { type ZohoAccessTokenStringFactory, type ZohoServiceAccessTokenKey } from '../accounts';
import { type ZohoRateLimiterRef } from '../zoho.limit';

/**
 * Service identifier used to distinguish Zoho Recruit from other Zoho services when managing access tokens and API routing.
 */
export const ZOHO_RECRUIT_SERVICE_NAME: ZohoApiServiceName | ZohoServiceAccessTokenKey = 'recruit';

/**
 * Full API URL for the Zoho Recruit service.
 */
export type ZohoRecruitApiUrl = ZohoApiUrl;

/**
 * Shorthand key ('sandbox' or 'production') used to select a Zoho Recruit environment.
 */
export type ZohoRecruitApiUrlKey = ZohoApiUrlKey;

/**
 * Accepts either an environment key or a full URL, providing flexibility when configuring the Recruit API endpoint.
 */
export type ZohoRecruitConfigApiUrlInput = ZohoRecruitApiUrlKey | ZohoRecruitApiUrl;

/**
 * Resolves an environment key or passthrough URL to the full Zoho Recruit API URL.
 */
export function zohoRecruitConfigApiUrl(input: ZohoRecruitConfigApiUrlInput): ZohoApiUrl {
  switch (input) {
    case 'sandbox':
      return 'https://recruitsandbox.zoho.com/recruit';
    case 'production':
      return 'https://recruit.zoho.com/recruit';
    default:
      return input;
  }
}

/**
 * Configuration for connecting to the Zoho Recruit API, aliased from the shared Zoho config.
 */
export type ZohoRecruitConfig = ZohoConfig;

/**
 * Input provided to a fetch factory so it can construct an HTTP client bound to the given Recruit API URL.
 */
export interface ZohoRecruitFetchFactoryInput {
  readonly apiUrl: ZohoRecruitApiUrl;
}

/**
 * Factory that produces a configured fetch client for a specific Zoho Recruit API endpoint.
 */
export type ZohoRecruitFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoRecruitFetchFactoryInput>;

/**
 * Core context required for all Zoho Recruit API calls, bundling the HTTP client, JSON fetcher, authentication, configuration, and rate limiting.
 */
export interface ZohoRecruitContext extends ZohoRateLimiterRef {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly accessTokenStringFactory: ZohoAccessTokenStringFactory;
  readonly config: ZohoRecruitConfig;
}

/**
 * Reference wrapper that provides access to a {@link ZohoRecruitContext}.
 */
export interface ZohoRecruitContextRef {
  readonly recruitContext: ZohoRecruitContext;
}
