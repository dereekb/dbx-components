import { type FirebaseAuthOwnershipKey, type FirestoreQueryConstraint, where } from '../../common';
import { type OidcEntry } from './oidcmodel';

/**
 * Query for OidcEntry documents with a specific type.
 */
export function oidcEntriesWithTypeQuery(type: string): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type)];
}

/**
 * Query for OidcEntry documents with a specific type and userCode.
 */
export function oidcEntriesByUserCodeQuery(type: string, userCode: string): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type), where<OidcEntry>('userCode', '==', userCode)];
}

/**
 * Query for OidcEntry documents with a specific type and uid.
 */
export function oidcEntriesByUidQuery(type: string, uid: string): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type), where<OidcEntry>('uid', '==', uid)];
}

/**
 * Query for OidcEntry documents with a specific type and grantId.
 */
export function oidcEntriesByGrantIdQuery(type: string, grantId: string): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', type), where<OidcEntry>('grantId', '==', grantId)];
}

/**
 * Query for OidcEntry Client documents owned by a specific user.
 */
export function oidcClientEntriesByOwnerQuery(ownershipKey: FirebaseAuthOwnershipKey): FirestoreQueryConstraint[] {
  return [where<OidcEntry>('type', '==', 'Client'), where<OidcEntry>('o', '==', ownershipKey)];
}
