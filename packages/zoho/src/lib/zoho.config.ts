import { FactoryWithRequiredInput } from '@dereekb/util';
import { ConfiguredFetch, FetchJsonFunction } from '@dereekb/util/fetch';

export type ZohoApiUrl = string;
export type ZohoApiKey = string;

export type ZohoApiUrlKey = 'sandbox' | 'production';

export type ZohoConfigApiUrlInput = ZohoApiUrlKey | ZohoApiUrl;

export interface ZohoConfig {
  readonly apiUrl?: ZohoConfigApiUrlInput;
  readonly apiKey: ZohoApiKey;
}
