import { type LabeledValue } from '@dereekb/util';

// MARK: Scopes
/**
 * `demo` scope grants full access to the user's Demo resources via the API.
 */
export type DemoOidcScope = 'openid' | 'profile' | 'email' | 'demo';

/** All available OIDC scopes for the demo app, suitable for use in scope picker fields. */
export const DEMO_OIDC_AVAILABLE_SCOPES: LabeledValue<DemoOidcScope>[] = [
  { label: 'OpenID', value: 'openid' },
  { label: 'Profile', value: 'profile' },
  { label: 'Email', value: 'email' },
  { label: 'Demo', value: 'demo' }
];
