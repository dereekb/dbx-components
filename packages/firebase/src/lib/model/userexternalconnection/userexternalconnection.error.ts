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
/**
 * Refuses a connect that names a scope preset the provider does not declare.
 */
export const USER_EXTERNAL_CONNECTION_SCOPE_PRESET_NOT_ALLOWED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_SCOPE_PRESET_NOT_ALLOWED';
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
 * A CONNECT was refused because the provider granted scopes the connect did not request — for example an
 * earlier consent that was never revoked, or an organization-wide consent.
 *
 * Refused by default (the provider policy's `onOverGrant`). Nothing is stored: an existing connection is left
 * exactly as it was.
 */
export const USER_EXTERNAL_CONNECTION_OVER_GRANTED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_OVER_GRANTED';

// MARK: Data
/**
 * Refuses a connection data write (400) for a data type the app has not registered for the provider. Data `{ providerType, dataType }`.
 */
export const USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR';
/**
 * Refuses a connection data item key (400) the data type does not accept. Data `{ providerType, dataType }`.
 */
export const USER_EXTERNAL_CONNECTION_DATA_ITEM_KEY_INVALID_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_DATA_ITEM_KEY_INVALID_ERROR';
/**
 * Refuses a connection data value (400) that does not match the data type's shape. Data `{ providerType, dataType, itemKey, path? }`.
 * Never carries the value.
 */
export const USER_EXTERNAL_CONNECTION_DATA_VALUE_INVALID_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_DATA_VALUE_INVALID_ERROR';
/**
 * Refuses a connection data write (400) that exceeds a limit. Data `{ limit, bytes?, count?, scope: 'value' | 'items' | 'document' | 'operations' }`.
 */
export const USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR';
/**
 * The stored connection data could not be decrypted (500). An update with `clear: true` replaces it without reading it.
 */
export const USER_EXTERNAL_CONNECTION_DATA_UNREADABLE_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_DATA_UNREADABLE_ERROR';

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

/**
 * The only error codes a failed CONNECT reports back to the browser.
 *
 * An ALLOWLIST for the same reason as {@link USER_EXTERNAL_CONNECTION_SIGN_IN_REPORTABLE_ERROR_CODES}: the
 * connect failure redirect is a URL the user can read, so a code absent from this set is reported as nothing
 * at all.
 *
 * Shared with the client so the connect UI's copy map and the server's allowlist cannot drift.
 */
export const USER_EXTERNAL_CONNECTION_CONNECT_REPORTABLE_ERROR_CODES: ReadonlySet<string> = new Set<string>([USER_EXTERNAL_CONNECTION_OVER_GRANTED_ERROR_CODE]);
