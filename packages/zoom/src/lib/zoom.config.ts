/**
 * The Zoom API URL for the US datacenter.
 */
export const ZOOM_API_URL = 'https://api.zoom.us/v2';

/**
 * Url for the Zoom API.
 */
export type ZoomApiUrl = typeof ZOOM_API_URL;

/**
 * Zoom Server Account ID used to identify a specific Zoom account.
 *
 * Can be found on the Server to Server app build page.
 */
export type ZoomAccountId = string;

/**
 * Non-expiring refresh token used to retrieve access tokens for performing API calls.
 *
 * https://www.zoom.com/recruit/developer-guide/apiv2/oauth-overview.html
 *
 * Is in the format of "1000.abc.123"
 */
export type ZoomRefreshToken = string;

/**
 * OAuth Client Id
 */
export type ZoomOAuthClientId = string;

/**
 * OAuth Client Secret
 */
export type ZoomOAuthClientSecret = string;

export interface ZoomAccountIdRef {
  readonly accountId: ZoomAccountId;
}

export interface ZoomAuthClientIdAndSecretPair {
  readonly clientId: ZoomOAuthClientId;
  readonly clientSecret: ZoomOAuthClientSecret;
}

export interface ZoomConfig {}
