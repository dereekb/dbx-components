import { UpdateStorageFileParams, ProcessStorageFileParams } from '@dereekb/firebase';
import { APP_CODE_PREFIXUpdateModelFunction } from '../function';

export const storageFileUpdate: APP_CODE_PREFIXUpdateModelFunction<UpdateStorageFileParams> = async (request) => {
  const { nest, data } = request;

  const updateStorageFile = await nest.storageFileServerActions.updateStorageFile(data);
  const storageFileDocument = await nest.useModel('storageFile', {
    request,
    key: data.key,
    roles: 'update',
    use: (x) => x.document
  });

  await updateStorageFile(storageFileDocument);
};

export const storageFileProcess: APP_CODE_PREFIXUpdateModelFunction<ProcessStorageFileParams> = async (request) => {
  const { nest, data } = request;

  const processStorageFile = await nest.storageFileServerActions.processStorageFile(data);
  const storageFileDocument = await nest.useModel('storageFile', {
    request,
    key: data.key,
    roles: 'process',
    use: (x) => x.document
  });

  await processStorageFile(storageFileDocument);
};
