import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZohoApiUrl, type ZohoApiUrlKey, type ZohoConfig, type ZohoApiServiceName } from '../zoho.config';
import { type ZohoAccessTokenStringFactory, type ZohoServiceAccessTokenKey } from '../accounts';
import { type ZohoRateLimiterRef } from '../zoho.limit';

export const ZOHO_CRM_SERVICE_NAME: ZohoApiServiceName | ZohoServiceAccessTokenKey = 'crm';

export type ZohoCrmApiUrl = ZohoApiUrl;
export type ZohoCrmApiUrlKey = ZohoApiUrlKey;

export type ZohoCrmConfigApiUrlInput = ZohoCrmApiUrlKey | ZohoCrmApiUrl;

export function zohoCrmConfigApiUrl(input: ZohoCrmConfigApiUrlInput): ZohoApiUrl {
  switch (input) {
    case 'sandbox':
      return 'https://crmsandbox.zoho.com/crm';
    case 'production':
      return 'https://www.zohoapis.com/crm';
    default:
      return input;
  }
}

export type ZohoCrmConfig = ZohoConfig;

export interface ZohoCrmFetchFactoryInput {
  readonly apiUrl: ZohoCrmApiUrl;
}

export type ZohoCrmFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoCrmFetchFactoryInput>;

export interface ZohoCrmContext extends ZohoRateLimiterRef {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly accessTokenStringFactory: ZohoAccessTokenStringFactory;
  readonly config: ZohoCrmConfig;
}

export interface ZohoCrmContextRef {
  readonly crmContext: ZohoCrmContext;
}
