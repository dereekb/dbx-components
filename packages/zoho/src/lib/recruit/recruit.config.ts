import { FactoryWithRequiredInput } from '@dereekb/util';
import { ConfiguredFetch, FetchJsonFunction } from '@dereekb/util/fetch';
import { ZohoApiUrl, ZohoApiKey, ZohoApiUrlKey, ZohoConfig } from '../zoho.config';

export type ZohoRecruitApiUrl = ZohoApiUrl;
export type ZohoRecruitApiKey = ZohoApiKey;

export type ZohoRecruitApiUrlKey = ZohoApiUrlKey;

export type ZohoRecruitConfigApiUrlInput = ZohoRecruitApiUrlKey | ZohoRecruitApiUrl;

export function zohoRecruitConfigApiUrl(input: ZohoRecruitConfigApiUrlInput): ZohoApiUrl {
  switch (input) {
    case 'sandbox':
      return 'https://sandbox.zohoapis.com/recruit/v2/';
    case 'production':
      return 'https://recruit.zoho.com/recruit/v2/';
    default:
      return input;
  }
}

export interface ZohoRecruitConfig extends ZohoConfig {}

export interface ZohoRecruitFetchFactoryInput {
  readonly apiUrl: ZohoApiUrl;
  readonly apiKey: ZohoApiKey;
}

export type ZohoRecruitFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoRecruitFetchFactoryInput>;

export interface ZohoRecruitContext {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly config: ZohoRecruitConfig;
}

export interface ZohoRecruitContextRef {
  readonly recruitContext: ZohoRecruitContext;
}
