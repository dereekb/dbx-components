import {
  ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS,
  CALL_MODEL_OIDC_SCOPE_DETAILS,
  type CallModelOidcScope,
  CLI_TOKEN_OIDC_SCOPE,
  type CliTokenOidcScope,
  FIRESTORE_SESSION_OIDC_SCOPE_DETAILS,
  type FirestoreSessionOidcScope,
  type OidcProviderProfile,
  type OidcProviderProfileDetails,
  oidcProviderProfileDetails,
  type OidcScopeDetails,
  type OidcTokenEndpointAuthMethod,
  SERVICE_TOKEN_OIDC_SCOPE_DETAILS,
  type ServiceTokenOidcScope,
  STANDARD_OIDC_SCOPE_DETAILS,
  type StandardOidcScope
} from '@dereekb/firebase';

// MARK: Scopes
/**
 * OIDC scopes available to demo OAuth clients.
 *
 * - {@link StandardOidcScope}: standard OpenID Connect scopes
 *   (`openid` / `profile` / `email` / `offline_access`).
 * - `demo`: grants full access to the user's Demo resources via the API.
 * - `model.create` / `model.read` / `model.update` / `model.delete` / `model.query`:
 *   gate the corresponding `callModel` CRUD operation. Enforced at the model-api
 *   layer (`ModelApiDispatchConfig` / `assertModelApiOidcScope`). Keep this
 *   union in sync with `CALL_MODEL_OIDC_SCOPES`.
 * - {@link ServiceTokenOidcScope} (`token.service`): admin-only scope that makes the
 *   issued grant long-lived and non-rotating, for non-interactive server/API use.
 *   Hard-rejected for non-admins and disables refresh-token rotation (wired in
 *   `DemoApiOidcModule`).
 * - {@link FirestoreSessionOidcScope} (`session.firestore`): admin-only scope that lets a headless
 *   client trade its access token for a direct-Firestore session (a custom token + App Check
 *   attestation) and read through the same security rules the browser app is subject to. Enforced by
 *   `GET /api/session/firestore` (see `DemoSessionApiModule`), which is admin-gated first — the scope
 *   is defence in depth.
 * - {@link CliTokenOidcScope} (`token.cli`): admin-only scope that lets a session mint a short-lived
 *   CLI login credential for itself. Unlocked only by the {@link CLI_HANDOFF_OIDC_PROVIDER_PROFILE_KEY}
 *   provider profile, so it is part of {@link DemoOidcProviderProfileScope} rather than of the general
 *   picker — see {@link DEMO_OIDC_PROVIDER_PROFILES}.
 */
export type DemoOidcScope = StandardOidcScope | 'demo' | CallModelOidcScope | ServiceTokenOidcScope | FirestoreSessionOidcScope | DemoOidcProviderProfileScope;

/**
 * The `lms` OIDC scope — unlocked (and force-required) by the `lms` provider profile, and used as a
 * per-function `requiredScope` on the callModel API to gate LMS-only operations (see
 * `guestbookEntryAllPublishedEntries` in demo-api).
 */
export const LMS_OIDC_SCOPE = 'lms' as const;

/**
 * The `reports` OIDC scope — unlocked (optionally) by the `reports` provider profile.
 */
export const REPORTS_OIDC_SCOPE = 'reports' as const;

/**
 * Key of the admin-only provider profile that unlocks {@link CLI_TOKEN_OIDC_SCOPE}.
 *
 * Deliberately a PROFILE rather than an `adminOnlyScopes` entry: only a client an admin explicitly
 * assigned this profile to can obtain `token.cli`.
 *
 * demo-api's MCP resource metadata advertises the scope anyway (see `demoMcpModuleConfigFactory`),
 * because a connector that never requests it could never mint a credential. That does not widen the
 * grant: the consent URL builder withholds an assignment-only scope from any client whose profiles
 * do not unlock it, so an ordinary DCR'd connector still never obtains it — it simply completes
 * without it instead of failing.
 */
export const CLI_HANDOFF_OIDC_PROVIDER_PROFILE_KEY = 'cli-handoff';

export type LmsOidcScope = typeof LMS_OIDC_SCOPE;
export type ReportsOidcScope = typeof REPORTS_OIDC_SCOPE;

/**
 * Scopes that are unlocked only via an {@link OidcProviderProfile} (see {@link DEMO_OIDC_PROVIDER_PROFILES}).
 *
 * These are intentionally excluded from {@link DEMO_OIDC_AVAILABLE_SCOPES} (the general scope picker): a
 * client can only obtain them when an admin assigns the corresponding provider profile.
 *
 * - {@link LMS_OIDC_SCOPE} (`lms`): unlocked (and force-required) by the `lms` profile.
 * - {@link REPORTS_OIDC_SCOPE} (`reports`): unlocked (optional) by the `reports` profile.
 * - {@link CliTokenOidcScope} (`token.cli`): unlocked (optional) by the admin-only `cli-handoff` profile.
 */
