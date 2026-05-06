/**
 * Standard "out-of-band" OAuth 2.0 redirect URI URN.
 *
 * Defined by RFC 6749 §1.3 / draft-ietf-oauth-native-apps. Used by native and CLI clients that
 * have no HTTP server to receive the redirect — the authorization server displays the
 * authorization code on a final page and the user pastes it back into the application.
 *
 * Many providers have deprecated this in favor of loopback redirects (e.g.
 * `http://127.0.0.1:<port>/callback`), but it remains in use as a fallback for tools that cannot
 * bind a local port.
 */
export const OAUTH_OOB_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
