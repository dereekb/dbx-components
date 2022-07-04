import { MockItemStorageFixture } from '../mock/mock.item.storage.fixture';
import { itShouldFail, expectFail } from '@dereekb/util/test';
import { readableStreamToBuffer, SlashPathFolder, useCallback } from '@dereekb/util';
import { FirebaseStorageAccessorFile, StorageRawDataString, StorageBase64DataString, FirebaseStorageAccessorFolder } from '@dereekb/firebase';

/**
 * Describes accessor driver tests, using a MockItemCollectionFixture.
 *
 * @param f
 */
export function describeFirebaseStorageAccessorDriverTests(f: MockItemStorageFixture) {
  describe('FirebaseStorageAccessor', () => {
    describe('file()', () => {
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

    describe('folder()', () => {
      const doesNotExistFolderPath: SlashPathFolder = '/doesnotexist/';
      let doesNotExistFolder: FirebaseStorageAccessorFolder;

      const existsFolderPath = '/test/two/';
      let existsFolder: FirebaseStorageAccessorFolder;

      const existsFileName = 'exists.txt';
      const existsFilePath = existsFolderPath + existsFileName;

      const existsFileContent = 'Hello! \ud83d\ude0a';
      let existsFile: FirebaseStorageAccessorFile;

      beforeEach(async () => {
        doesNotExistFolder = f.storageContext.folder(doesNotExistFolderPath);
        existsFolder = f.storageContext.folder(existsFolderPath);
        existsFile = f.storageContext.file(existsFilePath);
        await existsFile.upload(existsFileContent, { stringFormat: 'raw', contentType: 'text/plain' });
      });

      describe('exists', () => {
        it('should return false if there are no items in the folder.', async () => {
          const exists = await doesNotExistFolder.exists();
          expect(exists).toBe(false);
        });

        it('should return true if there are items in the folder.', async () => {
          const exists = await existsFolder.exists();
          expect(exists).toBe(true);
        });
      });

      describe('list', () => {
        const existsBFileName = 'a.txt';
        const existsBFilePath = existsFolderPath + existsBFileName;

        const existsCFolderPath = existsFolderPath + 'c/';
        const existsCFilePath = existsCFolderPath + 'c.txt';

        const otherFolderPath = '/other/';
        const otherFolderFilePath = otherFolderPath + 'other.txt';

        beforeEach(async () => {
          await f.storageContext.file(existsBFilePath).upload(existsFileContent, { stringFormat: 'raw', contentType: 'text/plain' });
          await f.storageContext.file(existsCFilePath).upload(existsFileContent, { stringFormat: 'raw', contentType: 'text/plain' });
          await f.storageContext.file(otherFolderFilePath).upload(existsFileContent, { stringFormat: 'raw', contentType: 'text/plain' });
        });

        describe('file()', () => {
          it('should return the file for the result.', async () => {
            const result = await existsFolder.list();
            expect(result).toBeDefined();

            const files = result.files();
            const fileResult = files.find((x) => x.name === existsFileName);

            const file = fileResult!.file();

            const exists = await file.exists();
            expect(exists).toBe(true);
          });
        });

        describe('folder()', () => {
          it('should return the folder for the result.', async () => {
            const rootFolder = await f.storageContext.folder('/');

            const result = await rootFolder.list();
            expect(result).toBeDefined();

            const folders = result.folders();
            const folderResult = folders.find((x) => x.name === 'test');

            const folder = folderResult!.folder();

            const exists = await folder.exists();
            expect(exists).toBe(true);
          });
        });

        describe('next()', () => {
          it('should return the next set of results.', async () => {
            const maxResults = 1;
            const rootFolder = await f.storageContext.folder(existsFolderPath);

            const result = await rootFolder.list({ maxResults });
            expect(result).toBeDefined();

            const files = result.files();
            expect(files.length).toBe(maxResults);

            const next = await result.next();
            expect(next).toBeDefined();

            const nextFiles = next.files();
            expect(nextFiles.length).toBe(maxResults);
            expect(nextFiles[0].storagePath.pathString).not.toBe(files[0].storagePath.pathString);

            expect(next.hasNext).toBe(false);
          });

          itShouldFail('if next() is called and hasNext was false.', async () => {
            const rootFolder = await f.storageContext.folder(existsFolderPath);
            const result = await rootFolder.list({});

            expect(result.hasNext).toBe(false);

            await expectFail(() => result.next());
          });
        });

        it('should list all the direct files and folders that exist on the test path.', async () => {
          const result = await existsFolder.list();
          expect(result).toBeDefined();

          const files = result.files();
          expect(files.length).toBe(2);

          const fileNames = new Set(files.map((x) => x.name));
          expect(fileNames).toContain(existsFileName);
          expect(fileNames).toContain(existsBFileName);

          const folders = result.folders();
          expect(folders.length).toBe(1);

          const folderNames = new Set(folders.map((x) => x.name));
          expect(folderNames).toContain('c');
        });

        it('should list all the direct folders that exist at the root.', async () => {
          const rootFolder = await f.storageContext.folder('/');

          const result = await rootFolder.list();
          expect(result).toBeDefined();

          const files = result.files();
          expect(files.length).toBe(0); // files are under /test/ and /other/

          const folders = result.folders();
          expect(folders.length).toBe(2);

          const names = new Set(folders.map((x) => x.name));

          expect(names).toContain('test');
          expect(names).toContain('other');
        });

        describe('maxResults', () => {
          it('should respect the max results.', async () => {
            const maxResults = 1;
            const rootFolder = await f.storageContext.folder(existsFolderPath);

            const result = await rootFolder.list({ maxResults });
            expect(result).toBeDefined();

            const files = result.files();
            expect(files.length).toBe(maxResults);

            const folders = result.folders();
            expect(folders.length).toBe(1);

            const names = new Set(folders.map((x) => x.name));
            expect(names).toContain('c');
          });

          it('prefixes/folders are unaffected by maxResults.', async () => {
            const maxResults = 1;
            const rootFolder = await f.storageContext.folder('/');

            const result = await rootFolder.list({ maxResults });
            expect(result).toBeDefined();

            const files = result.files();
            expect(files.length).toBe(0); // files are under /test/ and /other/

            const folders = result.folders();
            expect(folders.length).toBe(2);

            const names = new Set(folders.map((x) => x.name));

            expect(names).toContain('test');
            expect(names).toContain('other');
          });
        });
      });
    });
  });
}
