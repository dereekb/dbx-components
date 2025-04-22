import { type MockItem } from './mock.item';
import { where, type FirestoreQueryConstraint, type DocumentReference, allChildDocumentsUnderParent } from '@dereekb/firebase';

export function mockItemWithValue(value: string): FirestoreQueryConstraint {
  return where<MockItem>('value', '==', value);
}

export function mockItemWithTestValue(test: boolean): FirestoreQueryConstraint {
  return where('test', '==', test);
}

/**
 * This sorts all fields by their document ID, then filters in between two specific document id paths in order to only return values between a specific path.
 *
 * Visual Example:
 *
 * /a/b/c/c/a
 * /a/b/c/d/A
 * /a/b/c/d/B
 * /a/b/c/d/C
 * /a/b/c/e/a
 *
 * From:
 * https://medium.com/firebase-developers/how-to-query-collections-in-firestore-under-a-certain-path-6a0d686cebd2
 *
 * @param parent
 * @returns
 */
export function allChildMockItemSubItemDeepsWithinMockItem(mockItem: DocumentReference<MockItem>): FirestoreQueryConstraint[] {
  return allChildDocumentsUnderParent(mockItem);
}
