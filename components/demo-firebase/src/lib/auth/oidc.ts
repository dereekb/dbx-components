import { OidcScopeDetails, OidcTokenEndpointAuthMethod } from '@dereekb/firebase';

// MARK: Scopes
/**
 * `demo` scope grants full access to the user's Demo resources via the API.
 */
export type DemoOidcScope = 'openid' | 'profile' | 'email' | 'demo';

/**
 * Frontend base path for the demo app's OAuth interaction pages.
 *
 * Overrides {@link DEFAULT_APP_OAUTH_INTERACTION_PATH} so interaction routes
 * live under the demo app's routing namespace (e.g., `/demo/oauth/login?uid=...`).
 *
 * Must NOT start with `/oidc/` since that prefix is proxied to the backend's oidc controller.
 */
export const DEMO_APP_OAUTH_INTERACTION_PATH = '/demo/oauth';

/** All available OIDC scopes for the demo app, suitable for use in scope picker fields. */
export const DEMO_OIDC_AVAILABLE_SCOPES: OidcScopeDetails<DemoOidcScope>[] = [
  { label: 'OpenID', value: 'openid', description: 'Authenticate your identity using OpenID Connect' },
  { label: 'Profile', value: 'profile', description: 'Access your basic profile information' },
  { label: 'Email', value: 'email', description: 'Access your email address' },
  { label: 'Demo', value: 'demo', description: 'Full access to your Demo resources via the API' }
];

/** All available OIDC token endpoint auth methods for the demo app, suitable for use in auth method picker fields. */
export const DEMO_OIDC_TOKEN_ENDPOINT_AUTH_METHODS: OidcTokenEndpointAuthMethod[] = ['client_secret_post', 'client_secret_basic', 'client_secret_jwt', 'private_key_jwt'];
