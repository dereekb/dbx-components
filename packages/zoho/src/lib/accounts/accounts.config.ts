import { FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { ConfiguredFetch, FetchJsonFunction } from '@dereekb/util/fetch';
import { ZohoApiUrl, ZohoRefreshToken, ZohoConfig, ZohoAuthClientIdAndSecretPair } from '../zoho.config';
import { ZohoAccessTokenCache, ZohoAccessTokenFactory } from './accounts';

/**
 * The Zoho Accounts API URL for the US datacenter.
 */
export const ZOHO_ACCOUNTS_US_API_URL = 'https://accounts.zoho.com';

/**
 * Url for the Zoho Accounts API.
 *
 * You can find a list here of Account URLs here:
 *
 * https://help.zoho.com/portal/en/kb/creator/developer-guide/others/url-patterns/articles/know-your-creator-account-s-base-url
 */
export type ZohoAccountsApiUrl = ZohoApiUrl;

export type ZohoAccountsApiUrlKey = 'us';

export type ZohoAccountsConfigApiUrlInput = ZohoAccountsApiUrlKey | ZohoAccountsApiUrl;

export function zohoAccountsConfigApiUrl(input: ZohoAccountsConfigApiUrlInput): ZohoApiUrl {
  switch (input) {
    case 'us':
      return ZOHO_ACCOUNTS_US_API_URL;
    default:
      return input;
  }
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

export interface ZohoAccountsFetchFactoryInput {
  readonly apiUrl: ZohoApiUrl;
}

export type ZohoAccountsFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoAccountsFetchFactoryInput>;

export interface ZohoAccountsContext {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly loadAccessToken: ZohoAccessTokenFactory;
  readonly config: ZohoAccountsConfig;
}

export interface ZohoAccountsContextRef {
  readonly accountsContext: ZohoAccountsContext;
}
