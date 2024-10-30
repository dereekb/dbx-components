import { FactoryWithRequiredInput } from '@dereekb/util';
import { ConfiguredFetch, FetchJsonFunction } from '@dereekb/util/fetch';

/**
 * The base URL for a Zoho API.
 */
export type ZohoApiUrl = string;

/**
 * Non-expiring refresh token used to retrieve access tokens for performing API calls.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/oauth-overview.html
 *
 * Is in the format of "1000.abc.123"
 */
export type ZohoRefreshToken = string;

export type ZohoApiUrlKey = 'sandbox' | 'production';

export type ZohoConfigApiUrlInput = ZohoApiUrlKey | ZohoApiUrl;

export interface ZohoConfig {
  readonly apiUrl?: ZohoConfigApiUrlInput;
}
