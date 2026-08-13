import { adminOnlyScopesForOidcProviderProfiles, type OidcProviderProfile, oidcProviderProfilesForClient, requiredScopesForOidcProviderProfiles, scopesForOidcProviderProfiles, type OidcScope, type OidcProviderProfileKey } from '@dereekb/firebase';

/**
 * Custom oidc-provider client metadata field holding the {@link OidcProviderProfile} keys assigned
 * to a client. Registered via `extraClientMetadata` and persisted on the client's `OidcEntry` payload.
 */
export const DBX_FIREBASE_SERVER_OIDC_PROVIDER_PROFILES_CLIENT_METADATA = 'dbx_provider_profiles';

/**
 * The scopes a client with the given assigned profile keys is allowed/required to obtain, resolved
 * against the provider-profile registry.
 */
export interface OidcClientProviderProfileScopes<S extends OidcScope = OidcScope> {
  /**
   * Scopes unlocked for the client (the union of its assigned profiles' scopes).
   */
  readonly unlocked: Set<S>;
  /**
   * Scopes the client's profiles force-require (`require: 'required'`).
   */
  readonly required: Set<S>;
}

/**
 * Resolves the unlocked + required scope sets for a client from the provider-profile registry and
 * the profile keys assigned to that client.
 *
 * A client with NO assigned profiles resolves to the registry's default profiles (those marked
 * `isDefault`), so a registry declaring no default resolves exactly as it would from the assigned
 * keys alone.
 *
 * This is the single choke point for a client's profile resolution — the consent unlock gate, the
 * consent required gate, and the `requiredScopes` interaction param all read through it.
 *
 * @param providerProfiles - The provider-profile registry (from {@link OidcProviderConfig.providerProfiles}).
 * @param clientProfileKeys - The profile keys assigned to the client (its `dbx_provider_profiles`).
 * @returns The unlocked and required scope sets for the client.
 */
export function oidcClientProviderProfileScopes<S extends OidcScope = OidcScope>(providerProfiles: readonly OidcProviderProfile<S>[] | undefined, clientProfileKeys: readonly OidcProviderProfileKey[] | undefined): OidcClientProviderProfileScopes<S> {
  const clientProfiles = oidcProviderProfilesForClient(providerProfiles ?? [], clientProfileKeys);
  return {
    unlocked: scopesForOidcProviderProfiles(clientProfiles),
    required: requiredScopesForOidcProviderProfiles(clientProfiles)
  };
}

/**
 * The subset of an {@link OidcProviderConfig} needed to resolve its admin-only scopes. Declared
 * structurally so this module stays free of a dependency on the config type.
 */
export interface OidcAdminOnlyScopesInput<S extends OidcScope = OidcScope> {
  readonly adminOnlyScopes?: readonly string[];
  readonly providerProfiles?: readonly OidcProviderProfile<S>[];
}

/**
 * Resolves every scope restricted to admin users: the provider config's own `adminOnlyScopes`
 * unioned with the scopes of each profile marked {@link OidcProviderProfile.adminOnly}.
 *
 * The single choke point for that union — the consent admin-only gate (which hard-rejects a
 * non-admin who consented to one) and the consent URL builder (which withholds them from a
 * non-admin's consent screen in the first place) both read through it, so the set a user is
 * offered and the set they are judged against cannot drift apart.
 *
 * @param providerConfig - The provider config supplying `adminOnlyScopes` and the profile registry.
 * @returns The union of config-level and profile-level admin-only scopes.
 */
export function adminOnlyScopesForOidcProviderConfig<S extends OidcScope = OidcScope>(providerConfig: OidcAdminOnlyScopesInput<S>): Set<string> {
  return new Set<string>([...(providerConfig.adminOnlyScopes ?? []), ...adminOnlyScopesForOidcProviderProfiles(providerConfig.providerProfiles ?? [])]);
}
