import { type LabeledValueWithDescription } from '@dereekb/util';
import { type OidcScope } from './oidc.base';

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
   * Whether this profile applies to a client that has NO profiles assigned (an empty or absent
   * `dbx_provider_profiles`). Defaults to `false`.
   *
   * Lets an app make a coarse, broadly-available scope profile-gated — so the profile picker becomes
   * the single control surface for scope grouping — without breaking every already-registered client.
   * Multiple default profiles union.
   *
   * The fallback is exclusive: a client assigned ANY profile resolves to exactly its assigned
   * profiles, so assigning a non-default profile does NOT additionally confer the default's scopes.
   *
   * Note a `require: 'required'` scope on a default profile is force-required for EVERY unassigned
   * client — a default profile usually wants `require: 'none'`.
   *
   * @see oidcProviderProfilesForClient
   */
  readonly isDefault?: boolean;
  /**
   * Whether the scopes this profile unlocks may only be granted to admin users. Defaults to `false`.
   *
   * Equivalent to listing this profile's scopes in `OidcProviderConfig.adminOnlyScopes` — the two are
   * unioned — but declared alongside the profile so the fact lives in one place rather than drifting
   * between the shared registry and the server provider config.
   *
   * Combined with `require: 'required'`, this makes the whole client admin-only: the client always
   * requests the scope, so a non-admin resolving its consent is always rejected with `access_denied`.
   *
   * Independent of {@link isDefault} and of the profile unlock gate — a scope may be subject to both
   * gates.
   *
   * @see adminOnlyScopesForOidcProviderProfiles
   */
  readonly adminOnly?: boolean;
  /**
   * The scopes this profile unlocks, each with an optional require mode.
   */
  readonly scopes: readonly OidcProviderProfileScopeConfig<S>[];
}

/**
 * Suffix appended to a default profile's description in {@link oidcProviderProfileDetails}, so an
 * admin viewing the picker sees that leaving the field empty still grants that profile's scopes.
 */
export const OIDC_PROVIDER_PROFILE_DEFAULT_DESCRIPTION_SUFFIX = 'Applied by default when no profiles are assigned.';

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
 * Filters the provider-profile registry to the profiles marked {@link OidcProviderProfile.isDefault}.
 *
 * @param profiles - The full provider-profile registry.
 * @returns The registry profiles that apply to a client with no assigned profiles.
 */
export function defaultOidcProviderProfiles<S extends OidcScope = OidcScope>(profiles: readonly OidcProviderProfile<S>[]): OidcProviderProfile<S>[] {
  return profiles.filter((profile) => profile.isDefault === true);
}

/**
 * Resolves the profiles that apply to a client: its assigned profiles, or — when it has NO profiles
 * assigned — the registry's default profiles.
 *
 * The fallback is exclusive: a client with any assigned key resolves to exactly
 * {@link oidcProviderProfilesForKeys}, so a non-default assignment never additionally confers the
 * default profiles' scopes. A registry declaring no default behaves identically to
 * {@link oidcProviderProfilesForKeys}.
 *
 * The fallback keys off the assigned key list being empty/absent rather than off the resolved set
 * being empty, so a client whose assigned profile was later removed from the registry resolves to no
 * profiles (fail-closed) rather than silently picking up the default.
 *
 * @param profiles - The full provider-profile registry.
 * @param keys - The profile keys assigned to the client (its `dbx_provider_profiles`).
 * @returns The client's assigned profiles, or the default profiles when none are assigned.
 */
export function oidcProviderProfilesForClient<S extends OidcScope = OidcScope>(profiles: readonly OidcProviderProfile<S>[], keys: readonly OidcProviderProfileKey[] | undefined): OidcProviderProfile<S>[] {
  return keys?.length ? oidcProviderProfilesForKeys(profiles, keys) : defaultOidcProviderProfiles(profiles);
}

