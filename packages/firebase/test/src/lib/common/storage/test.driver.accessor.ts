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
    const testFilePath = 'test.png';

    describe('file', () => {
      const existsFilePath = 'exists.txt';

      beforeEach(() => {
        // todo: it should create a new file...
      });

      describe('getDownloadUrl()', () => {
        itShouldFail('if the file does not exist.', async () => {
          await expectFail(() => f.storageContext.file(testFilePath).getDownloadUrl());
        });

        //todo...

        describe.skip('exists', () => {
          it('should return the download url.', async () => {
            const result = await f.storageContext.file(testFilePath).getDownloadUrl();
            expect(result).toBeDefined();
          });
        });
      });
    });

    it('test todo', () => {
      expect(true).toBe(true);
    });
  });
}
