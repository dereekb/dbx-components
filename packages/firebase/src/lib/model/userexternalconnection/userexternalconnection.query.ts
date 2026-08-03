import { type FirestoreQueryConstraint, where } from '../../common';
import { type UserExternalConnection } from './userexternalconnection';
import { type UserExternalConnectionProviderType } from './userexternalconnection.id';

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
