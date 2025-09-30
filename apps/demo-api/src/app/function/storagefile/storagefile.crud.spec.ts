import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { USER_TEST_FILE_PURPOSE, userTestFileUploadsFilePath } from 'demo-firebase';
import { combineUploadFileTypeDeterminers, determineByFileName, determineByFolderName, determineByFilePath, EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL, HIGH_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL, StoragePath, StorageRawDataString, UploadedFileDetailsAccessor, uploadedFileDetailsAccessorFactory, UploadedFileTypeDeterminer, determineUserByFolderWrapperFunction, ALL_USER_UPLOADS_FOLDER_PATH, FirebaseStorageAccessor, FirebaseStorageAccessorFile, StorageFileState } from '@dereekb/firebase';
import { slashPathDetails, SlashPathFolder, SlashPathPart } from '@dereekb/util';
import { assertSnapshotData } from '@dereekb/firebase-server';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('storagefile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    describe('StorageFile', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        describe('determiners', () => {
          const detailsAccessorFactory = uploadedFileDetailsAccessorFactory();

          const fileName = 'test.txt';
          const rootFolder: SlashPathFolder = 'testing/';
          const fileFolderName = 'determiner';
          const fileFolder: SlashPathFolder = `${fileFolderName}/`;
          const fullFolderPath = `${rootFolder}${fileFolder}`;
          const fullFilePath = `${fullFolderPath}${fileName}`;

          let detailsAccessor: UploadedFileDetailsAccessor;

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
            let secondDetailsAccessor: UploadedFileDetailsAccessor;

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
              describe('test file', () => {
                let testFileStoragePath: StoragePath;
                let testFile: FirebaseStorageAccessorFile;

                const testFileContent = 'This is a test file.';

                beforeEach(async () => {
                  const uid = u.uid;

                  const testFilePath = userTestFileUploadsFilePath(uid, 'test.txt');
                  testFile = await f.storageContext.file(testFilePath);
                  testFileStoragePath = testFile.storagePath;

                  const contentType = 'text/plain';
                  await testFile.upload(testFileContent, { contentType, stringFormat: 'raw' });
                });

                it('should initialize the file', async () => {
                  let testfileExists = await testFile.exists();
                  expect(testfileExists).toBe(true);

                  const instance = await f.storageFileActions.initializeStorageFileFromUpload({
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
            });
          });
        });
      });
    });
  });
});
