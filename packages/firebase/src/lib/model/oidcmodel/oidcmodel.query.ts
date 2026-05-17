import { type FirebaseAuthOwnershipKey, type FirebaseAuthUserId, type FirestoreQueryConstraint, where } from '../../common';
import { type OidcEntry, type OidcEntryType } from './oidcmodel';

/**
 * Query for OidcEntry documents with a specific type.
 *
 * @param type - The OIDC entry type to filter by.
 * @returns Firestore query constraints for the given type.
 */
export function oidcEntriesWithTypeQuery(type: OidcEntryType): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type)];
}

/**
 * Query for OidcEntry documents with a specific type and userCode.
 *
 * @param type - The OIDC entry type to filter by.
 * @param userCode - The user code to match.
 * @returns Firestore query constraints for the given type and userCode.
 */
export function oidcEntriesByUserCodeQuery(type: OidcEntryType, userCode: string): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type), where<OidcEntry>('userCode', '==', userCode)];
}

/**
 * Query for OidcEntry documents with a specific type and uid.
 *
 * @param type - The OIDC entry type to filter by.
 * @param uid - The Firebase user ID to match.
 * @returns Firestore query constraints for the given type and uid.
 */
export function oidcEntriesByUidQuery(type: OidcEntryType, uid: FirebaseAuthUserId): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type), where<OidcEntry>('uid', '==', uid)];
}

/**
 * Query for OidcEntry documents with a specific type and grantId.
 *
 * @param type - The OIDC entry type to filter by.
 * @param grantId - The grant ID to match.
 * @returns Firestore query constraints for the given type and grantId.
 */
export function oidcEntriesByGrantIdQuery(type: OidcEntryType, grantId: string): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type), where<OidcEntry>('grantId', '==', grantId)];
}

/**
 * Query for OidcEntry documents with a specific type and clientId.
 *
 * @param type - The OIDC entry type to filter by.
 * @param clientId - The OAuth client ID to match.
 * @returns Firestore query constraints for the given type and clientId.
 */
export function oidcEntriesByClientIdQuery(type: OidcEntryType, clientId: string): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type), where<OidcEntry>('clientId', '==', clientId)];
}

/**
 * Query for OidcEntry Client documents owned by a specific user.
 *
 * @param ownershipKey - The ownership key identifying the owner.
 * @returns Firestore query constraints for Client entries matching the ownership key.
 */
export function oidcClientEntriesByOwnerQuery(ownershipKey: FirebaseAuthOwnershipKey): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', 'Client'), where<OidcEntry>('o', '==', ownershipKey)];
}

/**
 * Query for OidcEntry Grant documents issued to a specific user.
 *
 * Used by the "apps with access to my account" UI to list every outstanding
 * grant the signed-in user has authorized.
 *
 * @param uid - The Firebase user id the grants were issued to.
 * @returns Firestore query constraints for Grant entries matching the uid.
 */
export function oidcGrantEntriesByUidQuery(uid: FirebaseAuthUserId): FirestoreQueryConstraint[] {
  return oidcEntriesByUidQuery('Grant', uid);
}
