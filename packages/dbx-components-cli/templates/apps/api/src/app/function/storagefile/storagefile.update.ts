import { type UpdateStorageFileParams, type ProcessStorageFileParams } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type APP_CODE_PREFIXUpdateModelFunction } from '../function';

export const storageFileUpdate: APP_CODE_PREFIXUpdateModelFunction<UpdateStorageFileParams> = withApiDetails({
  fn: async (request) => {
    const { nest, data } = request;

    const updateStorageFile = await nest.storageFileServerActions.updateStorageFile(data);
    const storageFileDocument = await nest.useModel('storageFile', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    await updateStorageFile(storageFileDocument);
  }
});

export const storageFileProcess: APP_CODE_PREFIXUpdateModelFunction<ProcessStorageFileParams> = withApiDetails({
  fn: async (request) => {
    const { nest, data } = request;

    const processStorageFile = await nest.storageFileServerActions.processStorageFile(data);
    const storageFileDocument = await nest.useModel('storageFile', {
      request,
      key: data.key,
      roles: 'process',
      use: (x) => x.document
    });

    await processStorageFile(storageFileDocument);
  }
});
