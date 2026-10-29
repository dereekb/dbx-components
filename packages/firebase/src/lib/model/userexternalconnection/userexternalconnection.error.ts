/**
 * Error codes the UserExternalConnection server surfaces.
 *
 * Declared HERE rather than beside the `HttpsError` factories in `@dereekb/firebase-server/model`
 * because both sides need them: the server throws them, and the client branches on them — a login
 * page deciding what to say about a refused sign-in, or a client treating a raced
 * `..._ALREADY_EXISTS` as success. A code the browser cannot import is a code the browser has to
 * hard-code.
 */
export const USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED';
export const USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED';
export const USER_EXTERNAL_CONNECTION_ALREADY_EXISTS_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_ALREADY_EXISTS';
export const USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED';
export const USER_EXTERNAL_CONNECTION_EXTERNAL_ACCOUNT_IN_USE_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_EXTERNAL_ACCOUNT_IN_USE';
export const USER_EXTERNAL_CONNECTION_SIGN_IN_NOT_ENABLED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_SIGN_IN_NOT_ENABLED';
export const USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED';
export const USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT';
export const USER_EXTERNAL_CONNECTION_SIGN_IN_USER_MISSING_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_SIGN_IN_USER_MISSING';
export const USER_EXTERNAL_CONNECTION_SIGN_IN_IDENTITY_UNAVAILABLE_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_SIGN_IN_IDENTITY_UNAVAILABLE';
/**
 * Refuses an unlink that would leave the account with no way back in.
 */
export const USER_EXTERNAL_CONNECTION_UNLINK_LAST_LOGIN_METHOD_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_UNLINK_LAST_LOGIN_METHOD';
/**
 * Refuses a `link` round trip for a provider the app has not enabled for sign-in.
 *
 * Distinct from `..._SIGN_IN_NOT_ENABLED`: nothing is signing in — an already-authenticated user asked
 * to make the provider a login method, and the same `policy.signIn` opt-in governs both.
 */
export const USER_EXTERNAL_CONNECTION_LINK_NOT_ENABLED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_LINK_NOT_ENABLED';
/**
 * Another instance holds the refresh lease for this connection and did not finish within the wait.
 *
 * Retryable (a 503): the refresh is still in progress, and the next attempt will most likely find the
 * credentials it produced.
 */
export const USER_EXTERNAL_CONNECTION_REFRESH_IN_PROGRESS_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_REFRESH_IN_PROGRESS';
/**
 * A refresh's fenced persist found the lease it was holding gone — a reconnect, a disconnect or a
 * takeover after expiry superseded it — so the refreshed credentials were NOT written.
 *
 * Internal: the reader handles it by re-reading what was written instead.
 */
export const USER_EXTERNAL_CONNECTION_REFRESH_LEASE_LOST_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_REFRESH_LEASE_LOST';

/**
 * The only error codes a failed SIGN-IN reports back to the browser.
 *
 * An ALLOWLIST rather than a filter: a failed sign-in redirects to a URL the user can read, so
 * anything that reaches it is public. Passing whatever code an internal failure happened to carry
 * would leak the shape of that failure, and passing a message would leak its text — so a code absent
 * from this set is reported as nothing at all.
 *
 * Shared with the client so a login page's copy map and the server's allowlist cannot drift.
 */
export const USER_EXTERNAL_CONNECTION_SIGN_IN_REPORTABLE_ERROR_CODES: ReadonlySet<string> = new Set<string>([
  USER_EXTERNAL_CONNECTION_EXTERNAL_ACCOUNT_IN_USE_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_NOT_ENABLED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_USER_MISSING_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_IDENTITY_UNAVAILABLE_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_LINK_NOT_ENABLED_ERROR_CODE
]);
