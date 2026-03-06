import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZohoApiUrl, type ZohoApiUrlKey, type ZohoConfig, type ZohoApiServiceName } from '../zoho.config';
import { type ZohoAccessTokenStringFactory, type ZohoServiceAccessTokenKey } from '../accounts';
import { type ZohoRateLimiterRef } from '../zoho.limit';

export const ZOHO_SIGN_SERVICE_NAME: ZohoApiServiceName | ZohoServiceAccessTokenKey = 'sign';

export type ZohoSignApiUrl = ZohoApiUrl;
export type ZohoSignApiUrlKey = ZohoApiUrlKey;

export type ZohoSignConfigApiUrlInput = ZohoSignApiUrlKey | ZohoSignApiUrl;

export function zohoSignConfigApiUrl(input: ZohoSignConfigApiUrlInput): ZohoApiUrl {
  switch (input) {
    case 'sandbox':
      return 'https://sign.zoho.com/api/v1';
    case 'production':
      return 'https://sign.zoho.com/api/v1';
    default:
      return input;
  }
}

export type ZohoSignConfig = ZohoConfig;

export interface ZohoSignFetchFactoryInput {
  readonly apiUrl: ZohoSignApiUrl;
}

export type ZohoSignFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoSignFetchFactoryInput>;

export interface ZohoSignContext extends ZohoRateLimiterRef {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly accessTokenStringFactory: ZohoAccessTokenStringFactory;
  readonly config: ZohoSignConfig;
}

export interface ZohoSignContextRef {
  readonly signContext: ZohoSignContext;
}
