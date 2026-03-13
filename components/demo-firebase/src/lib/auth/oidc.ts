import { OidcTokenEndpointAuthMethod } from '@dereekb/firebase';
import { type LabeledValue } from '@dereekb/util';

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
export const DEMO_OIDC_AVAILABLE_SCOPES: LabeledValue<DemoOidcScope>[] = [
  { label: 'OpenID', value: 'openid' },
  { label: 'Profile', value: 'profile' },
  { label: 'Email', value: 'email' },
  { label: 'Demo', value: 'demo' }
];

/** All available OIDC token endpoint auth methods for the demo app, suitable for use in auth method picker fields. */
export const DEMO_OIDC_TOKEN_ENDPOINT_AUTH_METHODS: OidcTokenEndpointAuthMethod[] = ['client_secret_post', 'client_secret_basic', 'client_secret_jwt', 'private_key_jwt'];
