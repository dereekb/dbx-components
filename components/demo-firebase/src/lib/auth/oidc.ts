import { ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS, CALL_MODEL_OIDC_SCOPE_DETAILS, type CallModelOidcScope, type OidcProviderProfile, type OidcProviderProfileDetails, oidcProviderProfileDetails, type OidcScopeDetails, type OidcTokenEndpointAuthMethod, SERVICE_TOKEN_OIDC_SCOPE_DETAILS, type ServiceTokenOidcScope, STANDARD_OIDC_SCOPE_DETAILS, type StandardOidcScope } from '@dereekb/firebase';

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
 * - {@link ServiceTokenOidcScope} (`token.service`): admin-only scope that makes the
 *   issued grant long-lived and non-rotating, for non-interactive server/API use.
 *   Hard-rejected for non-admins and disables refresh-token rotation (wired in
 *   `DemoApiOidcModule`).
 */
export type DemoOidcScope = StandardOidcScope | 'demo' | CallModelOidcScope | ServiceTokenOidcScope | DemoOidcProviderProfileScope;

/**
 * Scopes that are unlocked only via an {@link OidcProviderProfile} (see {@link DEMO_OIDC_PROVIDER_PROFILES}).
 *
 * These are intentionally excluded from {@link DEMO_OIDC_AVAILABLE_SCOPES} (the general scope picker): a
 * client can only obtain them when an admin assigns the corresponding provider profile.
 *
 * - `lms`: unlocked (and force-required) by the `lms` profile.
 * - `reports`: unlocked (optional) by the `reports` profile.
 */
export type DemoOidcProviderProfileScope = 'lms' | 'reports';

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
 *
 * NOTE: {@link DemoOidcProviderProfileScope} scopes (`lms`, `reports`) are intentionally excluded — they
 * are restricted and unlocked only via an {@link OidcProviderProfile} (see {@link DEMO_OIDC_PROVIDER_PROFILES}).
 */
export const DEMO_OIDC_AVAILABLE_SCOPES: OidcScopeDetails<DemoOidcScope>[] = [...STANDARD_OIDC_SCOPE_DETAILS, { label: 'Demo', value: 'demo', description: 'Full access to your Demo resources via the API' }, ...CALL_MODEL_OIDC_SCOPE_DETAILS, SERVICE_TOKEN_OIDC_SCOPE_DETAILS];

/**
 * OIDC provider profiles for the demo app. Admins assign these to a client to unlock otherwise-restricted
 * scopes. Declared statically here and supplied to the provider via `DEMO_OIDC_PROVIDER_CONFIG.providerProfiles`.
 *
 * - `lms`: unlocks and force-requires the `lms` scope. Every LMS client's token carries `lms`.
 * - `reports`: unlocks the `reports` scope as optional (the client may request it, but it is not forced).
 */
export const DEMO_OIDC_PROVIDER_PROFILES: OidcProviderProfile<DemoOidcScope>[] = [
  { key: 'lms', label: 'LMS', description: 'Learning management system integration (unlocks + requires the lms scope)', scopes: [{ scope: 'lms', require: 'required' }] },
  { key: 'reports', label: 'Reports', description: 'Reporting integration (unlocks the reports scope)', scopes: [{ scope: 'reports', require: 'none' }] }
];

/**
 * Provider profile picker entries for the demo app, suitable for an admin profile-selection field.
 */
export const DEMO_OIDC_PROVIDER_PROFILE_DETAILS: OidcProviderProfileDetails[] = oidcProviderProfileDetails(DEMO_OIDC_PROVIDER_PROFILES);

/**
 * All available OIDC token endpoint auth methods for the demo app, suitable for use in auth method picker fields.
 */
export const DEMO_OIDC_TOKEN_ENDPOINT_AUTH_METHODS: OidcTokenEndpointAuthMethod[] = ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS;
