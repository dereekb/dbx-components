import { MockItemStorageFixture } from '../mock/mock.item.storage.fixture';
import { itShouldFail, expectFail } from '@dereekb/util/test';
import { firstValueFrom } from 'rxjs';
import { SubscriptionObject } from '@dereekb/rxjs';
import { Transaction, DocumentReference, WriteBatch, FirestoreDocumentAccessor, makeDocuments, FirestoreDocumentDataAccessor, FirestoreContext, FirestoreDocument, RunTransaction, FirebaseAuthUserId, DocumentSnapshot, FirestoreDataConverter, FirebaseStorageAccessorFile } from '@dereekb/firebase';
import { TestFirebaseStorageInstance } from './storage.instance';
import { MockItemCollectionFixture } from '../mock/mock.item.collection.fixture';

/**
 * Describes accessor driver tests, using a MockItemCollectionFixture.
 *
 * @param f
 */
export function describeFirebaseStorageAccessorDriverTests(f: MockItemStorageFixture) {
  describe('FirebaseStorageAccessor', () => {
    describe('file', () => {
      const doesNotExistFilePath = 'test.png';
      let doesNotExistFile: FirebaseStorageAccessorFile;

      const existsFilePath = 'exists.txt';
      let file: FirebaseStorageAccessorFile;

      beforeEach(async () => {
        doesNotExistFile = f.storageContext.file(doesNotExistFilePath);
        file = f.storageContext.file(existsFilePath);
        await file.upload('hello world', { stringFormat: 'raw', contentType: 'text/plain' });
      });

      describe('upload', () => {
        let uploadFile: FirebaseStorageAccessorFile;

        beforeEach(() => {
          uploadFile = f.storageContext.file('upload.txt');
        });

        it('should upload a file.', async () => {
          const contentType = 'text/plain';
          await uploadFile.upload('test', { stringFormat: 'raw', contentType });

          const metadata = await uploadFile.getMetadata();
          expect(metadata.contentType).toBe(contentType);
        });
      });

      describe('getMetadata()', () => {
        itShouldFail('if the file does not exist.', async () => {
          await expectFail(() => doesNotExistFile.getMetadata());
        });

        it('should return the metadata.', async () => {
          const result = await file.getMetadata();
          expect(result).toBeDefined();
        });
      });

      describe('getDownloadUrl()', () => {
        itShouldFail('if the file does not exist.', async () => {
          await expectFail(() => doesNotExistFile.getDownloadUrl());
        });

        it('should return the download url.', async () => {
          const result = await file.getDownloadUrl();
          expect(result).toBeDefined();
          expect(typeof result).toBe('string');
        });
      });
    });

    it('test todo', () => {
      expect(true).toBe(true);
    });
  });
}
