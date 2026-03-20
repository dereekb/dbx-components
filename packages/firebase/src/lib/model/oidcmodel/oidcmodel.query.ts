import { type FirebaseAuthOwnershipKey, type FirebaseAuthUserId, type FirestoreQueryConstraint, where } from '../../common';
import { type OidcEntry, type OidcEntryType } from './oidcmodel';

/**
 * Query for OidcEntry documents with a specific type.
 *
 * @param type - the OIDC entry type to filter by
 * @returns Firestore query constraints for the given type
 */
export function oidcEntriesWithTypeQuery(type: OidcEntryType): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type)];
}

/**
 * Query for OidcEntry documents with a specific type and userCode.
 *
 * @param type - the OIDC entry type to filter by
 * @param userCode - the user code to match
 * @returns Firestore query constraints for the given type and userCode
 */
export function oidcEntriesByUserCodeQuery(type: OidcEntryType, userCode: string): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type), where<OidcEntry>('userCode', '==', userCode)];
}

/**
 * Query for OidcEntry documents with a specific type and uid.
 *
 * @param type - the OIDC entry type to filter by
 * @param uid - the Firebase user ID to match
 * @returns Firestore query constraints for the given type and uid
 */
export function oidcEntriesByUidQuery(type: OidcEntryType, uid: FirebaseAuthUserId): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type), where<OidcEntry>('uid', '==', uid)];
}

/**
 * Query for OidcEntry documents with a specific type and grantId.
 *
 * @param type - the OIDC entry type to filter by
 * @param grantId - the grant ID to match
 * @returns Firestore query constraints for the given type and grantId
 */
export function oidcEntriesByGrantIdQuery(type: OidcEntryType, grantId: string): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type), where<OidcEntry>('grantId', '==', grantId)];
}

/**
 * Query for OidcEntry Client documents owned by a specific user.
 *
 * @param ownershipKey - the ownership key identifying the owner
 * @returns Firestore query constraints for Client entries matching the ownership key
 */
export function oidcClientEntriesByOwnerQuery(ownershipKey: FirebaseAuthOwnershipKey): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', 'Client'), where<OidcEntry>('o', '==', ownershipKey)];
}