export type DemoOidcProviderProfileScope = LmsOidcScope | ReportsOidcScope | CliTokenOidcScope;

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
 * NOTE: {@link DemoOidcProviderProfileScope} scopes (`lms`, `reports`, `token.cli`) are intentionally excluded — they
 * are restricted and unlocked only via an {@link OidcProviderProfile} (see {@link DEMO_OIDC_PROVIDER_PROFILES}).
 * This is the `assignmentOnlyScopesForOidcProviderProfiles` set: no demo profile is marked `isDefault`,
 * so every gated scope requires an explicit assignment. Were a default profile added, its scopes would
 * belong back in this picker — every client can obtain them.
 */
export const DEMO_OIDC_AVAILABLE_SCOPES: OidcScopeDetails<DemoOidcScope>[] = [...STANDARD_OIDC_SCOPE_DETAILS, { label: 'Demo', value: 'demo', description: 'Full access to your Demo resources via the API' }, ...CALL_MODEL_OIDC_SCOPE_DETAILS, SERVICE_TOKEN_OIDC_SCOPE_DETAILS, FIRESTORE_SESSION_OIDC_SCOPE_DETAILS];

/**
 * OIDC provider profiles for the demo app. Admins assign these to a client to unlock otherwise-restricted
 * scopes. Declared statically here and supplied to the provider via `DEMO_OIDC_PROVIDER_CONFIG.providerProfiles`.
 *
 * - `lms`: unlocks and force-requires the `lms` scope. Every LMS client's token carries `lms`.
 * - `reports`: unlocks the `reports` scope as optional (the client may request it, but it is not forced).
 * - `cli-handoff`: unlocks the admin-only `token.cli` scope as optional.
 */
export const DEMO_OIDC_PROVIDER_PROFILES: OidcProviderProfile<DemoOidcScope>[] = demoOidcProviderProfiles({ unlockCliHandoffByDefault: false });

/**
 * Config for {@link demoOidcProviderProfiles}.
 */
export interface DemoOidcProviderProfilesConfig {
  /**
   * When true, the {@link CLI_HANDOFF_OIDC_PROVIDER_PROFILE_KEY} profile is marked
   * {@link OidcProviderProfile.isDefault}, so every client resolves to it without an explicit
   * assignment and can request {@link CLI_TOKEN_OIDC_SCOPE}.
   *
   * Intended for non-production environments, where the connector an agent registers for itself via
   * DCR would otherwise need a manual profile assignment before it could mint anything. The profile
   * stays `adminOnly` either way, so a non-admin is still refused at the consent gate — this only
   * removes the per-client assignment step, not the admin check.
   *
   * A side effect worth knowing: a default-unlocked scope is no longer assignment-only, so
   * `assignmentOnlyScopesForOidcProviderProfiles` stops excluding it and `token.cli` begins appearing
   * in advertised scope metadata on its own.
   */
  readonly unlockCliHandoffByDefault?: boolean;
}

/**
 * Builds the demo app's OIDC provider profiles.
 *
 * @param config - Whether the admin-only CLI-handoff profile should be a default profile. Omitted
 * entirely, it yields the PRODUCTION shape: nothing is default-unlocked.
 * @returns The provider profile registry to supply as `OidcProviderConfig.providerProfiles`.
 */
export function demoOidcProviderProfiles(config: DemoOidcProviderProfilesConfig = {}): OidcProviderProfile<DemoOidcScope>[] {
  const { unlockCliHandoffByDefault = false } = config;

  return [
    { key: 'lms', label: 'LMS', description: 'Learning management system integration (unlocks + requires the lms scope)', scopes: [{ scope: LMS_OIDC_SCOPE, require: 'required' }] },
    { key: 'reports', label: 'Reports', description: 'Reporting integration (unlocks the reports scope)', scopes: [{ scope: REPORTS_OIDC_SCOPE, require: 'none' }] },
    {
      key: CLI_HANDOFF_OIDC_PROVIDER_PROFILE_KEY,
      label: 'CLI handoff (admin)',
      description: 'Admin-only: mint short-lived CLI credentials from a session',
      // `adminOnly` unions into the consent admin gate WITHOUT listing token.cli in
      // `adminOnlyScopes` — that array also selects the 365-day service-token TTL tier, which would
      // silently promote every admin grant that carries the scope to a year-long session.
      adminOnly: true,
      ...(unlockCliHandoffByDefault ? { isDefault: true } : undefined),
      scopes: [{ scope: CLI_TOKEN_OIDC_SCOPE, require: 'none' }]
    }
  ];
}

/**
 * Provider profile picker entries for the demo app, suitable for an admin profile-selection field.
 */
export const DEMO_OIDC_PROVIDER_PROFILE_DETAILS: OidcProviderProfileDetails[] = oidcProviderProfileDetails(DEMO_OIDC_PROVIDER_PROFILES);

/**
 * All available OIDC token endpoint auth methods for the demo app, suitable for use in auth method picker fields.
 */
export const DEMO_OIDC_TOKEN_ENDPOINT_AUTH_METHODS: OidcTokenEndpointAuthMethod[] = ALL_OIDC_TOKEN_ENDPOINT_AUTH_METHODS;
