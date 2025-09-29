import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { userTestFileUploadsFilePath, userTestFileUploadsFolderPath } from 'demo-firebase';
import { determineByFileName, StoragePath, StorageRawDataString, UploadedFileDetailsAccessor, uploadedFileDetailsAccessorFactory } from '@dereekb/firebase';
import { SlashPath, SlashPathFolder } from '@dereekb/util';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('storagefile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    describe('StorageFile', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        describe('determiners', () => {
          const detailsAccessorFactory = uploadedFileDetailsAccessorFactory();

          const fileName = 'test.txt';
          const rootFolder: SlashPathFolder = 'testing/';
          const fileFolder: SlashPathFolder = 'determiner/';
          const fullFolderPath = `${rootFolder}${fileFolder}`;

          let testFileStoragePath: StoragePath;
          let detailsAccessor: UploadedFileDetailsAccessor;

          beforeEach(async () => {
            const testFilePath = `${fullFolderPath}${fileName}`;
            const testFile = await f.storageContext.file(testFilePath);
            testFileStoragePath = testFile.storagePath;

            const contentType = 'text/plain';
            await testFile.upload('test', { contentType, stringFormat: 'raw' });

            detailsAccessor = detailsAccessorFactory(testFile);
          });

          describe('determineByFileName()', () => {
            it('should return a match on a matching file', async () => {
              const determiner = determineByFileName({ fileType: 'test', match: fileName });
              const result = await determiner.determine(detailsAccessor);

              expect(result).toBeDefined();
            });

            // TODO: Replace with what happens when it is not matched
          });

          describe('determineByFolderName()', () => {
            // TODO: Test positive match on both the root testing folder, and the determiner folder
          });

          describe('combineUploadFileTypeDeterminer()', () => {
            // TODO: Add a second before-each that uploads a second file with a different file name
            // TODO: Test combining two determiners of different file types and testing that they match on each type respectively.
          });
        });

        describe('initializeStorageFileFromUpload()', () => {
          // tests for files that are sent to /uploads
          describe('files in uploads folder', () => {
            describe('user', () => {
              describe('test file', () => {
                let testFileStoragePath: StoragePath;
                const testFileContent = 'This is a test file.';

                beforeEach(async () => {
                  const uid = u.uid;

                  const testFilePath = userTestFileUploadsFilePath(uid, 'test.txt');
                  const testFile = await f.storageContext.file(testFilePath);
                  testFileStoragePath = testFile.storagePath;

                  const contentType = 'text/plain';
                  await testFile.upload(testFileContent, { contentType, stringFormat: 'raw' });
                });

                it('should initialize the file', async () => {
                  const instance = await f.storageFileActions.initializeStorageFileFromUpload({
                    pathString: testFileStoragePath.pathString // only provide the path string for the default bucket
                  });

                  const result = await instance();
                  expect(result).toBeDefined();
                });
              });
            });
          });
        });
      });
    });
  });
});
