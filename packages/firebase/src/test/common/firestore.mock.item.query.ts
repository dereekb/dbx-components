import { MockItem } from './firestore.mock.item';
import { where, FirestoreQueryConstraint } from '../../lib/common/firestore/query/constraint';

export function mockItemWithValue(value: string): FirestoreQueryConstraint {
  return where<MockItem>('value', '==', value);
}

export function mockItemWithTestValue(test: boolean): FirestoreQueryConstraint {
  return where('test', '==', test);
}
