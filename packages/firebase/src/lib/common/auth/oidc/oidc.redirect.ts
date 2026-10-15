import { type Maybe } from '@dereekb/util';
import { type OidcRedirectUri } from './oidc.base';

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
 * Redirect URI suggestions for well-known hosted MCP clients (Claude, ChatGPT, and Grok).
 *
 * These are the callback URIs each client redirects to when it connects to an MCP server whose OAuth client was registered by hand
 * (rather than through dynamic client registration).
 */
export const KNOWN_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTIONS: readonly OidcRedirectUriSuggestion[] = [CLAUDE_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION, CHATGPT_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION, GROK_MCP_CLIENT_OIDC_REDIRECT_URI_SUGGESTION];
