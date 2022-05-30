import { DocumentReference } from '../types';
import { endAtValue, FirestoreQueryConstraint, orderByDocumentId, startAtValue } from './constraint';

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
 * Use with a CollectionGroup query to return all child documents that are under a given path.
 *
 * @param parentPath
 * @returns
 */
export function allChildDocumentsUnderParentPath(parentPath: string): FirestoreQueryConstraint[] {
  // https://medium.com/firebase-developers/how-to-query-collections-in-firestore-under-a-certain-path-6a0d686cebd2
  return [orderByDocumentId(), startAtValue(parentPath), endAtValue(parentPath + '\uf8ff')];
}
