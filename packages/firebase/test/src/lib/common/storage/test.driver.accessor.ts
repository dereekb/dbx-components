import { MockItemStorageFixture } from '../mock/mock.item.storage.fixture';
import { itShouldFail, expectFail } from '@dereekb/util/test';
import { firstValueFrom } from 'rxjs';
import { SubscriptionObject } from '@dereekb/rxjs';
import { Transaction, DocumentReference, WriteBatch, FirestoreDocumentAccessor, makeDocuments, FirestoreDocumentDataAccessor, FirestoreContext, FirestoreDocument, RunTransaction, FirebaseAuthUserId, DocumentSnapshot, FirestoreDataConverter } from '@dereekb/firebase';
import { TestFirebaseStorageInstance } from './storage.instance';
import { MockItemCollectionFixture } from '../mock/mock.item.collection.fixture';

/**
 * Describes accessor driver tests, using a MockItemCollectionFixture.
 *
 * @param f
 */
export function describeFirebaseStorageAccessorDriverTests(f: MockItemStorageFixture) {
  describe('FirebaseStorageAccessor', () => {
    it('test todo', () => {
      expect(true).toBe(true);
    });
  });
}
