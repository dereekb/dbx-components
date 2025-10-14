import { describeCallableRequestTest, jestExpectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoNotificationContext, demoStorageFileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { USER_TEST_FILE_PURPOSE, USER_TEST_FILE_PURPOSE_PART_A_SUBTASK, USER_TEST_FILE_PURPOSE_PART_B_SUBTASK, userAvatarUploadsFilePath, UserTestFileProcessingSubtask, UserTestFileProcessingSubtaskMetadata, userTestFileUploadsFilePath } from 'demo-firebase';
import {
  combineUploadFileTypeDeterminers,
  determineByFileName,
  determineByFolderName,
  determineByFilePath,
  EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL,
  HIGH_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL,
  StoragePath,
  StorageRawDataString,
  StoredFileReader,
  storedFileReaderFactory,
  UploadedFileTypeDeterminer,
  determineUserByFolderWrapperFunction,
  ALL_USER_UPLOADS_FOLDER_PATH,
  FirebaseStorageAccessorFile,
  StorageFileState,
  UPLOADED_FILE_DOES_NOT_EXIST_ERROR_CODE,
  UPLOADED_FILE_INITIALIZATION_FAILED_ERROR_CODE,
  ProcessStorageFileParams,
  onCallUpdateModelParams,
  storageFileIdentity,
  StorageFileProcessingState,
  STORAGE_FILE_PROCESSING_NOT_QUEUED_FOR_PROCESSING_ERROR_CODE,
  StorageFileProcessingNotificationTaskData,
  STORAGE_FILE_PROCESSING_STUCK_THROTTLE_CHECK_MS
} from '@dereekb/firebase';
import { addMilliseconds, slashPathDetails, SlashPathFolder, SlashPathPart } from '@dereekb/util';
import { assertSnapshotData, MODEL_NOT_AVAILABLE_ERROR_CODE } from '@dereekb/firebase-server';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { readFile } from 'fs/promises';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('storagefile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    describe('StorageFile', () => {
      demoAuthorizedUserAdminContext({ f }, (au) => {
        describe('determiners', () => {
          const detailsAccessorFactory = storedFileReaderFactory();

          const fileName = 'test.txt';
          const rootFolder: SlashPathFolder = 'testing/';
          const fileFolderName = 'determiner';
          const fileFolder: SlashPathFolder = `${fileFolderName}/`;
          const fullFolderPath = `${rootFolder}${fileFolder}`;
          const fullFilePath = `${fullFolderPath}${fileName}`;

          let detailsAccessor: StoredFileReader;

          const uploadFile = async (path: string, data: StorageRawDataString = 'test', contentType = 'text/plain') => {
            const file = await f.storageContext.file(path);
            await file.upload(data, { contentType, stringFormat: 'raw' });

            return {
              accessor: detailsAccessorFactory(file)
            };
          };

          beforeEach(async () => {
            const testFilePath = `${fullFolderPath}${fileName}`;
            const { accessor } = await uploadFile(testFilePath);
            detailsAccessor = accessor;
          });

          describe('determineByFileName()', () => {
            it('should return a match on a matching file', async () => {
              const determiner = determineByFileName({ fileType: 'test', match: fileName });
              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeDefined();
              expect(result?.type).toBe('test');
              expect(result?.level).toBe(EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL);
            });

            it('should return undefined when the file name does not match', async () => {
              const determiner = determineByFileName({ fileType: 'test', match: 'other.txt' });
              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeUndefined();
            });

            it('should match using a prefix when the configuration omits the extension', async () => {
              const determiner = determineByFileName({ fileType: 'test', match: 'test' });
              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeDefined();
              expect(result?.level).toBe(HIGH_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL);
            });
          });

          describe('determineByFolderName()', () => {
            it('should return undefined when the folder name does not match', async () => {
              const determiner = determineByFolderName({ fileType: 'folder', match: 'unmatched/' });
              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeUndefined();
            });

            it('should match on the determiner folder path', async () => {
              const determiner = determineByFolderName({ fileType: 'folder', match: fullFolderPath });
              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeDefined();
              expect(result?.type).toBe('folder');
            });

            it('should match on the root testing folder path', async () => {
              const { accessor } = await uploadFile(`${rootFolder}root-match.txt`);
              const determiner = determineByFolderName({ fileType: 'root', match: rootFolder });
              const result = await determiner.determine(accessor);

              expect(result).toBeDefined();
              expect(result?.type).toBe('root');
            });
          });

          describe('determineByFilePath()', () => {
            it('should match the exact file path', async () => {
              const customMatchDeterminationLevel = 7;
              const determiner = determineByFilePath({ fileType: 'path', match: fullFilePath, matchDeterminationLevel: customMatchDeterminationLevel });
              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeDefined();
              expect(result?.type).toBe('path');
              expect(result?.level).toBe(customMatchDeterminationLevel);
            });

            it('should match the exact file path that is defined in match parts', async () => {
              const determiner = determineByFilePath({
                fileType: 'path',
                match: [rootFolder, fileFolder, fileName]
              });

              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeDefined();
              expect(result?.type).toBe('path');
            });

            it('should match the exact file path that is defined in match parts with a wildcard on the folder', async () => {
              const determiner = determineByFilePath({
                fileType: 'path',
                match: [rootFolder, true, fileName]
              });

              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeDefined();
              expect(result?.type).toBe('path');
            });

            it('should match a confguration that matches any path under /testing/determiner', async () => {
              const customMatchDeterminationLevel = 7;
              const determiner = determineByFilePath({
                fileType: 'path',
                match: {
                  targetPath: ['/testing', (x: SlashPathPart) => x === fileFolderName], // match /testing/determiner
                  matchRemaining: true // the remaining parts do not matter
                },
                matchDeterminationLevel: customMatchDeterminationLevel
              });

              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeDefined();
              expect(result?.type).toBe('path');
              expect(result?.level).toBe(customMatchDeterminationLevel);
            });

            it('should match a confguration that matches any file at /testing/<any>/test.txt', async () => {
              const customMatchDeterminationLevel = 7;
              const determiner = determineByFilePath({
                fileType: 'path',
                match: {
                  targetPath: ['/testing', true, 'test.txt'], // match /testing/<any>/test.txt
                  matchRemaining: true // the remaining parts do not matter
                },
                matchDeterminationLevel: customMatchDeterminationLevel
              });

              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeDefined();
              expect(result?.type).toBe('path');
              expect(result?.level).toBe(customMatchDeterminationLevel);
            });

            it('should match a confguration that matches any file at /testing/<any>/test{.*}*', async () => {
              const customMatchDeterminationLevel = 7;
              const determiner = determineByFilePath({
                fileType: 'path',
                match: {
                  targetPath: [
                    '/testing',
                    true,
                    (x) => {
                      const details = slashPathDetails(x);
                      return details.fileName === 'test';
                    }
                  ], // match /testing/<any>/test.*
                  matchRemaining: true // the remaining parts do not matter
                },
                matchDeterminationLevel: customMatchDeterminationLevel
              });

              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeDefined();
              expect(result?.type).toBe('path');
              expect(result?.level).toBe(customMatchDeterminationLevel);
            });

            it('should return undefined when the file path does not match', async () => {
              const determiner = determineByFilePath({ fileType: 'path', match: `${fullFolderPath}other.txt` });
              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeUndefined();
            });

            it('should match on the folder when matchRemaining is allowed', async () => {
              const determiner = determineByFilePath({
                fileType: 'folder-path',
                match: {
                  targetPath: fullFolderPath,
                  matchRemaining: true
                }
              });
              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeDefined();
              expect(result?.type).toBe('folder-path');
            });

            it('should respect the matchBucket filter when it returns false', async () => {
              const determiner = determineByFilePath({
                fileType: 'bucket-filtered',
                match: fullFilePath,
                matchBucket: () => false
              });

              const result = await determiner.determine(detailsAccessor);
              expect(result).toBeUndefined();
            });

            it('should respect matchFileDetails and skip when it returns false', async () => {
              const determiner = determineByFilePath({
                fileType: 'details-filtered',
                match: fullFilePath,
                matchFileDetails: () => false
              });

              const result = await determiner.determine(detailsAccessor);
              expect(result).toBeUndefined();
            });
          });

          describe('determineUserByFolderWrapperFunction()', () => {
            describe('instance', () => {
              const userId = '12345';

              const fullFolderPath = ALL_USER_UPLOADS_FOLDER_PATH;
              const userFolderPath = `${fullFolderPath}/${userId}/`;
              const fullFilePath = `${userFolderPath}${fileName}`;

              beforeEach(async () => {
                const { accessor } = await uploadFile(fullFilePath, fileName);
                detailsAccessor = accessor;
              });

              it('should match the file and return the user id based on the folder in the result', async () => {
                const determinerWrapper = determineUserByFolderWrapperFunction({ rootFolder: 'uploads', userFolderPrefix: 'u' });
                const determiner = determinerWrapper(determineByFileName({ fileType: 'test', match: 'test.txt' }));

                const possibleFileTypes = determiner.getPossibleFileTypes();
                expect(possibleFileTypes).toEqual(['test']);

                const result = await determiner.determine(detailsAccessor);
                expect(result).toBeDefined();
                expect(result?.type).toBe('test');
                expect(result?.user).toBe(userId);
              });
            });
          });

          describe('combineUploadFileTypeDeterminer()', () => {
            const secondFileName = 'alternate.txt';
            let secondDetailsAccessor: StoredFileReader;

            beforeEach(async () => {
              const secondFilePath = `${fullFolderPath}${secondFileName}`;
              const { accessor } = await uploadFile(secondFilePath, 'alternate');
              secondDetailsAccessor = accessor;
            });

            it('should return undefined when none of the determiners match', async () => {
              const determiner = combineUploadFileTypeDeterminers({
                determiners: [determineByFileName({ fileType: 'folder', match: 'not-a-match.txt' })]
              });

              const result = await determiner.determine(detailsAccessor);
              expect(result).toBeUndefined();
            });

            it('should match the respective file types for each determiner', async () => {
              const primaryDeterminer = determineByFileName({ fileType: 'primary', match: fileName });
              const secondaryDeterminer = determineByFileName({ fileType: 'secondary', match: secondFileName });
              const determiner = combineUploadFileTypeDeterminers({ determiners: [primaryDeterminer, secondaryDeterminer] });

              const primaryResult = await determiner.determine(detailsAccessor);
              const secondaryResult = await determiner.determine(secondDetailsAccessor);

              expect(primaryResult?.type).toBe('primary');
              expect(secondaryResult?.type).toBe('secondary');
            });

            it('should prefer the highest determination level when multiple determiners match', async () => {
              const lowLevelDeterminer = determineByFileName({ fileType: 'low', match: 'test' });
              const exactDeterminer = determineByFileName({ fileType: 'exact', match: fileName });
              const determiner = combineUploadFileTypeDeterminers({ determiners: [lowLevelDeterminer, exactDeterminer] });

              const result = await determiner.determine(detailsAccessor);

              expect(result?.type).toBe('exact');
              expect(result?.level).toBe(EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL);
            });

            it('should stop evaluating determiners when configured to complete on first match', async () => {
              let secondaryInvocationCount = 0;
              const firstDeterminer: UploadedFileTypeDeterminer = {
                determine: async (input) => ({
                  input,
                  type: 'first',
                  level: HIGH_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL
                }),
                getPossibleFileTypes: () => ['first']
              };

              const secondDeterminer: UploadedFileTypeDeterminer = {
                determine: async (input) => {
                  secondaryInvocationCount++;
                  return {
                    input,
                    type: 'second',
                    level: EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL
                  };
                },
                getPossibleFileTypes: () => ['second']
              };

              const determiner = combineUploadFileTypeDeterminers({
                determiners: [firstDeterminer, secondDeterminer],
                completeSearchOnFirstMatch: true
              });

              const result = await determiner.determine(detailsAccessor);

              expect(result?.type).toBe('first');
              expect(secondaryInvocationCount).toBe(0);
            });
          });
        });

        describe('initializeStorageFileFromUpload()', () => {
          // tests for files that are sent to /uploads
          describe('files in uploads folder', () => {
            describe('user', () => {
              describe('non-existant file', () => {
                itShouldFail('to initialize', async () => {
                  const instance = await f.storageFileServerActions.initializeStorageFileFromUpload({
                    pathString: 'non-existant.txt'
                  });

                  await expectFail(() => instance(), jestExpectFailAssertHttpErrorServerErrorCode(UPLOADED_FILE_DOES_NOT_EXIST_ERROR_CODE));
                });
              });

              describe('unknown file', () => {
                let unknownFileStoragePath: StoragePath;
                let unknownFile: FirebaseStorageAccessorFile;

                const testFileContent = 'This is a test file.';

                beforeEach(async () => {
                  const testFilePath = 'uploads/unknown/unknown.txt';
                  unknownFile = await f.storageContext.file(testFilePath);
                  unknownFileStoragePath = unknownFile.storagePath;

                  const contentType = 'text/plain';
                  await unknownFile.upload(testFileContent, { contentType, stringFormat: 'raw' });
                });

                itShouldFail('to initialize', async () => {
                  const instance = await f.storageFileServerActions.initializeStorageFileFromUpload({
                    pathString: unknownFileStoragePath.pathString
                  });

                  await expectFail(() => instance(), jestExpectFailAssertHttpErrorServerErrorCode(UPLOADED_FILE_INITIALIZATION_FAILED_ERROR_CODE));
                });
              });

              describe('test file', () => {
                let testFileStoragePath: StoragePath;
                let testFile: FirebaseStorageAccessorFile;

                const testFileContent = 'This is a test file.';

                beforeEach(async () => {
                  const uid = au.uid;

                  const testFilePath = userTestFileUploadsFilePath(uid, 'test.txt');
                  testFile = await f.storageContext.file(testFilePath);
                  testFileStoragePath = testFile.storagePath;

                  const contentType = 'text/plain';
                  await testFile.upload(testFileContent, { contentType, stringFormat: 'raw' });
                });

                it('should initialize the file', async () => {
                  let testfileExists = await testFile.exists();
                  expect(testfileExists).toBe(true);

                  const instance = await f.storageFileServerActions.initializeStorageFileFromUpload({
                    pathString: testFileStoragePath.pathString // only provide the path string for the default bucket
                  });

                  const result = await instance();
                  expect(result).toBeDefined();

                  // check the original uploaded file was deleted
                  testfileExists = await testFile.exists();
                  expect(testfileExists).toBe(false);

                  const storageFile = await assertSnapshotData(result);
                  expect(storageFile).toBeDefined();
                  expect(storageFile.cat).toBeDefined();
                  expect(storageFile.fs).toBe(StorageFileState.OK);
                  expect(storageFile.p).toBe(USER_TEST_FILE_PURPOSE);

                  // check the new file exists at the target location
                  const newFile = f.storageContext.file(storageFile);

                  const newFileExists = await newFile.exists();
                  expect(newFileExists).toBe(true);
                });
              });

              describe('avatar', () => {
                describe('invalid image', () => {
                  let testFileStoragePath: StoragePath;
                  let testFile: FirebaseStorageAccessorFile;

                  const testFileContent = 'This is not an image.';

                  beforeEach(async () => {
                    const uid = au.uid;

                    const testFilePath = userAvatarUploadsFilePath(uid);
                    testFile = await f.storageContext.file(testFilePath);
                    testFileStoragePath = testFile.storagePath;

                    const contentType = 'text/plain';
                    await testFile.upload(testFileContent, { contentType, stringFormat: 'raw' });
                  });

                  itShouldFail('to initialize and delete the uploaded file immediately', async () => {
                    let fileExists = await testFile.exists();
                    expect(fileExists).toBe(true);

                    const instance = await f.storageFileServerActions.initializeStorageFileFromUpload({
                      pathString: testFileStoragePath.pathString // only provide the path string for the default bucket
                    });

                    await expectFail(() => instance(), jestExpectFailAssertHttpErrorServerErrorCode(UPLOADED_FILE_INITIALIZATION_FAILED_ERROR_CODE));

                    // gets deleted
                    fileExists = await testFile.exists();
                    expect(fileExists).toBe(false);
                  });
                });
              });
            });
          });
        });

        describe('processStorageFile()', () => {
          const testFileContent = 'This is a test file.';

          function createUploadedFile(type: 'processable' | 'non-processable') {
            switch (type) {
              case 'processable':
                return async () => {
                  const uid = au.uid;

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
              case 'non-processable':
                return async () => {
                  const uid = au.uid;

                  const filePath = userAvatarUploadsFilePath(uid);
                  const testFile = await f.storageContext.file(filePath);
                  const testFileStoragePath = testFile.storagePath;

                  const testAssetsFolderPath = `${__dirname}/../../../test/assets/`;
                  const localAvatarFileBuffer = await readFile(`${testAssetsFolderPath}/avatar.png`);

                  await testFile.upload(localAvatarFileBuffer, { contentType: 'image/png' });

                  const result: StoragePath = {
                    bucketId: testFileStoragePath.bucketId,
                    pathString: testFileStoragePath.pathString
                  };

                  return result;
                };
            }
          }

          describe('non-existent StorageFileDocument', () => {
            itShouldFail('to process the non-existent StorageFileDocument', async () => {
              const storageFile = await f.demoFirestoreCollections.storageFileCollection.documentAccessor().loadDocumentForId('12345');

              const processStorageFileParams: ProcessStorageFileParams = {
                key: storageFile.key
              };

              await expectFail(() => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileIdentity, processStorageFileParams, 'process')), jestExpectFailAssertHttpErrorServerErrorCode(MODEL_NOT_AVAILABLE_ERROR_CODE));
            });
          });

          describe('non-existent file associated with StorageFileDocument', () => {
            itShouldFail('to process the non-existent StorageFileDocument', async () => {
              const storageFile = await f.demoFirestoreCollections.storageFileCollection.documentAccessor().loadDocumentForId('12345');

              const processStorageFileParams: ProcessStorageFileParams = {
                key: storageFile.key
              };

              await expectFail(() => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileIdentity, processStorageFileParams, 'process')), jestExpectFailAssertHttpErrorServerErrorCode(MODEL_NOT_AVAILABLE_ERROR_CODE));
            });
          });

          describe('non-processable file', () => {
            // files that are not processable, but might be flagged for processing accidentally
            demoStorageFileContext({ f, createUploadedFile: createUploadedFile('non-processable') }, (sf) => {
              itShouldFail('to process the file if it is not marked for processing.', async () => {
                const storageFile = await assertSnapshotData(sf.document);
                expect(storageFile.ps).toBe(StorageFileProcessingState.DO_NOT_PROCESS);

                const processStorageFileParams: ProcessStorageFileParams = {
                  key: sf.documentKey
                };

                await expectFail(() => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileIdentity, processStorageFileParams, 'process')), jestExpectFailAssertHttpErrorServerErrorCode(STORAGE_FILE_PROCESSING_NOT_QUEUED_FOR_PROCESSING_ERROR_CODE));
              });
            });
          });

          describe('processable file', () => {
            demoStorageFileContext({ f, createUploadedFile: createUploadedFile('processable') }, (sf) => {
              it('should create the processing task for the file', async () => {
                const storageFile = await assertSnapshotData(sf.document);
                expect(storageFile.p).toBeDefined();
                expect(storageFile.ps).toBe(StorageFileProcessingState.QUEUED_FOR_PROCESSING);
                expect(storageFile.pn).not.toBeDefined();
                expect(storageFile.pat).not.toBeDefined();

                const processStorageFileParams: ProcessStorageFileParams = {
                  key: sf.documentKey
                };

                await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileIdentity, processStorageFileParams, 'process'));

                const updatedStorageFile = await assertSnapshotData(sf.document);
                expect(updatedStorageFile.p).toBeDefined();
                expect(updatedStorageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
                expect(updatedStorageFile.pn).toBeDefined();
                expect(updatedStorageFile.pat).toBeDefined();
              });

              describe('runImmediately=true', () => {
                it('should create the processing task for the file and run the first step', async () => {
                  const storageFile = await assertSnapshotData(sf.document);
                  expect(storageFile.p).toBeDefined();
                  expect(storageFile.ps).toBe(StorageFileProcessingState.QUEUED_FOR_PROCESSING);
                  expect(storageFile.pn).not.toBeDefined();
                  expect(storageFile.pat).not.toBeDefined();

                  const processStorageFileParams: ProcessStorageFileParams = {
                    key: sf.documentKey,
                    runImmediately: true
                  };

                  await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileIdentity, processStorageFileParams, 'process'));

                  const updatedStorageFile = await assertSnapshotData(sf.document);
                  expect(updatedStorageFile.p).toBeDefined();
                  expect(updatedStorageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
                  expect(updatedStorageFile.pn).toBeDefined();
                  expect(updatedStorageFile.pat).toBeDefined();

                  const notificationTaskKey = updatedStorageFile.pn;

                  const notificationDocument = f.demoFirestoreCollections.notificationCollectionGroup.documentAccessor().loadDocumentForKey(notificationTaskKey as string);
                  const notification = await assertSnapshotData(notificationDocument);

                  expect(notification).toBeDefined();
                  expect(notification.tpr).toEqual([]); // has two steps, so should not have finished processing yet

                  const metadata = notification.n.d as StorageFileProcessingNotificationTaskData<UserTestFileProcessingSubtaskMetadata, UserTestFileProcessingSubtask>;
                  expect(metadata).toBeDefined();
                  expect(metadata.sfps).toEqual([USER_TEST_FILE_PURPOSE_PART_A_SUBTASK]); // should have finished subtask A
                  expect(metadata.storageFile).toBe(sf.documentId);
                  expect(metadata.storagePath?.bucketId).toBe(storageFile.bucketId);
                  expect(metadata.storagePath?.pathString).toBe(storageFile.pathString);
                  expect(metadata.p).toBe(storageFile.p);

                  const subtaskMetadata = metadata.sd;
                  expect(subtaskMetadata?.numberValue).toBeDefined();
                  expect(subtaskMetadata?.stringValue).toBeDefined();
                });
              });

              describe('the related stored file does not exist', () => {
                it('should create the processing task for the file', async () => {
                  const storageFile = await assertSnapshotData(sf.document);
                  expect(storageFile.p).toBeDefined();
                  expect(storageFile.ps).toBe(StorageFileProcessingState.QUEUED_FOR_PROCESSING);
                  expect(storageFile.pn).not.toBeDefined();
                  expect(storageFile.pat).not.toBeDefined();

                  const processStorageFileParams: ProcessStorageFileParams = {
                    key: sf.documentKey
                  };

                  await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileIdentity, processStorageFileParams, 'process'));

                  const updatedStorageFile = await assertSnapshotData(sf.document);
                  expect(updatedStorageFile.p).toBeDefined();
                  expect(updatedStorageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
                  expect(updatedStorageFile.pn).toBeDefined();
                  expect(updatedStorageFile.pat).toBeDefined();
                });
              });

              describe('file processing task already created', () => {
                beforeEach(async () => {
                  await sf.process();
                });

                it('should do nothing', async () => {
                  const storageFile = await assertSnapshotData(sf.document);
                  expect(storageFile.p).toBeDefined();
                  expect(storageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
                  expect(storageFile.pn).toBeDefined();
                  expect(storageFile.pat).toBeDefined();

                  const processStorageFileParams: ProcessStorageFileParams = {
                    key: sf.documentKey
                  };

                  await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileIdentity, processStorageFileParams, 'process'));

                  const updatedStorageFile = await assertSnapshotData(sf.document);
                  expect(updatedStorageFile.p).toBe(storageFile.p);
                  expect(updatedStorageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
                  expect(updatedStorageFile.pat).toBeSameSecondAs(storageFile.pat as Date);
                });

                describe('inconsistent state', () => {
                  describe('processing state is set but no notification task is set', () => {
                    beforeEach(async () => {
                      await sf.document.update({
                        ps: StorageFileProcessingState.PROCESSING,
                        pat: new Date(),
                        pn: null
                      });
                    });

                    it('should create a new processing task', async () => {
                      const storageFile = await assertSnapshotData(sf.document);
                      expect(storageFile.p).toBeDefined();
                      expect(storageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
                      expect(storageFile.pn).toBeUndefined(); // inconsistent state where the pn is not set
                      expect(storageFile.pat).toBeDefined();

                      const processStorageFileParams: ProcessStorageFileParams = {
                        key: sf.documentKey
                      };

                      await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileIdentity, processStorageFileParams, 'process'));

                      const updatedStorageFile = await assertSnapshotData(sf.document);
                      expect(updatedStorageFile.p).toBe(storageFile.p);
                      expect(updatedStorageFile.pn).toBeDefined();
                      expect(updatedStorageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
                      expect(updatedStorageFile.pat).toBeAfter(storageFile.pat as Date);
                    });
                  });
                });

                describe('file processing started hours ago', () => {
                  beforeEach(async () => {
                    await sf.document.update({
                      pat: addMilliseconds(new Date(), -(STORAGE_FILE_PROCESSING_STUCK_THROTTLE_CHECK_MS * 2))
                    });
                  });

                  describe('notification task does not exist', () => {
                    demoNotificationContext({ f, doc: () => sf.loadProcessingTaskDocument() }, (nc) => {
                      it('should create a new processing task', async () => {
                        const storageFile = await assertSnapshotData(sf.document);
                        expect(storageFile.p).toBeDefined();
                        expect(storageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
                        expect(storageFile.pn).toBeDefined();
                        expect(storageFile.pat).toBeDefined();

                        // delete the notification task
                        await nc.document.accessor.delete();

                        const notificationExists = await nc.document.exists();
                        expect(notificationExists).toBe(false);

                        const processStorageFileParams: ProcessStorageFileParams = {
                          key: sf.documentKey
                        };

                        await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(storageFileIdentity, processStorageFileParams, 'process'));

                        const updatedStorageFile = await assertSnapshotData(sf.document);
                        expect(updatedStorageFile.p).toBe(storageFile.p);
                        expect(updatedStorageFile.pn).toBeDefined();
                        expect(updatedStorageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
                        expect(updatedStorageFile.pat).not.toBeSameSecondAs(storageFile.pat as Date); // new processing start time
                      });
                    });
                  });
                });

                describe('processing task', () => {
                  demoNotificationContext({ f, doc: () => sf.loadProcessingTaskDocument() }, (nc) => {
                    it('should run the entire task and run cleanup successfully.', async () => {
                      let storageFile = await assertSnapshotData(sf.document);
                      expect(storageFile.p).toBeDefined();
                      expect(storageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
                      expect(storageFile.pn).toBeDefined();
                      expect(storageFile.pat).toBeDefined();

                      // run subtask A
                      const runSubtaskA = await nc.sendNotification();
                      expect(runSubtaskA).toBeDefined();
                      expect(runSubtaskA.throttled).toBe(false);
                      expect(runSubtaskA.isNotificationTask).toBe(true);
                      expect(runSubtaskA.success).toBe(true);

                      let notification = await assertSnapshotData(nc.document);
                      let metadata = notification.n.d as StorageFileProcessingNotificationTaskData<UserTestFileProcessingSubtaskMetadata, UserTestFileProcessingSubtask>;

                      expect(metadata).toBeDefined();
                      expect(metadata.sfps).toEqual([USER_TEST_FILE_PURPOSE_PART_A_SUBTASK]);

                      // run subtask B
                      const runSubtaskB = await nc.sendNotification();
                      expect(runSubtaskB).toBeDefined();
                      expect(runSubtaskB.throttled).toBe(false);
                      expect(runSubtaskB.isNotificationTask).toBe(true);
                      expect(runSubtaskB.success).toBe(true);

                      notification = await assertSnapshotData(nc.document);
                      metadata = notification.n.d as StorageFileProcessingNotificationTaskData<UserTestFileProcessingSubtaskMetadata, UserTestFileProcessingSubtask>;

                      expect(metadata).toBeDefined();
                      expect(metadata.sfps).toEqual([USER_TEST_FILE_PURPOSE_PART_A_SUBTASK, USER_TEST_FILE_PURPOSE_PART_B_SUBTASK]);

                      // run cleanup
                      const runCleanup = await nc.sendNotification();
                      expect(runCleanup).toBeDefined();
                      expect(runCleanup.throttled).toBe(false);
                      expect(runCleanup.isNotificationTask).toBe(true);
                      expect(runCleanup.success).toBe(true);

                      storageFile = await assertSnapshotData(sf.document);
                      expect(storageFile.p).toBe(storageFile.p);
                      expect(storageFile.ps).toBe(StorageFileProcessingState.SUCCESS);
                      expect(storageFile.pn).toBeUndefined(); // notification task reference is removed
                      expect(storageFile.pat).toBeDefined(); // does not change
                      expect(storageFile.pcat).toBeDefined();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
