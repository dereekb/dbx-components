import { type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZohoApiUrl, type ZohoApiUrlKey, type ZohoRefreshToken, type ZohoConfig, type ZohoAuthClientIdAndSecretPair } from '../zoho.config';
import { type ZohoAccessTokenApiDomain, type ZohoAccessTokenCache, type ZohoAccessTokenFactory, type ZohoAccessTokenRefresher } from './accounts';

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

// MARK: Datacenter
/**
 * The Zoho web domain of every datacenter, which each product's hosts are subdomains of
 * (e.g. `desk.zoho.eu`, `analyticsapi.zoho.com.au`).
 *
 * Matches the host the {@link ZOHO_ACCOUNTS_API_URLS} entry for the same datacenter lives under.
 */
export const ZOHO_DATACENTER_DOMAINS: Readonly<Record<ZohoAccountsApiUrlKey, string>> = {
  us: 'zoho.com',
  eu: 'zoho.eu',
  in: 'zoho.in',
  au: 'zoho.com.au',
  jp: 'zoho.jp',
  uk: 'zoho.uk',
  ca: 'zohocloud.ca',
  sa: 'zoho.sa'
};

/**
 * The `api_domain` Zoho returns with an access token for each datacenter.
 *
 * The domain the token's CRM-style APIs (`/crm`, …) must be called on; a token is rejected by
 * every other datacenter's domain.
 */
export const ZOHO_DATACENTER_API_DOMAINS: Readonly<Record<ZohoAccountsApiUrlKey, ZohoAccessTokenApiDomain>> = {
  us: 'https://www.zohoapis.com',
  eu: 'https://www.zohoapis.eu',
  in: 'https://www.zohoapis.in',
  au: 'https://www.zohoapis.com.au',
  jp: 'https://www.zohoapis.jp',
  uk: 'https://www.zohoapis.uk',
  ca: 'https://www.zohoapis.ca',
  sa: 'https://www.zohoapis.sa'
};

/**
 * Returns the datacenter key for a Zoho `location` value.
 *
 * Zoho reports the datacenter that issued a grant as a short `location` (e.g. `eu`) alongside the
 * authorization code and on exported connection tokens. Matching is case-insensitive; a location
 * outside {@link ZohoAccountsApiUrlKey} (e.g. `cn`) is not supported and yields undefined.
 *
 * @param location - The location value, as reported by Zoho.
 * @returns The matching datacenter key, or undefined when the location is not a known one.
 *
 * @example
 * ```typescript
 * zohoAccountsApiUrlKeyForLocation('EU'); // 'eu'
 * zohoAccountsApiUrlKeyForLocation('cn'); // undefined
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoAccountsApiUrlKeyForLocation(location: Maybe<string>): Maybe<ZohoAccountsApiUrlKey> {
  const normalized = location?.trim().toLowerCase();
  let result: Maybe<ZohoAccountsApiUrlKey>;

  if (normalized && Object.hasOwn(ZOHO_ACCOUNTS_API_URLS, normalized)) {
    result = normalized as ZohoAccountsApiUrlKey;
  }

  return result;
}

/**
 * Returns the datacenter key for an access token's `api_domain`.
 *
 * Compares hostnames, so a trailing slash or a missing `www.` prefix is tolerated.
 *
 * @param apiDomain - The api domain returned alongside an access token, e.g. `https://www.zohoapis.eu`.
 * @returns The matching datacenter key, or undefined when the domain is not a known one.
 *
 * @example
 * ```typescript
 * zohoAccountsApiUrlKeyForApiDomain('https://www.zohoapis.com.au'); // 'au'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoAccountsApiUrlKeyForApiDomain(apiDomain: Maybe<string>): Maybe<ZohoAccountsApiUrlKey> {
  let result: Maybe<ZohoAccountsApiUrlKey>;
  const hostname = zohoHostnameWithoutWww(apiDomain);

  if (hostname) {
    result = (Object.keys(ZOHO_DATACENTER_API_DOMAINS) as ZohoAccountsApiUrlKey[]).find((key) => zohoHostnameWithoutWww(ZOHO_DATACENTER_API_DOMAINS[key]) === hostname);
  }

  return result;
}

/**
 * Lowercased hostname of a URL (or bare host) with any leading `www.` removed.
 *
 * @param value - The URL or host to read.
 * @returns The hostname, or undefined when the value is empty or unparseable.
 */
