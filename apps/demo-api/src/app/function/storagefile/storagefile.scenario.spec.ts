import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoProfileContext, demoStorageFileContext, demoStorageFileGroupContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { type DownloadProfileArchiveParams, type DownloadProfileArchiveResult, profileIdentity, USER_AVATAR_IMAGE_HEIGHT, USER_AVATAR_IMAGE_WIDTH, userAvatarUploadsFilePath, userProfileStorageFileGroupId, userTestFileUploadsFilePath } from 'demo-firebase';
import { type InitializeStorageFileFromUploadParams, onCallCreateModelParams, type OnCallCreateModelResult, onCallReadModelParams, onCallUpdateModelParams, STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE, StorageFileDisplayName, storageFileIdentity, storageFileGroupIdentity, StorageFileProcessingState, StorageFileState, type StoragePath, type UpdateStorageFileGroupParams } from '@dereekb/firebase';
import { ZIP_FILE_MIME_TYPE, type MimeTypeWithoutParameters } from '@dereekb/util';
import { readFile } from 'fs/promises';
import { assertSnapshotData } from '@dereekb/firebase-server';
import * as sharp from 'sharp';
import * as AdmZip from 'adm-zip';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('storagefile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserAdminContext({ f }, (au) => {
      demoProfileContext({ f, u: au }, (p) => {
        function createTestFileForUser(content: string, fileName = 'test.any') {
          return async () => {
            const uid = au.uid;
            const testFileContent = content;

            const filePath = userTestFileUploadsFilePath(uid, fileName);
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

                const storageFile = await assertSnapshotData(f.demoFirestoreCollections.storageFileCollection.documentAccessor().loadDocumentForKey(result.modelKeys[0]));
                expect(storageFile.ps).toBe(StorageFileProcessingState.QUEUED_FOR_PROCESSING);
              });

              it('should initialize an uploaded test file with expedite processing', async () => {
                const uploadedFilePath = await createTestFileForUser('This is a test file.')();

                expect(uploadedFilePath.bucketId).toBeDefined();
                expect(uploadedFilePath.pathString).toBeDefined();

                const uploadedFile = f.storageContext.file(uploadedFilePath);
                const uploadedFileExists = await uploadedFile.exists();

                expect(uploadedFileExists).toBe(true);

                const instance = await f.storageFileServerActions.initializeStorageFileFromUpload({
                  bucketId: uploadedFilePath.bucketId,
                  pathString: uploadedFilePath.pathString,
                  expediteProcessing: true
                });

                const storageFileDocument = await instance();

                const storageFile = await assertSnapshotData(storageFileDocument);
                expect(storageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
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

                it('should initialize an uploaded avatar with expedite processing', async () => {
                  const uploadedFilePath = await uploadAvatarForUser('avatar.png', 'image/png')();

                  expect(uploadedFilePath.bucketId).toBeDefined();
                  expect(uploadedFilePath.pathString).toBeDefined();

                  const uploadedFile = f.storageContext.file(uploadedFilePath);
                  const uploadedFileExists = await uploadedFile.exists();

                  expect(uploadedFileExists).toBe(true);

                  const instance = await f.storageFileServerActions.initializeStorageFileFromUpload({
                    bucketId: uploadedFilePath.bucketId,
                    pathString: uploadedFilePath.pathString,
                    expediteProcessing: true // should get ignored as the avatar has no processing
                  });

                  const storageFileDocument = await instance();

                  const storageFile = await assertSnapshotData(storageFileDocument);
                  expect(storageFile.ps).toBe(StorageFileProcessingState.DO_NOT_PROCESS);
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
          describe('multiple test files', () => {
            demoStorageFileGroupContext(
              {
                f,
                storageFileGroupId: async () => userProfileStorageFileGroupId(au.uid),
                createIfNeeded: false, // do not create or init
                initIfNeeded: false
              },
              (sfg) => {
                demoStorageFileContext({ f, createUploadedFile: createTestFileForUser('This is test file 1.', 'test1.any') }, (sf1) => {
                  demoStorageFileContext({ f, createUploadedFile: createTestFileForUser('This is test file 2.', 'test2.any') }, (sf2) => {
                    demoStorageFileContext({ f, createUploadedFile: createTestFileForUser('This is test file 3.', 'test3.any') }, (sf3) => {
                      it('should generate the expected zip file', async () => {
                        // sync all flagged storage files with groups
                        const syncFlaggedResult = await sf1.syncAllFlaggedStorageFilesWithGroups();
                        expect(syncFlaggedResult.storageFilesGroupsCreated).toBe(1); // created once
                        expect(syncFlaggedResult.storageFilesGroupsUpdated).toBe(2); // updated twice with the other two files

                        let storageFileGroup = await assertSnapshotData(sfg.document);
                        expect(storageFileGroup.f).toHaveLength(3);

                        expect(storageFileGroup.f.map((x) => x.s)).toContain(sf1.document.id);
                        expect(storageFileGroup.f.map((x) => x.s)).toContain(sf2.document.id);
                        expect(storageFileGroup.f.map((x) => x.s)).toContain(sf3.document.id);

                        expect(storageFileGroup.s).toBe(true); // still needs to be initialized

                        // initialize it
                        await sfg.initializeStorageFileGroup();
                        storageFileGroup = await assertSnapshotData(sfg.document);

                        expect(storageFileGroup.z).toBe(true); // should have zip files enabled
                        expect(storageFileGroup.zsf).toBeUndefined(); // no storage file created yet
                        expect(storageFileGroup.re).toBe(true); // flagged for regeneration

                        // regenerate the zip file
                        const regenerateResult = await sfg.regenerateStorageFileGroupContent(); //regenerate the content
                        expect(regenerateResult.contentStorageFilesFlaggedForProcessing).toBe(1); // only the zip storage file should be flagged now

                        storageFileGroup = await assertSnapshotData(sfg.document);
                        expect(storageFileGroup.zsf).toBeDefined(); // should now be defined
                        expect(storageFileGroup.zat).toBeUndefined(); // should not yet be set since it hasn't completed the processing

                        // PROCESSING
                        const zipStorageFileDocument = f.demoFirestoreCollections.storageFileCollection.documentAccessor().loadDocumentForId(storageFileGroup.zsf as string);
                        let zipStorageFile = await assertSnapshotData(zipStorageFileDocument);

                        expect(zipStorageFile.fs).toBe(StorageFileState.OK); // should be ok
                        expect(zipStorageFile.p).toBe(STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE); // should be the zip purpose
                        expect(zipStorageFile.ps).toBe(StorageFileProcessingState.QUEUED_FOR_PROCESSING); // should be queued for processing
                        expect(zipStorageFile.pn).toBeUndefined(); // no processing notification task created yet

                        // process the storage file immediately
                        const processAllStorageFilesInstance = await f.storageFileServerActions.processAllQueuedStorageFiles({});
                        const processAllStorageFilesResult = await processAllStorageFilesInstance();

                        expect(processAllStorageFilesResult.storageFilesProcessStarted).toBeGreaterThan(1); // test items may also be marked as processing after this

                        zipStorageFile = await assertSnapshotData(zipStorageFileDocument);

                        expect(zipStorageFile.ps).toBe(StorageFileProcessingState.PROCESSING); // should now be marked processing
                        expect(zipStorageFile.pn).toBeDefined(); // processing notification task created/set

                        // notification tasks are now queued up
                        const sendQueuedNotificationsInstance = await f.notificationServerActions.sendQueuedNotifications({});
                        const sendQueuedNotificationsResult = await sendQueuedNotificationsInstance();

                        expect(sendQueuedNotificationsResult.notificationTasksVisited).toBeGreaterThan(1); // test items may also get run at the same time.

                        // check the final result
                        zipStorageFile = await assertSnapshotData(zipStorageFileDocument);

                        expect(zipStorageFile.fs).toBe(StorageFileState.OK); // should be ok and not marked for delete
                        expect(zipStorageFile.ps).toBe(StorageFileProcessingState.SUCCESS); // should now be marked processing
                        expect(zipStorageFile.pn).toBeUndefined(); // processing notification task cleared now that it is complete
                        expect(zipStorageFile.sdat).not.toBeDefined(); // should not be flagged for deletion

                        // check the storage file group final result
                        storageFileGroup = await assertSnapshotData(sfg.document);
                        expect(storageFileGroup.z).toBe(true); // zip should still be enabled
                        expect(storageFileGroup.zat).toBeDefined(); // lasted file time is now set

                        // check the zip file contents
                        const file = f.storageContext.file(zipStorageFile);

                        const fileExists = await file.exists(); // file should exist
                        expect(fileExists).toBe(true);

                        const fileMetadata = await file.getMetadata();
                        expect(fileMetadata).toBeDefined();

                        expect(fileMetadata.name).toBeDefined();
                        expect(fileMetadata.contentType).toBe(ZIP_FILE_MIME_TYPE);

                        const fileBytes = await file.getBytes();
                        const zip = new AdmZip(Buffer.from(fileBytes));

                        const zipEntries = zip.getEntries();
                        expect(zipEntries.length).toBe(4); // info.json and the test files
                      });

                      describe('storage files have display names set', () => {
                        const testFile1DisplayName: StorageFileDisplayName = 'Test File 1';
                        const testFile2DisplayName: StorageFileDisplayName = 'Test File 2';

                        beforeEach(async () => {
                          await sf1.document.update({ n: testFile1DisplayName });
                        });

                        it('should generate the expected zip file', async () => {
                          await sf1.syncAllFlaggedStorageFilesWithGroups();

                          // initialize the storage file group
                          await sfg.initializeStorageFileGroup();

                          let storageFileGroup = await assertSnapshotData(sfg.document);

                          expect(storageFileGroup.f).toHaveLength(3);

                          await sfg.document.update({
                            f: storageFileGroup.f.map((x) => {
                              let result = x;

                              if (x.s === sf2.documentId) {
                                result = {
                                  ...result,
                                  n: testFile2DisplayName
                                };
                              }

                              return result;
                            })
                          });

                          // flag to regenerate the zip file
                          await sfg.regenerateStorageFileGroupContent();

                          storageFileGroup = await assertSnapshotData(sfg.document);
                          expect(storageFileGroup.f).toHaveLength(3);

                          const zsf = storageFileGroup.zsf as string;
                          expect(zsf).toBeDefined();

                          // PROCESSING
                          const zipStorageFileDocument = f.demoFirestoreCollections.storageFileCollection.documentAccessor().loadDocumentForId(zsf);

                          // process the storage file immediately
                          const processAllStorageFilesInstance = await f.storageFileServerActions.processAllQueuedStorageFiles({});
                          await processAllStorageFilesInstance();

                          // notification tasks are now queued up
                          const sendQueuedNotificationsInstance = await f.notificationServerActions.sendQueuedNotifications({});
                          await sendQueuedNotificationsInstance();

                          // check the final result
                          const zipStorageFile = await assertSnapshotData(zipStorageFileDocument);

                          expect(zipStorageFile.fs).toBe(StorageFileState.OK); // should be ok and not marked for delete
                          expect(zipStorageFile.ps).toBe(StorageFileProcessingState.SUCCESS); // should now be marked processing
                          expect(zipStorageFile.pn).toBeUndefined(); // processing notification task cleared now that it is complete
                          expect(zipStorageFile.sdat).not.toBeDefined(); // should not be flagged for deletion

                          // check the storage file group final result
                          storageFileGroup = await assertSnapshotData(sfg.document);
                          expect(storageFileGroup.z).toBe(true); // zip should still be enabled
                          expect(storageFileGroup.zat).toBeDefined(); // lasted file time is now set

                          // check the zip file contents
                          const file = f.storageContext.file(zipStorageFile);

                          const fileExists = await file.exists(); // file should exist
                          expect(fileExists).toBe(true);

                          const fileMetadata = await file.getMetadata();
                          expect(fileMetadata).toBeDefined();

                          expect(fileMetadata.name).toBeDefined();
                          expect(fileMetadata.contentType).toBe(ZIP_FILE_MIME_TYPE);

                          const fileBytes = await file.getBytes();
                          const zip = new AdmZip(Buffer.from(fileBytes));

                          const zipEntries = zip.getEntries();
                          expect(zipEntries.length).toBe(4); // info.json and the test files

                          const names = zipEntries.map((x) => x.name);
                          expect(names).toContain('info.json');
                          expect(names).toContain(`${testFile1DisplayName}.any`);
                          expect(names).toContain(`${testFile2DisplayName}.any`);
                          expect(names).toContain('test3.any');
                        });
                      });

                      describe('zip file generated', () => {
                        demoStorageFileGroupContext(
                          {
                            f,
                            storageFileGroupId: async () => userProfileStorageFileGroupId(au.uid),
                            initIfNeeded: true // create and initialize
                          },
                          (sfg) => {
                            demoStorageFileContext(
                              {
                                f,
                                doc: async () => {
                                  await sf1.syncAllFlaggedStorageFilesWithGroups(); // sync the storage files first
                                  await sfg.regenerateStorageFileGroupContent(); // flag content regeneration

                                  const zipStorageFileDocument = await sfg.processZipFileRegeneration();
                                  return zipStorageFileDocument;
                                }
                              },
                              (sf_zip) => {
                                it('should allow regenerating the zip again', async () => {
                                  const storageFileGroup = await assertSnapshotData(sfg.document);
                                  expect(storageFileGroup.zsf).toBeDefined();

                                  const zipStorageFileDocument = f.demoFirestoreCollections.storageFileCollection.documentAccessor().loadDocumentForId(storageFileGroup.zsf as string);
                                  let zipStorageFile = await assertSnapshotData(zipStorageFileDocument);

                                  expect(zipStorageFile.ps).toBe(StorageFileProcessingState.SUCCESS);

                                  await sfg.regenerateStorageFileGroupContent(); // flag for regenerating again

                                  zipStorageFile = await assertSnapshotData(zipStorageFileDocument);
                                  expect(zipStorageFile.ps).toBe(StorageFileProcessingState.PROCESSING); // should now be processing

                                  const resultZipDocument = await sfg.processZipFileRegeneration();
                                  expect(resultZipDocument.key).toBe(zipStorageFileDocument.key);

                                  zipStorageFile = await assertSnapshotData(zipStorageFileDocument);
                                  expect(zipStorageFile.ps).toBe(StorageFileProcessingState.SUCCESS); // should now be fully processed again
                                });

                                it('should allow the user to download their zip file', async () => {
                                  const downloadProfileArchiveParams: DownloadProfileArchiveParams = {
                                    key: p.documentKey
                                  };

                                  const result = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(profileIdentity, downloadProfileArchiveParams, 'downloadArchive'))) as DownloadProfileArchiveResult;

                                  expect(result).toBeDefined();
                                  expect(result.url).toBeDefined();
                                });

                                describe('updating display name via API', () => {
                                  it('should allow updating and clearing the display name of an embedded file', async () => {
                                    const newDisplayName = 'Updated Test File Name';

                                    // Test setting the display name
                                    const updateParams: UpdateStorageFileGroupParams = {
                                      key: sfg.documentKey,
                                      entries: [
                                        {
                                          s: sf1.document.id,
                                          n: newDisplayName
                                        }
                                      ]
                                    };

                                    let result = await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileGroupIdentity, updateParams));
                                    expect(result).toBeDefined();

                                    let storageFileGroup = await assertSnapshotData(sfg.document);
                                    expect(storageFileGroup.f).toHaveLength(3); // should still have all 3 embedded files referenced

                                    let updatedEmbeddedEntry = storageFileGroup.f.find((file) => file.s === sf1.document.id);
                                    expect(updatedEmbeddedEntry).toBeDefined();
                                    expect(updatedEmbeddedEntry?.n).toBe(newDisplayName);

                                    // Test clearing the display name
                                    const clearParams: UpdateStorageFileGroupParams = {
                                      key: sfg.documentKey,
                                      entries: [
                                        {
                                          s: sf1.document.id,
                                          n: null
                                        }
                                      ]
                                    };

                                    result = await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileGroupIdentity, clearParams));

                                    expect(result).toBeDefined();

                                    storageFileGroup = await assertSnapshotData(sfg.document);
                                    expect(storageFileGroup.f).toHaveLength(3); // should still have all 3 embedded files referenced

                                    updatedEmbeddedEntry = storageFileGroup.f.find((file) => file.s === sf1.document.id);
                                    expect(updatedEmbeddedEntry?.n).toBeUndefined(); // is now cleared
                                  });

                                  it('should only update files that exist in the group', async () => {
                                    const nonExistentFileId = 'non_existent_file_id';

                                    const updateParams: UpdateStorageFileGroupParams = {
                                      key: sfg.documentKey,
                                      entries: [
                                        {
                                          s: nonExistentFileId,
                                          n: 'This Should Not Be Added'
                                        }
                                      ]
                                    };

                                    await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileGroupIdentity, updateParams));

                                    const updatedStorageFileGroup = await assertSnapshotData(sfg.document);
                                    expect(updatedStorageFileGroup.f).toHaveLength(3);

                                    const nonExistentEmbeddedFile = updatedStorageFileGroup.f.find((file) => file.s === nonExistentFileId);
                                    expect(nonExistentEmbeddedFile).toBeUndefined();
                                  });
                                });

                                describe('adding a new file to the group', () => {
                                  demoStorageFileContext({ f, createUploadedFile: createTestFileForUser('This is test file 4.', 'test4.any') }, (sf4) => {
                                    it('should update the storage group after the file is synced', async () => {
                                      let storageFile = await assertSnapshotData(sf4.document);
                                      expect(storageFile.gs).toBe(true); // should be flagged for sync

                                      let storageFileGroup = await assertSnapshotData(sfg.document);
                                      expect(storageFileGroup.f).toHaveLength(3); // should have 3 files now
                                      expect(storageFileGroup.re).toBeFalsy(); // should not be flagged for regeneration

                                      await sf4.syncWithStorageFileGroups();

                                      storageFile = await assertSnapshotData(sf4.document);
                                      expect(storageFile.gs).toBeUndefined(); // should no longer be flagged for sync

                                      storageFileGroup = await assertSnapshotData(sfg.document);
                                      expect(storageFileGroup.f).toHaveLength(4); // should have 4 files now
                                      expect(storageFileGroup.re).toBe(true); // should be flagged for regeneration
                                    });
                                  });
                                });

                                describe('updating an existing storageFile to remove it from the group', () => {
                                  beforeEach(async () => {
                                    await sf1.document.update({ g: [] }); // clear all groups from the storage file
                                  });

                                  it('should flag the storage file group for clean up during the next regeneration', async () => {
                                    let storageFileGroup = await assertSnapshotData(sfg.document);
                                    expect(storageFileGroup.c).toBeFalsy();

                                    await sfg.processZipFileRegeneration();

                                    storageFileGroup = await assertSnapshotData(sfg.document);
                                    expect(storageFileGroup.c).toBeTruthy(); // group should be flagged for cleanup

                                    // check the zip file contents
                                    const zipStorageFileDocument = f.demoFirestoreCollections.storageFileCollection.documentAccessor().loadDocumentForId(storageFileGroup.zsf as string);
                                    const zipStorageFile = await assertSnapshotData(zipStorageFileDocument);

                                    const file = f.storageContext.file(zipStorageFile);

                                    const fileExists = await file.exists(); // file should exist
                                    expect(fileExists).toBe(true);

                                    const fileMetadata = await file.getMetadata();
                                    expect(fileMetadata).toBeDefined();

                                    expect(fileMetadata.name).toBeDefined();
                                    expect(fileMetadata.contentType).toBe(ZIP_FILE_MIME_TYPE);

                                    const fileBytes = await file.getBytes();
                                    const zip = new AdmZip(Buffer.from(fileBytes));

                                    const zipEntries = zip.getEntries();
                                    expect(zipEntries.length).toBe(3); // info.json and the remaining test files
                                  });
                                });

                                describe('storage file is marked for deletion', () => {
                                  beforeEach(async () => {
                                    await sf1.markForDeletion();
                                  });

                                  it('deleting the storgae file should remove it from the group and schedule another sync', async () => {
                                    let storageFileGroup = await assertSnapshotData(sfg.document);
                                    expect(storageFileGroup.re).toBeUndefined(); // not flagged for regeneration
                                    expect(storageFileGroup.f).toHaveLength(3);

                                    await sf1.deleteStorageFile();

                                    storageFileGroup = await assertSnapshotData(sfg.document);
                                    expect(storageFileGroup.f).toHaveLength(2); // should now have removed the deleted filed
                                    expect(storageFileGroup.re).toBe(true); // should be flagged for regeneration
                                  });
                                });
                              }
                            );
                          }
                        );
                      });
                    });
                  });
                });
              }
            );
          });
        });
      });
    });
  });
});
