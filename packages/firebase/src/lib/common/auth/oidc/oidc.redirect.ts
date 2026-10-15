import { type Maybe, isCustomSchemeUri } from '@dereekb/util';
import { type OidcRedirectUri } from './oidc.base';

// MARK: Application Type
/**
 * The OAuth client `application_type` (OpenID Connect Dynamic Client Registration).
 *
 * - `web`: redirect URIs must use `http` or `https`.
 * - `native`: an app on the user's device (e.g. Cursor). Redirect URIs may use a private-use (custom) scheme such as `cursor://`, loopback `http`, or `https` on a non-loopback host.
 */
export type OidcClientApplicationType = 'web' | 'native';

/**
 * Returns the {@link OidcClientApplicationType} a client needs in order to register the input redirect URIs.
 *
 * A client with any custom-scheme redirect URI (see {@link isCustomSchemeUri}) must be `native`. Otherwise it is `web`.
 *
 * Note that a `native` client may only use `http` redirect URIs on a loopback host (`localhost`, `127.0.0.1`, `[::1]`), so oidc-provider rejects a client that mixes a custom scheme with a non-loopback `http` URI.
 *
 * @param redirectUris - The client's redirect URIs.
 * @returns `native` if any redirect URI uses a custom scheme, otherwise `web`.
 */
export function oidcClientApplicationTypeForRedirectUris(redirectUris: OidcRedirectUri[]): OidcClientApplicationType {
  return redirectUris.some(isCustomSchemeUri) ? 'native' : 'web';
}

/**
 * A labeled group of redirect URIs suggested when registering an OIDC client.
 *
 * Used to offer one-click entry of the callback URIs that a known client (e.g. an MCP client such as Claude) redirects to.
 */
export interface OidcRedirectUriSuggestion {
  /**
   * Human-readable label for the suggestion, e.g. `'Claude'`.
   */
  readonly label: string;
  /**
   * Redirect URIs added together when the suggestion is picked.
   */
  readonly redirectUris: OidcRedirectUri[];
  /**
   * Optional description of the client and the redirect URIs.
   */
  readonly description?: Maybe<string>;
}

/**
 * Redirect URIs used by Claude's custom connectors (claude.ai, Claude Desktop, and Claude mobile).
 *
 * Anthropic documents `https://claude.ai/api/mcp/auth_callback` and notes it may move to the claude.com domain, so both are included.
 */
export const CLAUDE_MCP_CLIENT_OIDC_REDIRECT_URIS: OidcRedirectUri[] = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'];

/**
 * Stable redirect URI used by ChatGPT apps/connectors.
 *
 * ChatGPT uses this URI when the authorization server supports issuer identification (RFC 9207). Otherwise ChatGPT uses a per-app
 * `https://chatgpt.com/connector/oauth/{callback_id}` URI that is shown on the app's management page and must be added by hand.
 */
export const CHATGPT_MCP_CLIENT_OIDC_REDIRECT_URIS: OidcRedirectUri[] = ['https://chatgpt.com/connector_platform_oauth_redirect'];

/**
 * Redirect URIs used by Grok's custom connectors.
 */
export const GROK_MCP_CLIENT_OIDC_REDIRECT_URIS: OidcRedirectUri[] = ['https://grok.com/connectors/oauth/callback', 'https://grok.com/connectors-oauth-exchange-code/'];

/**
 * Redirect URIs used by Cursor's MCP OAuth flow: the `cursor://` app callback, the Cloud Agents/web callback, and the desktop loopback callback.
 *
 * Which one Cursor sends varies by build, so all three are included. The `cursor://` custom scheme registers the client as a native client
 * (see {@link oidcClientApplicationTypeForRedirectUris}).
 */
export const CURSOR_MCP_CLIENT_OIDC_REDIRECT_URIS: OidcRedirectUri[] = ['cursor://anysphere.cursor-mcp/oauth/callback', 'https://www.cursor.com/agents/mcp/oauth/callback', 'http://localhost:8787/callback'];

/**
 * Redirect URIs used by the Grok Bot app's MCP OAuth flow.
 *
 * Grok Bot runs on Cursor's agent platform and registers the same callbacks as Cursor. The desktop app authorizes through the loopback callback.
 */
export const GROK_BOT_MCP_CLIENT_OIDC_REDIRECT_URIS: OidcRedirectUri[] = CURSOR_MCP_CLIENT_OIDC_REDIRECT_URIS;

/**
 * {@link OidcRedirectUriSuggestion} for Claude's custom connectors.
 */
export const CLAUDE_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION: OidcRedirectUriSuggestion = {
  label: 'Claude',
  redirectUris: CLAUDE_MCP_CLIENT_OIDC_REDIRECT_URIS,
  description: 'Claude custom connectors (claude.ai, Claude Desktop, and Claude mobile).'
};

/**
 * {@link OidcRedirectUriSuggestion} for ChatGPT apps/connectors.
 */
export const CHATGPT_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION: OidcRedirectUriSuggestion = {
  label: 'ChatGPT',
  redirectUris: CHATGPT_MCP_CLIENT_OIDC_REDIRECT_URIS,
  description: "ChatGPT apps/connectors. If ChatGPT shows a per-app callback URL on the app's management page, add that URL instead."
};

/**
 * {@link OidcRedirectUriSuggestion} for Grok's custom connectors.
 */
export const GROK_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION: OidcRedirectUriSuggestion = {
  label: 'Grok',
  redirectUris: GROK_MCP_CLIENT_OIDC_REDIRECT_URIS,
  description: 'Grok custom connectors.'
};

/**
 * {@link OidcRedirectUriSuggestion} for Cursor.
 */
export const CURSOR_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION: OidcRedirectUriSuggestion = {
  label: 'Cursor',
  redirectUris: CURSOR_MCP_CLIENT_OIDC_REDIRECT_URIS,
  description: 'Cursor desktop and Cloud Agents. Registers the client as a native app because of the cursor:// callback.'
};

/**
 * {@link OidcRedirectUriSuggestion} for the Grok Bot app.
 */
export const GROK_BOT_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION: OidcRedirectUriSuggestion = {
  label: 'Grok Bot',
  redirectUris: GROK_BOT_MCP_CLIENT_OIDC_REDIRECT_URIS,
  description: "Grok Bot app (desktop and cloud). Uses Cursor's callbacks. Registers the client as a native app because of the cursor:// callback."
};

/**
 * Redirect URI suggestions for well-known MCP clients (Claude, ChatGPT, Grok, Cursor, and Grok Bot).
 *
 * These are the callback URIs each client redirects to when it connects to an MCP server whose OAuth client was registered by hand
 * (rather than through dynamic client registration).
 */
export const KNOWN_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTIONS: readonly OidcRedirectUriSuggestion[] = [
  CLAUDE_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION,
  CHATGPT_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION,
  GROK_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION,
  CURSOR_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION,
  GROK_BOT_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION
];
