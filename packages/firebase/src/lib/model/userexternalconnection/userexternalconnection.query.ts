import { type FirestoreQueryConstraint, where } from '../../common';
import { type UserExternalConnection } from './userexternalconnection';
import { userExternalConnectionExternalAccountKey, type UserExternalConnectionExternalAccountKeyInput, type UserExternalConnectionProviderType } from './userexternalconnection.id';

/**
 * Query for the UserExternalConnection documents that are currently connected to the given provider.
 *
 * This is the single reason the derived `c` array exists: with one document per user, provider ids
 * are map keys, and Firestore cannot query across map keys.
 *
 * Only `connected` entries are members of `c`, so this never returns a user whose credentials are in
 * the `error` or `disconnected` state.
 *
 * @param providerType - The provider type to search for.
 * @returns Firestore query constraints matching users connected to that provider.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel UserExternalConnection
 * @dbxModelFirebaseIndexScope COLLECTION
 */
export function userExternalConnectionsWithConnectedProviderQuery(providerType: UserExternalConnectionProviderType): FirestoreQueryConstraint[] {
  return [where<UserExternalConnection>('c', 'array-contains', providerType)];
}

/**
 * Query for the UserExternalConnection document holding the given third-party account.
 *
 * The sign-in counterpart of {@link userExternalConnectionsWithConnectedProviderQuery}: that one
 * asks "which users are connected to this provider?", this one asks "which user IS this account?".
 * Both exist because a per-user document makes `e.<provider>.ea` unqueryable.
 *
 * Matches at ANY entry status — see the `ec` field docs. Expect at most one result when the
 * provider's policy declares the connection unique, but the caller must still handle more than one:
 * uniqueness is enforced at write time and a provider may only have started enforcing it recently.
 *
 * @param input - The provider type and external account id to search for.
 * @param input.providerType - The provider the account belongs to.
 * @param input.externalAccountId - The provider's stable id for the account.
 * @returns Firestore query constraints matching the user holding that external account.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel UserExternalConnection
 * @dbxModelFirebaseIndexScope COLLECTION
 */
export function userExternalConnectionsWithExternalAccountQuery(input: UserExternalConnectionExternalAccountKeyInput): FirestoreQueryConstraint[] {
  return [where<UserExternalConnection>('ec', 'array-contains', userExternalConnectionExternalAccountKey(input))];
}
