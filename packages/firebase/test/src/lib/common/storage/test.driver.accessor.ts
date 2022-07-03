import { MockItemStorageFixture } from '../mock/mock.item.storage.fixture';
import { itShouldFail, expectFail } from '@dereekb/util/test';
import { readableStreamToBuffer, useCallback } from '@dereekb/util';
import { FirebaseStorageAccessorFile, StorageRawDataString } from '@dereekb/firebase';

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
      const existsFileContent = 'hello world';
      let file: FirebaseStorageAccessorFile;

      beforeEach(async () => {
        doesNotExistFile = f.storageContext.file(doesNotExistFilePath);
        file = f.storageContext.file(existsFilePath);
        await file.upload(existsFileContent, { stringFormat: 'raw', contentType: 'text/plain' });
      });

      describe('uploading data', () => {
        let uploadFile: FirebaseStorageAccessorFile;

        beforeEach(() => {
          uploadFile = f.storageContext.file('upload.txt');
        });

        describe('upload()', () => {
          it('should upload a raw string.', async () => {
            const contentType = 'text/plain';
            const data: StorageRawDataString = existsFileContent;
            await uploadFile.upload(data, { stringFormat: 'raw', contentType });

            const metadata = await uploadFile.getMetadata();
            expect(metadata.contentType).toBe(contentType);

            const result = await uploadFile.getBytes();
            expect(result).toBeDefined();

            const decoded = Buffer.from(result).toString('utf-8');
            expect(decoded).toBe(data);
          });

          // TODO: Test uploading other types.
        });

        describe('uploadStream()', () => {
          it('should upload using a WritableStream', async () => {
            if (uploadFile.uploadStream != null) {
              const contentType = 'text/plain';
              const data: StorageRawDataString = existsFileContent;
              const stream = uploadFile.uploadStream();

              await useCallback((cb) => stream.write(data, 'utf-8', cb));
              await useCallback((cb) => stream.end(cb));

              const metadata = await uploadFile.getMetadata();
              expect(metadata.contentType).toBe(contentType);

              const result = await uploadFile.getBytes();
              expect(result).toBeDefined();

              const decoded = Buffer.from(result).toString('utf-8');
              expect(decoded).toBe(data);
            }
          });
        });
      });

      describe('exists()', () => {
        it('should return true if the file exists.', async () => {
          const result = await file.exists();
          expect(result).toBe(true);
        });

        it('should return false if the file exists.', async () => {
          const result = await doesNotExistFile.exists();
          expect(result).toBe(false);
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

      describe('getBytes()', () => {
        itShouldFail('if the file does not exist.', async () => {
          await expectFail(() => doesNotExistFile.getBytes());
        });

        it('should download the file.', async () => {
          const result = await file.getBytes();
          expect(result).toBeDefined();

          const decoded = Buffer.from(result).toString('utf-8');
          expect(decoded).toBe(existsFileContent);
        });

        describe('with maxDownloadSizeBytes configuration', () => {
          it('should download up to the maxDownloadSizeBytes number of bytes', async () => {
            const charactersToTake = 5;
            const result = await file.getBytes(charactersToTake); // each normal utf-8 character is 1 byte
            expect(result).toBeDefined();

            const decoded = Buffer.from(result).toString('utf-8');
            expect(decoded).toBe(existsFileContent.substring(0, charactersToTake));
          });
        });
      });

      describe('getStream()', () => {
        it('should download the file.', async () => {
          if (file.getStream != null) {
            // only test if the driver/file has getStream available
            const stream = file.getStream();
            expect(stream).toBeDefined();

            const buffer = await readableStreamToBuffer(stream);

            const decoded = buffer.toString('utf-8');
            expect(decoded).toBe(existsFileContent);
          }
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
  });
}
