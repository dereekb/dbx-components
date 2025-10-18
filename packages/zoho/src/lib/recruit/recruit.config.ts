import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZohoApiUrl, type ZohoApiUrlKey, type ZohoConfig, type ZohoApiServiceName } from '../zoho.config';
import { type ZohoAccessTokenStringFactory, type ZohoServiceAccessTokenKey } from '../accounts';
import { type ZohoRateLimiterRef } from '../zoho.limit';

export const ZOHO_RECRUIT_SERVICE_NAME: ZohoApiServiceName | ZohoServiceAccessTokenKey = 'recruit';

export type ZohoRecruitApiUrl = ZohoApiUrl;
export type ZohoRecruitApiUrlKey = ZohoApiUrlKey;

export type ZohoRecruitConfigApiUrlInput = ZohoRecruitApiUrlKey | ZohoRecruitApiUrl;

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

export type ZohoRecruitConfig = ZohoConfig;

export interface ZohoRecruitFetchFactoryInput {
  readonly apiUrl: ZohoRecruitApiUrl;
}

export type ZohoRecruitFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoRecruitFetchFactoryInput>;

export interface ZohoRecruitContext extends ZohoRateLimiterRef {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly accessTokenStringFactory: ZohoAccessTokenStringFactory;
  readonly config: ZohoRecruitConfig;
}

export interface ZohoRecruitContextRef {
  readonly recruitContext: ZohoRecruitContext;
}
