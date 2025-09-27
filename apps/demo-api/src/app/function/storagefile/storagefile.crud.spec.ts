import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('storagefile.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    describe('StorageFile', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        describe('initializeStorageFileFromUpload()', () => {
          describe('file in uploads folder', () => {
            describe('valid file with processor', () => {});
          });
        });

        describe('initializeAllStorageFilesFromUploads()', () => {
          // TODO: ...
        });
      });
    });
  });
});
