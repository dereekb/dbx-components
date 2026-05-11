import { ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS, CALL_MODEL_OIDC_SCOPE_DETAILS, type CallModelOidcScope, type OidcScopeDetails, type OidcTokenEndpointAuthMethod, STANDARD_OIDC_SCOPE_DETAILS, type StandardOidcScope } from '@dereekb/firebase';

// MARK: Scopes
/**
 * OIDC scopes available to demo OAuth clients.
 *
 * - {@link StandardOidcScope}: standard OpenID Connect scopes
 *   (`openid` / `profile` / `email` / `offline_access`).
 * - `demo`: grants full access to the user's Demo resources via the API.
 * - `model.create` / `model.read` / `model.update` / `model.delete` / `model.query`:
 *   gate the corresponding `callModel` CRUD operation. Enforced by
 *   `oidcCallModelScopePreAssert` in `@dereekb/firebase-server/oidc`. Keep this
 *   union in sync with `CALL_MODEL_OIDC_SCOPES`.
 */
export type DemoOidcScope = StandardOidcScope | 'demo' | CallModelOidcScope;

/**
 * Frontend base path for the demo app's OAuth interaction pages.
 *
 * Overrides {@link DEFAULT_APP_OAUTH_INTERACTION_PATH} so interaction routes
 * live under the demo app's routing namespace (e.g., `/demo/oauth/login?uid=...`).
 *
 * Must NOT start with `/oidc/` since that prefix is proxied to the backend's oidc controller.
 */
export const DEMO_APP_OAUTH_INTERACTION_PATH = '/demo/oauth';

/**
 * All available OIDC scopes for the demo app, suitable for use in scope picker fields.
 */
export const DEMO_OIDC_AVAILABLE_SCOPES: OidcScopeDetails<DemoOidcScope>[] = [...STANDARD_OIDC_SCOPE_DETAILS, { label: 'Demo', value: 'demo', description: 'Full access to your Demo resources via the API' }, ...CALL_MODEL_OIDC_SCOPE_DETAILS];

/**
 * All available OIDC token endpoint auth methods for the demo app, suitable for use in auth method picker fields.
 */
export const DEMO_OIDC_TOKEN_ENDPOINT_AUTH_METHODS: OidcTokenEndpointAuthMethod[] = ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS;
