import { type LabeledValueWithDescription } from '@dereekb/util';
import { type OidcScope } from './oidcmodel.interaction';

// MARK: Provider Profiles
/**
 * Arbitrary key identifying an {@link OidcProviderProfile} (e.g. `'lms'`).
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:oidc
 */
export type OidcProviderProfileKey = string;

/**
 * How a scope unlocked by an {@link OidcProviderProfile} is enforced for a client
 * carrying that profile.
 *
 * - `none`: the scope is merely unlocked/allowed — the client may request it, but it stays optional.
 * - `required`: the scope is force-required — it is surfaced as a required (non-deselectable) scope
 *   at consent and the interaction is rejected if it is not granted.
 */
export type OidcProviderProfileScopeRequireMode = 'none' | 'required';

/**
 * A single scope entry within an {@link OidcProviderProfile}.
 */
export interface OidcProviderProfileScopeConfig<S extends OidcScope = OidcScope> {
  /**
   * The scope this profile unlocks. It should be a scope that is otherwise restricted (not offered
   * in the general scope picker) so that only clients carrying this profile can request it.
   */
  readonly scope: S;
  /**
   * How the scope is enforced. Defaults to `none` (unlock only, optional) when omitted.
   */
  readonly require?: OidcProviderProfileScopeRequireMode;
}

/**
 * A named, admin-assignable preset that unlocks (and optionally force-requires) scopes for the OIDC
 * clients it is assigned to.
 *
 * Provider profiles are declared statically in code (an exported registry) and supplied to the
 * provider via {@link OidcProviderConfig.providerProfiles}. An admin assigns one or more profile keys
 * to an OIDC client (persisted as `dbx_provider_profiles` client metadata). At consent, a scope
 * referenced by any profile is treated as restricted: a client may only obtain it when one of its
 * assigned profiles unlocks it.
 *
 * @example
 * ```ts
 * const LMS_PROVIDER_PROFILE: OidcProviderProfile = {
 *   key: 'lms',
 *   label: 'LMS',
 *   scopes: [{ scope: 'lms', require: 'required' }]
 * };
 * ```
 */
export interface OidcProviderProfile<S extends OidcScope = OidcScope> {
  /**
   * Unique key for the profile (e.g. `'lms'`).
   */
  readonly key: OidcProviderProfileKey;
  /**
   * Human-readable label, used in the admin profile picker.
   */
  readonly label: string;
  /**
   * Optional human-readable description, used in the admin profile picker.
   */
  readonly description?: string;
  /**
   * The scopes this profile unlocks, each with an optional require mode.
   */
  readonly scopes: readonly OidcProviderProfileScopeConfig<S>[];
}

/**
 * Profile picker entry (label + key + description), mirroring {@link OidcScopeDetails}.
 */
export type OidcProviderProfileDetails = LabeledValueWithDescription<OidcProviderProfileKey>;

// MARK: Utility
/**
 * Filters the provider-profile registry to the profiles matching the given assigned keys.
 *
 * @param profiles - The full provider-profile registry.
 * @param keys - The profile keys assigned to a client (e.g. `OidcEntry` `dbx_provider_profiles`).
 * @returns The registry profiles whose key is in `keys`.
 */
export function oidcProviderProfilesForKeys<S extends OidcScope = OidcScope>(profiles: readonly OidcProviderProfile<S>[], keys: readonly OidcProviderProfileKey[] | undefined): OidcProviderProfile<S>[] {
  const keySet = new Set<OidcProviderProfileKey>(keys ?? []);
  return profiles.filter((profile) => keySet.has(profile.key));
}

/**
 * Collects every scope referenced by the given profiles.
 *
 * Passed the full registry, this is the set of "profile-gated" scopes — scopes a client may only
 * obtain via a profile. Passed a client's assigned profiles, this is the set of scopes those
 * profiles unlock for that client.
 *
 * @param profiles - The profiles to collect scopes from.
 * @returns The union of every profile's scopes.
 */
export function scopesForOidcProviderProfiles<S extends OidcScope = OidcScope>(profiles: readonly OidcProviderProfile<S>[]): Set<S> {
  const result = new Set<S>();
  profiles.forEach((profile) => profile.scopes.forEach((scopeConfig) => result.add(scopeConfig.scope)));
  return result;
}

/**
 * Collects the scopes marked `require: 'required'` across the given profiles.
 *
 * @param profiles - The profiles to collect required scopes from (typically a client's assigned profiles).
 * @returns The union of every profile's `required` scopes.
 */
export function requiredScopesForOidcProviderProfiles<S extends OidcScope = OidcScope>(profiles: readonly OidcProviderProfile<S>[]): Set<S> {
  const result = new Set<S>();
  profiles.forEach((profile) =>
    profile.scopes.forEach((scopeConfig) => {
      if (scopeConfig.require === 'required') {
        result.add(scopeConfig.scope);
      }
    })
  );
  return result;
}

/**
 * Builds picker entries for the given provider profiles, suitable for an admin profile-selection field.
 *
 * @param profiles - The provider-profile registry.
 * @returns One {@link OidcProviderProfileDetails} per profile.
 */
export function oidcProviderProfileDetails<S extends OidcScope = OidcScope>(profiles: readonly OidcProviderProfile<S>[]): OidcProviderProfileDetails[] {
  return profiles.map((profile) => ({ value: profile.key, label: profile.label, description: profile.description }));
}
