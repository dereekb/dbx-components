import { MockItemStorageFixture } from '../mock/mock.item.storage.fixture';
import { itShouldFail, expectFail } from '@dereekb/util/test';
import { readableStreamToBuffer, useCallback } from '@dereekb/util';
import { FirebaseStorageAccessorFile, StorageRawDataString, StorageBase64DataString } from '@dereekb/firebase';

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
      const existsFileContent = 'Hello! \ud83d\ude0a';
      let existsFile: FirebaseStorageAccessorFile;

      beforeEach(async () => {
        doesNotExistFile = f.storageContext.file(doesNotExistFilePath);
        existsFile = f.storageContext.file(existsFilePath);
        await existsFile.upload(existsFileContent, { stringFormat: 'raw', contentType: 'text/plain' });
      });

      describe('uploading', () => {
        let uploadFile: FirebaseStorageAccessorFile;

        beforeEach(() => {
          uploadFile = f.storageContext.file('upload.txt');
        });

        describe('upload()', () => {
          describe('string types', () => {
            itShouldFail('if stringFormat is not defined in the options', async () => {
              const contentType = 'text/plain';
              const data: StorageRawDataString = existsFileContent;
              await expectFail(() => uploadFile.upload(data, { contentType }));
            });

            it('should upload a raw UTF-16 string.', async () => {
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

            it('should upload a base64 string.', async () => {
              const bytes = await existsFile.getBytes();
              const data: StorageBase64DataString = Buffer.from(bytes).toString('base64');

              const contentType = 'text/plain';
              await uploadFile.upload(data, { stringFormat: 'base64', contentType });

              const metadata = await uploadFile.getMetadata();
              expect(metadata.contentType).toBe(contentType);

              const result = await uploadFile.getBytes();
              expect(result).toBeDefined();

              const decoded = Buffer.from(result).toString('utf-8');
              expect(decoded).toBe(existsFileContent);
            });

            it('should upload a base64url string.', async () => {
              const bytes = await existsFile.getBytes();
              const data: StorageBase64DataString = Buffer.from(bytes).toString('base64url');

              const contentType = 'text/plain';
              await uploadFile.upload(data, { stringFormat: 'base64url', contentType });

              const metadata = await uploadFile.getMetadata();
              expect(metadata.contentType).toBe(contentType);

              const result = await uploadFile.getBytes();
              expect(result).toBeDefined();

              const decoded = Buffer.from(result).toString('utf-8');
              expect(decoded).toBe(existsFileContent);
            });
          });

          describe('data types', () => {
            // NOTE: We can really only test how a NodeJS environment will behave here.

            it('should upload a Uint8Array', async () => {
              const dataBuffer = Buffer.from(existsFileContent, 'utf-8');
              const data = new Uint8Array(dataBuffer);

              const contentType = 'text/plain';
              await uploadFile.upload(data, { contentType });

              const metadata = await uploadFile.getMetadata();
              expect(metadata.contentType).toBe(contentType);
            });

            it('should upload a Buffer', async () => {
              const buffer = Buffer.from(existsFileContent, 'utf-8');

              const contentType = 'text/plain';
              await uploadFile.upload(buffer, { contentType });

              const metadata = await uploadFile.getMetadata();
              expect(metadata.contentType).toBe(contentType);
            });

            it('should upload a Blob', async () => {
              const buffer = Buffer.from(existsFileContent, 'utf-8');
              const data = new Uint8Array(buffer);
              const blob = data.buffer; // blob-like

              const contentType = 'text/plain';
              await uploadFile.upload(blob as any, { contentType });

              const metadata = await uploadFile.getMetadata();
              expect(metadata.contentType).toBe(contentType);
            });

            // NOTE: File extends Blob, so above test should cover it ok.
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
          const result = await existsFile.exists();
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
          const result = await existsFile.getMetadata();
          expect(result).toBeDefined();
        });
      });

      describe('getBytes()', () => {
        itShouldFail('if the file does not exist.', async () => {
          await expectFail(() => doesNotExistFile.getBytes());
        });

        it('should download the file.', async () => {
          const result = await existsFile.getBytes();
          expect(result).toBeDefined();

          const decoded = Buffer.from(result).toString('utf-8');
          expect(decoded).toBe(existsFileContent);
        });

        describe('with maxDownloadSizeBytes configuration', () => {
          it('should download up to the maxDownloadSizeBytes number of bytes', async () => {
            const charactersToTake = 5;
            const result = await existsFile.getBytes(charactersToTake); // each normal utf-8 character is 1 byte
            expect(result).toBeDefined();

            const decoded = Buffer.from(result).toString('utf-8');
            expect(decoded).toBe(existsFileContent.substring(0, charactersToTake));
          });
        });
      });

      describe('getStream()', () => {
        it('should download the file.', async () => {
          if (existsFile.getStream != null) {
            // only test if the driver/file has getStream available
            const stream = existsFile.getStream();
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
          const result = await existsFile.getDownloadUrl();
          expect(result).toBeDefined();
          expect(typeof result).toBe('string');
        });
      });

      describe('delete()', () => {
        itShouldFail('if the file does not exist.', async () => {
          await expectFail(() => doesNotExistFile.delete());
        });

        it('should delete the file at the path.', async () => {
          await existsFile.delete();

          const result = await existsFile.exists();
          expect(result).toBe(false);
        });

        describe('ignoreNotFound=true', () => {
          it('should not throw an error if the file does not exist.', async () => {
            await doesNotExistFile.delete({ ignoreNotFound: true });
          });
        });
      });
    });
  });
}
