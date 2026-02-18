import { type RegenerateStorageFileGroupContentParams, type RegenerateStorageFileGroupContentResult, type UpdateStorageFileGroupParams, type StorageFileGroupDocument } from '@dereekb/firebase';
import { type DemoUpdateModelFunction } from '../function';

export const storageFileGroupUpdate: DemoUpdateModelFunction<UpdateStorageFileGroupParams, StorageFileGroupDocument> = async (request) => {
  const { nest, data } = request;

  const updateStorageFileGroup = await nest.storageFileServerActions.updateStorageFileGroup(data);
  const storageFileGroupDocument = (await nest.useModel('storageFileGroup', {
    request,
    key: data.key,
    use: (x) => x.document
  })) as StorageFileGroupDocument;

  return updateStorageFileGroup(storageFileGroupDocument);
};

export const storageFileGroupRegenerateContent: DemoUpdateModelFunction<RegenerateStorageFileGroupContentParams, RegenerateStorageFileGroupContentResult> = async (request) => {
  const { nest, data } = request;

  const regenerateContent = await nest.storageFileServerActions.regenerateStorageFileGroupContent(data);
  const storageFileGroupDocument = await nest.useModel('storageFileGroup', {
    request,
    key: data.key,
    roles: 'regenerate',
    use: (x) => x.document
  });

  return regenerateContent(storageFileGroupDocument);
};
