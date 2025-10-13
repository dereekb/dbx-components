import { UpdateStorageFileParams } from '@dereekb/firebase';
import { DemoUpdateModelFunction } from '../function';

export const storageFileUpdate: DemoUpdateModelFunction<UpdateStorageFileParams> = async (request) => {
  const { nest, data } = request;

  const updateStorageFile = await nest.storageFileActions.updateStorageFile(data);
  const storageFileDocument = await nest.useModel('storageFile', {
    request,
    key: data.key,
    roles: 'update',
    use: (x) => x.document
  });

  await updateStorageFile(storageFileDocument);
};

export const storageFileProcess: DemoUpdateModelFunction<UpdateStorageFileParams> = async (request) => {
  const { nest, data } = request;

  const processStorageFile = await nest.storageFileActions.processStorageFile(data);
  const storageFileDocument = await nest.useModel('storageFile', {
    request,
    key: data.key,
    roles: 'process',
    use: (x) => x.document
  });

  await processStorageFile(storageFileDocument);
};
