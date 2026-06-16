import { CALL_MODEL_OIDC_SCOPE_DETAILS, type CallModelOidcScope, type OidcScopeDetails, type OidcTokenEndpointAuthMethod, PUBLIC_PKCE_TOKEN_ENDPOINT_AUTH_METHOD, STANDARD_OIDC_SCOPE_DETAILS, type StandardOidcScope } from '@dereekb/firebase';

// MARK: Scopes
/**
 * OIDC scopes available to APP_CODE_PREFIX OAuth clients.
 *
 * - {@link StandardOidcScope}: standard OpenID Connect scopes (`openid` / `profile` / `email` / `offline_access`).
 * - `APP_CODE_PREFIX_LOWER`: grants full access to the user's APP_CODE_PREFIX resources via the API.
 * - {@link CallModelOidcScope}: gates the `callModel` CRUD operations (enforced by `oidcCallModelScopePreAssert`).
 */
export type APP_CODE_PREFIXOidcScope = StandardOidcScope | 'APP_CODE_PREFIX_LOWER' | CallModelOidcScope;

/**
 * Frontend base path for the APP_CODE_PREFIX app's OAuth interaction pages.
 *
 * Must NOT start with `/oidc/` since that prefix is proxied to the backend's oidc controller.
 */
export const APP_CODE_PREFIX_CAPS_APP_OAUTH_INTERACTION_PATH = '/oauth';

/**
 * All available OIDC scopes, suitable for use in scope picker fields.
 */
export const APP_CODE_PREFIX_CAPS_OIDC_AVAILABLE_SCOPES: OidcScopeDetails<APP_CODE_PREFIXOidcScope>[] = [...STANDARD_OIDC_SCOPE_DETAILS, { label: 'APP_CODE_PREFIX', value: 'APP_CODE_PREFIX_LOWER', description: 'Full access to your APP_CODE_PREFIX resources via the API' }, ...CALL_MODEL_OIDC_SCOPE_DETAILS];

/**
 * All available OIDC token endpoint auth methods.
 *
 * `'none'` (PKCE-only public client) is included so the MCP / Claude connector
 * ecosystem (claude.ai connector, Claude Code CLI, mcp-inspector via DCR) can
 * register secret-less clients. oidc-provider still enforces PKCE on the
 * authorization_code flow for every client.
 */
export const APP_CODE_PREFIX_CAPS_OIDC_TOKEN_ENDPOINT_AUTH_METHODS: OidcTokenEndpointAuthMethod[] = ['client_secret_post', 'client_secret_basic', PUBLIC_PKCE_TOKEN_ENDPOINT_AUTH_METHOD];
