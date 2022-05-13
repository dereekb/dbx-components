import { MockItem } from './firestore.mock.item';
import { where, FirestoreQueryConstraint } from '@dereekb/firebase';

export function mockItemWithValue(value: string): FirestoreQueryConstraint {
  return where<MockItem>('value', '==', value);
}

export function mockItemWithTestValue(test: boolean): FirestoreQueryConstraint {
  return where('test', '==', test);
}
