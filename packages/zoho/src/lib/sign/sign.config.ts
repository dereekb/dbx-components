import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZohoApiUrl, type ZohoApiUrlKey, type ZohoConfig, type ZohoApiServiceName } from '../zoho.config';
import { type ZohoAccessTokenStringFactory, type ZohoServiceAccessTokenKey } from '../accounts';
import { type ZohoRateLimiterRef } from '../zoho.limit';

export const ZOHO_SIGN_SERVICE_NAME: ZohoApiServiceName | ZohoServiceAccessTokenKey = 'sign';

export type ZohoSignApiUrl = ZohoApiUrl;
export type ZohoSignApiUrlKey = ZohoApiUrlKey;

export type ZohoSignConfigApiUrlInput = ZohoSignApiUrlKey | ZohoSignApiUrl;

/**
 * Resolves an environment key or passthrough URL to the full Zoho Sign API URL.
 *
 * @param input - An environment key ('sandbox' or 'production') or a full API URL
 * @returns The resolved Zoho Sign API URL
 */
export function zohoSignConfigApiUrl(input: ZohoSignConfigApiUrlInput): ZohoApiUrl {
  switch (input) {
    case 'sandbox':
      return 'https://signsandbox.zoho.com/api/v1';
    case 'production':
      return 'https://sign.zoho.com/api/v1';
    default:
      return input;
  }
}

export type ZohoSignConfig = ZohoConfig;

export interface ZohoSignFetchFactoryParams {
  readonly apiUrl: ZohoSignApiUrl;
}

export type ZohoSignFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoSignFetchFactoryParams>;

export interface ZohoSignContext extends ZohoRateLimiterRef {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly accessTokenStringFactory: ZohoAccessTokenStringFactory;
  readonly config: ZohoSignConfig;
}

export interface ZohoSignContextRef {
  readonly signContext: ZohoSignContext;
}

// MARK: Compat
/**
 * @deprecated use ZohoSignFetchFactoryParams instead.
 */
export type ZohoSignFetchFactoryInput = ZohoSignFetchFactoryParams;
