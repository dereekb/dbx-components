import { type FirestoreQueryConstraint, where } from '../../common';
import { type OidcAdapterEntry } from './adapter';

/**
 * Query for OidcAdapterEntry documents with a specific type.
 */
export function oidcAdapterEntriesWithTypeQuery(type: string): FirestoreQueryConstraint[] {
  return [where<OidcAdapterEntry>('type', '==', type)];
}

/**
 * Query for OidcAdapterEntry documents with a specific type and userCode.
 */
export function oidcAdapterEntriesByUserCodeQuery(type: string, userCode: string): FirestoreQueryConstraint[] {
  return [where<OidcAdapterEntry>('type', '==', type), where<OidcAdapterEntry>('userCode', '==', userCode)];
}

/**
 * Query for OidcAdapterEntry documents with a specific type and uid.
 */
export function oidcAdapterEntriesByUidQuery(type: string, uid: string): FirestoreQueryConstraint[] {
  return [where<OidcAdapterEntry>('type', '==', type), where<OidcAdapterEntry>('uid', '==', uid)];
}

/**
 * Query for OidcAdapterEntry documents with a specific type and grantId.
 */
export function oidcAdapterEntriesByGrantIdQuery(type: string, grantId: string): FirestoreQueryConstraint[] {
  return [where<OidcAdapterEntry>('type', '==', type), where<OidcAdapterEntry>('grantId', '==', grantId)];
}

/**
 * Query for OidcAdapterEntry Client documents owned by a specific user.
 */
export function oidcAdapterClientEntriesByOwnerQuery(ownershipKey: string): FirestoreQueryConstraint[] {
  return [where<OidcAdapterEntry>('type', '==', 'Client'), where<OidcAdapterEntry>('o', '==', ownershipKey)];
}