function zohoHostnameWithoutWww(value: Maybe<string>): Maybe<string> {
  let result: Maybe<string>;
  const trimmed = value?.trim();

  if (trimmed) {
    try {
      result = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      result = undefined;
    }
  }

  return result;
}

/**
 * The datacenter details an access token is reported with.
 */
export interface ZohoAccountsApiUrlKeyForTokenInput {
  /**
   * Zoho's short datacenter location, e.g. `eu`.
   */
  readonly location?: Maybe<string>;
  /**
   * The token's api domain, e.g. `https://www.zohoapis.eu`.
   */
  readonly apiDomain?: Maybe<string>;
}

/**
 * Returns the datacenter an access token belongs to: from its `location` when known, else derived
 * from its `apiDomain`.
 *
 * Used to configure product clients for a token minted elsewhere (e.g. an exported connection
 * token), whose product APIs only accept it on the issuing datacenter's hosts.
 *
 * @param input - The token's location and/or api domain.
 * @returns The datacenter key, or undefined when neither value identifies a known datacenter.
 *
 * @example
 * ```typescript
 * zohoAccountsApiUrlKeyForToken({ location: 'eu' }); // 'eu'
 * zohoAccountsApiUrlKeyForToken({ apiDomain: 'https://www.zohoapis.in' }); // 'in'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoAccountsApiUrlKeyForToken(input: ZohoAccountsApiUrlKeyForTokenInput): Maybe<ZohoAccountsApiUrlKey> {
  return zohoAccountsApiUrlKeyForLocation(input.location) ?? zohoAccountsApiUrlKeyForApiDomain(input.apiDomain);
}

/**
 * Input for the per-product `zoho*ConfigApiUrlForDatacenter()` helpers.
 */
export interface ZohoDatacenterApiUrlInput {
  /**
   * Datacenter the account lives in. Defaults to `us`.
   */
  readonly datacenter?: Maybe<ZohoAccountsApiUrlKey>;
  /**
   * Whether to target the product's production or sandbox environment. Defaults to `production`.
   *
   * Products without a sandbox resolve both modes to their production host.
   */
  readonly mode?: Maybe<ZohoApiUrlKey>;
}

/**
 * Returns the Zoho web domain of the input's datacenter, defaulting to `us`.
 *
 * @param input - The datacenter input, if any.
 * @returns The datacenter's web domain, e.g. `zoho.eu`.
 *
 * @example
 * ```typescript
 * zohoDatacenterDomain({ datacenter: 'ca' }); // 'zohocloud.ca'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoDatacenterDomain(input?: Maybe<ZohoDatacenterApiUrlInput>): string {
  return ZOHO_DATACENTER_DOMAINS[input?.datacenter ?? 'us'];
}

/**
 * Returns the api domain of the input's datacenter, defaulting to `us`.
 *
 * @param input - The datacenter input, if any.
 * @returns The datacenter's api domain, e.g. `https://www.zohoapis.eu`.
 *
 * @example
 * ```typescript
 * zohoDatacenterApiDomain({ datacenter: 'eu' }); // 'https://www.zohoapis.eu'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoDatacenterApiDomain(input?: Maybe<ZohoDatacenterApiUrlInput>): ZohoAccessTokenApiDomain {
  return ZOHO_DATACENTER_API_DOMAINS[input?.datacenter ?? 'us'];
}

/**
 * Configuration for ZohoAccounts.
 */
export interface ZohoAccountsConfig extends ZohoConfig, ZohoAuthClientIdAndSecretPair {
  /**
   * Refresh token used for generaing new ZohoAccessToken values.
   *
   * May be empty when {@link tokenRefresher} is set.
   */
  readonly refreshToken: ZohoRefreshToken;
  /**
   * Optional ZohoAccessTokenCache for caching access tokens.
   */
  readonly accessTokenCache?: Maybe<ZohoAccessTokenCache>;
  /**
   * External source of access tokens, used instead of the refresh-token exchange.
   *
   * For a process that is handed short-lived access tokens by something else (e.g. a token minted
   * from a stored connection by a server) and holds no client secret or refresh token. When set,
   * `clientId`, `clientSecret`, and `refreshToken` are not required and may be empty, and the
   * client's `resetAccessToken()` also clears the {@link accessTokenCache} and calls this source's
   * own `resetAccessToken()`, so a rejected token re-runs the source instead of being reused.
   */
  readonly tokenRefresher?: Maybe<ZohoAccessTokenRefresher>;
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
