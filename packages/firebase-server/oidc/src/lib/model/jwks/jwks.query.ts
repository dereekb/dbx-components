import { type FirestoreQueryConstraint, where } from '@dereekb/firebase';
import { type JwksKey, type JwksKeyStatus } from './jwks';

/**
 * Query for JwksKey documents with a specific status.
 *
 * @param status - The lifecycle status to filter by.
 * @returns Firestore query constraints filtering by the given status.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel JwksKey
 */
export function jwksKeysWithStatusQuery(status: JwksKeyStatus): FirestoreQueryConstraint[] {
  return [where<JwksKey>('status', '==', status)];
}

/**
 * Query for active JwksKey documents.
 *
 * @returns Firestore query constraints filtering for active keys.
 */
export function activeJwksKeysQuery(): FirestoreQueryConstraint[] {
  return jwksKeysWithStatusQuery('active');
}

/**
 * Query for non-retired JwksKey documents (active + rotated).
 *
 * @returns Firestore query constraints filtering for non-retired keys.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel JwksKey
 */
export function nonRetiredJwksKeysQuery(): FirestoreQueryConstraint[] {
  return [where<JwksKey>('status', 'in', ['active', 'rotated'])];
}

/**
 * Query for rotated JwksKey documents.
 *
 * @returns Firestore query constraints filtering for rotated keys.
 */
export function rotatedJwksKeysQuery(): FirestoreQueryConstraint[] {
  return jwksKeysWithStatusQuery('rotated');
}
