
/**
 * Name used to identify a specific service. Always lowercase.
 *
 * I.E. recruit
 */
export type ZohoApiServiceName = string;

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

/**
 * OAuth Client Id
 */
export type ZohoOAuthClientId = string;

/**
 * OAuth Client Secret
 */
export type ZohoOAuthClientSecret = string;

export interface ZohoAuthClientIdAndSecretPair {
  readonly clientId: ZohoOAuthClientId;
  readonly clientSecret: ZohoOAuthClientSecret;
}

export type ZohoApiUrlKey = 'sandbox' | 'production';

export type ZohoConfigApiUrlInput = ZohoApiUrlKey | ZohoApiUrl;

export interface ZohoConfig {
  readonly apiUrl?: ZohoConfigApiUrlInput;
}
