import { type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZohoApiUrl, type ZohoRefreshToken, type ZohoConfig, type ZohoAuthClientIdAndSecretPair } from '../zoho.config';
import { type ZohoAccessTokenCache, type ZohoAccessTokenFactory } from './accounts';

/**
 * The Zoho Accounts API URL for the US datacenter.
 */
export const ZOHO_ACCOUNTS_US_API_URL = 'https://accounts.zoho.com';

/**
 * The Zoho Accounts API URL for the EU datacenter.
 */
export const ZOHO_ACCOUNTS_EU_API_URL = 'https://accounts.zoho.eu';

/**
 * The Zoho Accounts API URL for the India datacenter.
 */
export const ZOHO_ACCOUNTS_IN_API_URL = 'https://accounts.zoho.in';

/**
 * The Zoho Accounts API URL for the Australia datacenter.
 */
export const ZOHO_ACCOUNTS_AU_API_URL = 'https://accounts.zoho.com.au';

/**
 * The Zoho Accounts API URL for the Japan datacenter.
 */
export const ZOHO_ACCOUNTS_JP_API_URL = 'https://accounts.zoho.jp';

/**
 * The Zoho Accounts API URL for the United Kingdom datacenter.
 */
export const ZOHO_ACCOUNTS_UK_API_URL = 'https://accounts.zoho.uk';

/**
 * The Zoho Accounts API URL for the Canada datacenter.
 */
export const ZOHO_ACCOUNTS_CA_API_URL = 'https://accounts.zohocloud.ca';

/**
 * The Zoho Accounts API URL for the Saudi Arabia datacenter.
 */
export const ZOHO_ACCOUNTS_SA_API_URL = 'https://accounts.zoho.sa';

/**
 * Url for the Zoho Accounts API.
 *
 * You can find a list here of Account URLs here:
 *
 * https://help.zoho.com/portal/en/kb/creator/developer-guide/others/url-patterns/articles/know-your-creator-account-s-base-url
 */
export type ZohoAccountsApiUrl = ZohoApiUrl;

export type ZohoAccountsApiUrlKey = 'us' | 'eu' | 'in' | 'au' | 'jp' | 'uk' | 'ca' | 'sa';

export type ZohoAccountsConfigApiUrlInput = ZohoAccountsApiUrlKey | ZohoAccountsApiUrl;

/**
 * Every Zoho Accounts host this package will talk to, keyed by datacenter.
 *
 * A closed set rather than an open string, because a value echoed back on an OAuth callback
 * (`accounts-server`) is checked against it before being used as a token-exchange target — an
 * unchecked host there would receive the client secret.
 */
export const ZOHO_ACCOUNTS_API_URLS: Readonly<Record<ZohoAccountsApiUrlKey, ZohoAccountsApiUrl>> = {
  us: ZOHO_ACCOUNTS_US_API_URL,
  eu: ZOHO_ACCOUNTS_EU_API_URL,
  in: ZOHO_ACCOUNTS_IN_API_URL,
  au: ZOHO_ACCOUNTS_AU_API_URL,
  jp: ZOHO_ACCOUNTS_JP_API_URL,
  uk: ZOHO_ACCOUNTS_UK_API_URL,
  ca: ZOHO_ACCOUNTS_CA_API_URL,
  sa: ZOHO_ACCOUNTS_SA_API_URL
};

/**
 * Resolves a Zoho Accounts API URL input to the full base URL. A datacenter key maps to that
 * datacenter's host; custom URLs pass through unchanged.
 *
 * @param input - A well-known datacenter key or a custom Zoho Accounts API URL.
 * @returns The resolved full Zoho Accounts API base URL.
 */
export function zohoAccountsConfigApiUrl(input: ZohoAccountsConfigApiUrlInput): ZohoApiUrl {
  return ZOHO_ACCOUNTS_API_URLS[input as ZohoAccountsApiUrlKey] ?? input;
}

/**
 * Returns whether the input is one of the known Zoho Accounts hosts.
 *
 * Exists to gate a value that arrives from OUTSIDE the process: Zoho echoes the issuing datacenter
 * back as the `accounts-server` OAuth callback parameter, and that host becomes the POST target the
 * client secret is sent to. An attacker can compose that redirect, so only an exact match against
 * {@link ZOHO_ACCOUNTS_API_URLS} may be honored.
 *
 * @param url - The candidate accounts host.
 * @returns True when the value is exactly one of the known Zoho Accounts hosts.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isKnownZohoAccountsApiUrl(url: Maybe<string>): boolean {
  return url != null && zohoAccountsApiUrlKeyForApiUrl(url) != null;
}

/**
 * Returns the datacenter key for a known Zoho Accounts host.
 *
 * A trailing slash is tolerated, since Zoho's `accounts-server` value is URL-encoded and some
 * datacenters echo it back with one; nothing else about the value is normalized.
 *
 * @param url - The candidate accounts host.
 * @returns The matching datacenter key, or undefined when the host is not a known one.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoAccountsApiUrlKeyForApiUrl(url: Maybe<string>): Maybe<ZohoAccountsApiUrlKey> {
  let result: Maybe<ZohoAccountsApiUrlKey>;

  if (url != null) {
    const normalized = url.replace(/\/+$/, '');
    result = (Object.keys(ZOHO_ACCOUNTS_API_URLS) as ZohoAccountsApiUrlKey[]).find((key) => ZOHO_ACCOUNTS_API_URLS[key] === normalized);
  }

  return result;
}

/**
 * Configuration for ZohoAccounts.
 */
export interface ZohoAccountsConfig extends ZohoConfig, ZohoAuthClientIdAndSecretPair {
  /**
   * Refresh token used for generaing new ZohoAccessToken values.
   */
  readonly refreshToken: ZohoRefreshToken;
  /**
   * Optional ZohoAccessTokenCache for caching access tokens.
   */
  readonly accessTokenCache?: Maybe<ZohoAccessTokenCache>;
}

export interface ZohoAccountsFetchFactoryParams {
  readonly apiUrl: ZohoApiUrl;
}

export type ZohoAccountsFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoAccountsFetchFactoryParams>;

export interface ZohoAccountsContext {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly loadAccessToken: ZohoAccessTokenFactory;
  readonly config: ZohoAccountsConfig;
}

export interface ZohoAccountsContextRef {
  readonly accountsContext: ZohoAccountsContext;
}
