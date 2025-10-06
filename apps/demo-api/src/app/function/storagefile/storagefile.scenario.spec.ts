import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoStorageFileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { userAvatarUploadsFilePath, userTestFileUploadsFilePath } from 'demo-firebase';
import { StorageFileProcessingState, StoragePath } from '@dereekb/firebase';
import { MimeTypeWithoutParameters } from '@dereekb/util';
import { readFile } from 'fs/promises';
import { assertSnapshotData } from '@dereekb/firebase-server';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('storagefile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    describe('StorageFile', () => {
      demoAuthorizedUserAdminContext({ f }, (au) => {
        describe('uploaded files', () => {
          describe('test file', () => {
            function createTestFileForUser(content: string) {
              return async () => {
                const uid = au.uid;
                const testFileContent = content;

                const filePath = userTestFileUploadsFilePath(uid, 'test.any');
                const testFile = await f.storageContext.file(filePath);
                const testFileStoragePath = testFile.storagePath;

                const contentType = 'text/plain'; // uploaded for the avatar as well for now. Avatar is non-processable so it won't get to processing.
                await testFile.upload(testFileContent, { contentType, stringFormat: 'raw' });

                const result: StoragePath = {
                  bucketId: testFileStoragePath.bucketId,
                  pathString: testFileStoragePath.pathString
                };

                return result;
              };
            }

            it('should initialize an uploaded test file', async () => {
              const uploadedFilePath = await createTestFileForUser('This is a test file.')();

              expect(uploadedFilePath.bucketId).toBeDefined();
              expect(uploadedFilePath.pathString).toBeDefined();

              const uploadedFile = f.storageContext.file(uploadedFilePath);
              const uploadedFileExists = await uploadedFile.exists();

              expect(uploadedFileExists).toBe(true);

              const instance = await f.storageFileActions.initializeAllStorageFilesFromUploads({});
              const result = await instance();

              expect(result.initializationsSuccessCount).toBe(1);
              expect(result.filesVisited).toBe(1);
              expect(result.modelKeys).toHaveLength(1);
            });
          });

          describe('avatar', () => {
            const testAssetsFolderPath = `${__dirname}/../../../test/assets/`;

            function uploadAvatarTestFileForUser(testFileName: string, testFileType: MimeTypeWithoutParameters) {
              return async () => {
                const uid = au.uid;
                const localAvatarFilePath = `${testAssetsFolderPath}${testFileName}`;
                const localAvatarFileBuffer = await readFile(localAvatarFilePath);

                const filePath = userAvatarUploadsFilePath(uid);
                const testFile = f.storageContext.file(filePath);
                const testFileStoragePath = testFile.storagePath;

                await testFile.upload(localAvatarFileBuffer, { contentType: testFileType });

                const result: StoragePath = {
                  bucketId: testFileStoragePath.bucketId,
                  pathString: testFileStoragePath.pathString
                };

                return result;
              };
            }

            it('should initialize an uploaded avatar for a user', async () => {
              // uploaded
              const uploadedFilePath = await uploadAvatarTestFileForUser('avatar.png', 'image/png')();

              expect(uploadedFilePath.bucketId).toBeDefined();
              expect(uploadedFilePath.pathString).toBeDefined();

              const uploadedFile = f.storageContext.file(uploadedFilePath);
              const uploadedFileExists = await uploadedFile.exists();

              expect(uploadedFileExists).toBe(true);

              const instance = await f.storageFileActions.initializeAllStorageFilesFromUploads({});
              const result = await instance();

              expect(result.initializationsSuccessCount).toBe(1);
              expect(result.filesVisited).toBe(1);
              expect(result.modelKeys).toHaveLength(1);
            });

            describe('initialized', () => {
              demoStorageFileContext({ f, createUploadedFile: uploadAvatarTestFileForUser('avatar.png', 'image/png'), processStorageFile: false }, (sf) => {
                it('should not be flagged for processing', async () => {
                  const storageFile = await assertSnapshotData(sf.document);
                  expect(storageFile.ps).toBe(StorageFileProcessingState.DO_NOT_PROCESS);
                });
              });
            });
          });
        });
      });
    });
  });
});
