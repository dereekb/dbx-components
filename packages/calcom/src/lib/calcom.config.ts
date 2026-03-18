/**
 * The Cal.com API URL.
 */
export const CALCOM_API_URL = 'https://api.cal.com/v2';

/**
 * OAuth Client Id
 */
export type CalcomOAuthClientId = string;

/**
 * OAuth Client Secret
 */
export type CalcomOAuthClientSecret = string;

export interface CalcomAuthClientIdAndSecretPair {
  readonly clientId: CalcomOAuthClientId;
  readonly clientSecret: CalcomOAuthClientSecret;
}

/**
 * Refresh token used to retrieve access tokens for performing API calls.
 *
 * Cal.com rotates refresh tokens on each use, so the latest value must always be persisted.
 */
export type CalcomRefreshToken = string;

/**
 * Cal.com API key, prefixed with `cal_` (test) or `cal_live_` (production).
 *
 * Created in Cal.com user settings > Security. Acts as the user who created it.
 * Does not expire and requires no refresh.
 */
export type CalcomApiKey = string;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface CalcomConfig {}

/**
 * Secret used for validating Cal.com webhooks.
 */
export type CalcomWebhookSecret = string;
