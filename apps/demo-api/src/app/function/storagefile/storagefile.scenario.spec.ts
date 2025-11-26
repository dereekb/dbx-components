import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoProfileContext, demoStorageFileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { USER_AVATAR_IMAGE_HEIGHT, USER_AVATAR_IMAGE_WIDTH, userAvatarUploadsFilePath, userTestFileUploadsFilePath } from 'demo-firebase';
import { type InitializeStorageFileFromUploadParams, onCallCreateModelParams, type OnCallCreateModelResult, storageFileIdentity, StorageFileProcessingState, StorageFileState, type StoragePath } from '@dereekb/firebase';
import { type MimeTypeWithoutParameters } from '@dereekb/util';
import { readFile } from 'fs/promises';
import { assertSnapshotData } from '@dereekb/firebase-server';
import * as sharp from 'sharp';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('storagefile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserAdminContext({ f }, (au) => {
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

      describe('StorageFile', () => {
        describe('uploaded files', () => {
          describe('test file', () => {
            it('should initialize an uploaded test file', async () => {
              const uploadedFilePath = await createTestFileForUser('This is a test file.')();

              expect(uploadedFilePath.bucketId).toBeDefined();
              expect(uploadedFilePath.pathString).toBeDefined();

              const uploadedFile = f.storageContext.file(uploadedFilePath);
              const uploadedFileExists = await uploadedFile.exists();

              expect(uploadedFileExists).toBe(true);

              const instance = await f.storageFileServerActions.initializeAllStorageFilesFromUploads({});
              const result = await instance();

              expect(result.initializationsSuccessCount).toBe(1);
              expect(result.filesVisited).toBe(1);
              expect(result.modelKeys).toHaveLength(1);
            });
          });

          describe('avatar', () => {
            demoProfileContext({ f, u: au }, (p) => {
              const testAssetsFolderPath = `${__dirname}/../../../test/assets/`;

              function uploadAvatarForUser(testFileName: string, testFileType: MimeTypeWithoutParameters) {
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
                let profile = await assertSnapshotData(p.document);
                expect(profile.avatar).not.toBeDefined(); // no avatar

                const uploadedFilePath = await uploadAvatarForUser('avatar.png', 'image/png')();

                expect(uploadedFilePath.bucketId).toBeDefined();
                expect(uploadedFilePath.pathString).toBeDefined();

                const uploadedFile = f.storageContext.file(uploadedFilePath);
                let uploadedFileExists = await uploadedFile.exists();

                expect(uploadedFileExists).toBe(true);

                const instance = await f.storageFileServerActions.initializeAllStorageFilesFromUploads({});
                const result = await instance();

                expect(result.initializationsSuccessCount).toBe(1);
                expect(result.filesVisited).toBe(1);
                expect(result.modelKeys).toHaveLength(1);

                // check the avatar to see that it was resized and saved as a jpeg
                const storageFile = await assertSnapshotData(f.demoFirestoreCollections.storageFileCollection.documentAccessor().loadDocumentForKey(result.modelKeys[0]));
                expect(storageFile.ps).toBe(StorageFileProcessingState.DO_NOT_PROCESS);

                const file = f.storageContext.file(storageFile);
                const fileMetadata = await file.getMetadata();

                expect(fileMetadata.contentType).toBe('image/jpeg');

                const fileData = await file.getBytes();
                expect(fileData).toBeDefined();

                const sharpInstance = sharp(fileData);
                const sharpMetadata = await sharpInstance.metadata();

                expect(sharpMetadata.width).toBe(USER_AVATAR_IMAGE_WIDTH);
                expect(sharpMetadata.height).toBe(USER_AVATAR_IMAGE_HEIGHT);
                expect(sharpMetadata.format).toBe('jpeg');

                uploadedFileExists = await uploadedFile.exists();
                expect(uploadedFileExists).toBe(false);

                profile = await assertSnapshotData(p.document);
                expect(profile.avatar).toBeDefined();
              });

              describe('initialized', () => {
                demoStorageFileContext({ f, createUploadedFile: uploadAvatarForUser('avatar.png', 'image/png'), processStorageFile: false }, (sf) => {
                  it('should not be flagged for processing', async () => {
                    const storageFile = await assertSnapshotData(sf.document);
                    expect(storageFile.ps).toBe(StorageFileProcessingState.DO_NOT_PROCESS);
                  });

                  it('should replace and mark the previous avatar for deletion when a new one is uploaded', async () => {
                    let profile = await assertSnapshotData(p.document);
                    expect(profile.avatar).toBeDefined(); // avatar should exist

                    const initialAvatarPath = profile.avatar;

                    const uploadedFilePath = await uploadAvatarForUser('avatar.png', 'image/png')();

                    const uploadedFile = f.storageContext.file(uploadedFilePath);
                    const uploadedFileExists = await uploadedFile.exists();

                    expect(uploadedFileExists).toBe(true);

                    const initializeStorageFileParams: InitializeStorageFileFromUploadParams = {
                      pathString: uploadedFilePath.pathString
                    };

                    const result = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(storageFileIdentity, initializeStorageFileParams, 'fromUpload'))) as OnCallCreateModelResult;
                    expect(result.modelKeys).toHaveLength(1);

                    profile = await assertSnapshotData(p.document);
                    expect(profile.avatar).toBeDefined();
                    expect(profile.avatar).not.toBe(initialAvatarPath); // avatar changed

                    const previousStorageFile = await assertSnapshotData(sf.document);
                    expect(previousStorageFile.fs).toBe(StorageFileState.QUEUED_FOR_DELETE);
                    expect(previousStorageFile.sdat).toBeDefined();
                    expect(previousStorageFile.sdat).toBeBefore(new Date());

                    const newStorageFileDocument = f.demoFirestoreCollections.storageFileCollection.documentAccessor().loadDocumentForKey(result.modelKeys[0]);
                    const newStorageFile = await assertSnapshotData(newStorageFileDocument);
                    expect(newStorageFile.fs).toBe(StorageFileState.OK);
                    expect(newStorageFile.sdat).not.toBeDefined(); // should not have been queued for delete

                    // process deleting the queued storage files
                    const deleteInstance = await f.storageFileServerActions.deleteAllQueuedStorageFiles({});
                    const deleteResult = await deleteInstance();

                    expect(deleteResult.storageFilesVisited).toBeGreaterThanOrEqual(1);
                    expect(deleteResult.storageFilesDeleted).toBeGreaterThanOrEqual(1);

                    const previousStorageFileDeleted = await sf.document.exists();
                    expect(previousStorageFileDeleted).toBe(false);
                  });
                });
              });
            });
          });
        });
      });

      describe('StorageFileGroup', () => {
        describe('storage file group initialization', () => {
          describe('created file with group id', () => {
            /**
             * Each test file is associated with the groups declared by userTestFileGroupIds().
             */
            demoStorageFileContext({ f, createUploadedFile: createTestFileForUser('This is a test file.') }, (sf) => {
              describe('syncAllFlaggedStorageFilesWithGroups()', () => {
                it('should sync all ', async () => {});
              });
            });
          });
        });
      });
    });
  });
});
