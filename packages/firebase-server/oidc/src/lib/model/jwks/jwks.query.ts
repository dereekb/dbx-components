import { type FirestoreQueryConstraint, where } from '@dereekb/firebase';
import { type JwksKey, type JwksKeyStatus } from './jwks';

/**
 * Query for JwksKey documents with a specific status.
 */
export function jwksKeysWithStatusQuery(status: JwksKeyStatus): FirestoreQueryConstraint[] {
  return [where<JwksKey>('status', '==', status)];
}

/**
 * Query for active JwksKey documents.
 */
export function activeJwksKeysQuery(): FirestoreQueryConstraint[] {
  return jwksKeysWithStatusQuery('active');
}

/**
 * Query for non-retired JwksKey documents (active + rotated).
 */
export function nonRetiredJwksKeysQuery(): FirestoreQueryConstraint[] {
  return [where<JwksKey>('status', 'in', ['active', 'rotated'])];
}

/**
 * Query for rotated JwksKey documents.
 */
export function rotatedJwksKeysQuery(): FirestoreQueryConstraint[] {
  return jwksKeysWithStatusQuery('rotated');
}
