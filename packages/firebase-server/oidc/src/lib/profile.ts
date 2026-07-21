import { type OidcProviderProfile, oidcProviderProfilesForKeys, requiredScopesForOidcProviderProfiles, scopesForOidcProviderProfiles, type OidcScope, type OidcProviderProfileKey } from '@dereekb/firebase';

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
 * @param providerProfiles - The provider-profile registry (from {@link OidcProviderConfig.providerProfiles}).
 * @param clientProfileKeys - The profile keys assigned to the client (its `dbx_provider_profiles`).
 * @returns The unlocked and required scope sets for the client.
 */
export function oidcClientProviderProfileScopes<S extends OidcScope = OidcScope>(providerProfiles: readonly OidcProviderProfile<S>[] | undefined, clientProfileKeys: readonly OidcProviderProfileKey[] | undefined): OidcClientProviderProfileScopes<S> {
  const clientProfiles = oidcProviderProfilesForKeys(providerProfiles ?? [], clientProfileKeys);
  return {
    unlocked: scopesForOidcProviderProfiles(clientProfiles),
    required: requiredScopesForOidcProviderProfiles(clientProfiles)
  };
}
