/**
 * Lowercase identifier for a specific Zoho service (e.g. `'recruit'`, `'crm'`, `'sign'`).
 */
export type ZohoApiServiceName = string;

/**
 * Fully-qualified base URL for a Zoho API endpoint (e.g. `'https://www.zohoapis.com/crm'`).
 */
export type ZohoApiUrl = string;

/**
 * Non-expiring OAuth refresh token used to retrieve short-lived access tokens.
 *
 * Format: `'1000.abc.123'`
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/oauth-overview.html
 */
export type ZohoRefreshToken = string;

/**
 * OAuth 2.0 Client ID issued by the Zoho Developer Console.
 */
export type ZohoOAuthClientId = string;

/**
 * OAuth 2.0 Client Secret issued by the Zoho Developer Console.
 */
export type ZohoOAuthClientSecret = string;

/**
 * Paired OAuth client credentials required for token exchange.
 */
export interface ZohoAuthClientIdAndSecretPair {
  readonly clientId: ZohoOAuthClientId;
  readonly clientSecret: ZohoOAuthClientSecret;
}

/**
 * Well-known environment key for selecting a pre-configured Zoho API URL.
 */
export type ZohoApiUrlKey = 'sandbox' | 'production';

/**
 * Input for configuring the target Zoho API URL. Accepts either a well-known
 * {@link ZohoApiUrlKey} (e.g. `'sandbox'`, `'production'`) or a full {@link ZohoApiUrl}.
 */
export type ZohoConfigApiUrlInput = ZohoApiUrlKey | ZohoApiUrl;

/**
 * Base configuration shared by all Zoho service configs (CRM, Recruit, Sign, Accounts).
 */
export interface ZohoConfig {
  /**
   * Target API URL, either as an environment key or a full URL.
   * Each service resolves this to a concrete URL via its own config utility.
   */
  readonly apiUrl?: ZohoConfigApiUrlInput;
}
