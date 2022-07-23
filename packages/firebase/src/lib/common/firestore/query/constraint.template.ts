import { Maybe, UTF_8_START_CHARACTER, UTF_PRIVATE_USAGE_AREA_START } from '@dereekb/util';
import { DocumentReference } from '../types';
import { endAtValue, FirestoreQueryConstraint, orderByDocumentId, startAtValue, orderBy, OrderByDirection } from './constraint';

/**
 * Use with a CollectionGroup query to return all child documents that are under a given parent.
 *
 * @param parentRef U
 * @returns
 */
export function allChildDocumentsUnderParent<P>(parentRef: DocumentReference<P>): FirestoreQueryConstraint[] {
  return allChildDocumentsUnderParentPath(parentRef.path);
}

/**
 * Use with a CollectionGroup query to return all child documents that have a given path.
 *
 * @param parentPath
 * @returns
 */
export function allChildDocumentsUnderParentPath(parentPath: string): FirestoreQueryConstraint[] {
  // https://medium.com/firebase-developers/how-to-query-collections-in-firestore-under-a-certain-path-6a0d686cebd2
  // https://medium.com/firelayer/save-money-on-the-list-query-in-firestore-26ef9bee5474 for restricting
  return [orderByDocumentId(), startAtValue(parentPath), endAtValue(parentPath + UTF_8_START_CHARACTER)];
}

/**
 * Use with a CollectionGroup query to return all child documents that are under a given path based on values in a field.
 *
 * For example, if each value has a field that references another object with a parent, you can filter on that parent's value range, or parents of that value in order to return
 * all jobs for that range.
 *
 * Example:
 * - objects with path "rc/aaa/rcs/bbb" and "rc/aaa/rcs/ccc" will be returned when querying for "rc/aaa".
 *
 * @param parentValue
 * @returns
 */
export function allChildDocumentsUnderRelativePath(orderByField: string, parentValue: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return [orderBy(orderByField, sortDirection), startAtValue(parentValue), endAtValue(parentValue + UTF_PRIVATE_USAGE_AREA_START)];
}
