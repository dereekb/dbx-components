import { type MockItem } from './mock.item';
import { where, type FirestoreQueryConstraint, type DocumentReference, allChildDocumentsUnderParent } from '@dereekb/firebase';

/**
 * Creates a Firestore query constraint that filters {@link MockItem} documents by their `value` field.
 *
 * @param value - The exact `value` to match.
 * @returns A `where('value', '==', value)` constraint typed for {@link MockItem}.
 *
 * @example
 * ```ts
 * const constraint = mockItemWithValue('hello');
 * const results = await collection.query(constraint);
 * ```
 */
export function mockItemWithValue(value: string): FirestoreQueryConstraint {
  return where<MockItem>('value', '==', value);
}

/**
 * Creates a Firestore query constraint that filters {@link MockItem} documents by their `test` boolean field.
 *
 * @param test - The boolean value of the `test` field to match.
 * @returns A `where('test', '==', test)` constraint.
 */
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
 * @param mockItem - The parent {@link MockItem} document reference whose descendant documents the constraint should bound to.
 * @returns An array of constraints (suitable for use on a collection group query) that restricts results to documents under the given parent path.
 */
export function allChildMockItemSubItemDeepsWithinMockItem(mockItem: DocumentReference<MockItem>): FirestoreQueryConstraint[] {
  return allChildDocumentsUnderParent(mockItem);
}