/**
 * Collects every scope referenced by the given profiles.
 *
 * Passed the full registry, this is the set of "profile-gated" scopes — scopes a client may only
 * obtain via a profile. Passed a client's assigned profiles, this is the set of scopes those
 * profiles unlock for that client.
 *
 * Note a gated scope is not necessarily unavailable to an unassigned client: a scope unlocked by a
 * default profile is gated yet reachable by every client. Use
 * {@link assignmentOnlyScopesForOidcProviderProfiles} for the "requires an explicit assignment"
 * subset (e.g. to exclude scopes from a general picker or from advertised scope metadata).
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
 * Collects the scopes unlocked by the registry's default profiles — the scopes every client can
 * obtain, including one with no profiles assigned.
 *
 * @param profiles - The full provider-profile registry.
 * @returns The union of every default profile's scopes. Empty when no profile is marked default.
 */
export function defaultUnlockedScopesForOidcProviderProfiles<S extends OidcScope = OidcScope>(profiles: readonly OidcProviderProfile<S>[]): Set<S> {
  return scopesForOidcProviderProfiles(defaultOidcProviderProfiles(profiles));
}

/**
 * Collects the gated scopes that are NOT unlocked by default — the scopes a client can only obtain
 * via an explicit profile assignment.
 *
 * This is the set to exclude from a general scope picker or from advertised scope metadata (e.g. an
 * MCP protected-resource document's `scopes_supported`). Prefer it over
 * {@link scopesForOidcProviderProfiles} for that job: the full gated set would wrongly drop a
 * default-unlocked scope that every client can in fact obtain. With no default declared the two are
 * identical.
 *
 * @param profiles - The full provider-profile registry.
 * @returns Every profile-gated scope minus the default-unlocked ones.
 */
export function assignmentOnlyScopesForOidcProviderProfiles<S extends OidcScope = OidcScope>(profiles: readonly OidcProviderProfile<S>[]): Set<S> {
  const defaultUnlockedScopes = defaultUnlockedScopesForOidcProviderProfiles(profiles);
  const result = new Set<S>();

  scopesForOidcProviderProfiles(profiles).forEach((scope) => {
    if (!defaultUnlockedScopes.has(scope)) {
      result.add(scope);
    }
  });

  return result;
}

/**
 * Collects the scopes of every profile marked {@link OidcProviderProfile.adminOnly}.
 *
 * Unioned with `OidcProviderConfig.adminOnlyScopes` by the consent admin-only gate: a consent
 * requesting one of these scopes is hard-rejected with `access_denied` when the resolving user is
 * not an admin.
 *
 * @param profiles - The full provider-profile registry.
 * @returns The union of every admin-only profile's scopes. Empty when no profile is marked admin-only.
 */
export function adminOnlyScopesForOidcProviderProfiles<S extends OidcScope = OidcScope>(profiles: readonly OidcProviderProfile<S>[]): Set<S> {
  return scopesForOidcProviderProfiles(profiles.filter((profile) => profile.adminOnly === true));
}

/**
 * Builds picker entries for the given provider profiles, suitable for an admin profile-selection field.
 *
 * A default profile's description carries {@link OIDC_PROVIDER_PROFILE_DEFAULT_DESCRIPTION_SUFFIX} so
 * an admin isn't surprised that an empty selection still grants scopes. Default profiles are
 * deliberately not pre-selected — persisting the default as an explicit assignment would opt the
 * client out of the fallback, so it would stop tracking the registry if the default later changed.
 *
 * @param profiles - The provider-profile registry.
 * @returns One {@link OidcProviderProfileDetails} per profile.
 */
export function oidcProviderProfileDetails<S extends OidcScope = OidcScope>(profiles: readonly OidcProviderProfile<S>[]): OidcProviderProfileDetails[] {
  return profiles.map((profile) => ({ value: profile.key, label: profile.label, description: profile.isDefault ? [profile.description, OIDC_PROVIDER_PROFILE_DEFAULT_DESCRIPTION_SUFFIX].filter(Boolean).join(' ') : profile.description }));
}
