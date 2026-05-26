import { type RegenerateStorageFileGroupContentParams, type RegenerateStorageFileGroupContentResult, type UpdateStorageFileGroupParams, type StorageFileGroupDocument, regenerateStorageFileGroupContentParamsType, updateStorageFileGroupParamsType } from '@dereekb/firebase';
import { type DemoUpdateModelFunction } from '../function.context';
import { withApiDetails } from '@dereekb/firebase-server';

export const storageFileGroupUpdate: DemoUpdateModelFunction<UpdateStorageFileGroupParams, StorageFileGroupDocument> = withApiDetails({
  inputType: updateStorageFileGroupParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const updateStorageFileGroup = await nest.storageFileServerActions.updateStorageFileGroup(data);
    const storageFileGroupDocument = await nest.useModel('storageFileGroup', {
      request,
      key: data.key,
      use: (x) => x.document
    });

    return updateStorageFileGroup(storageFileGroupDocument);
  }
});

export const storageFileGroupRegenerateContent: DemoUpdateModelFunction<RegenerateStorageFileGroupContentParams, RegenerateStorageFileGroupContentResult> = withApiDetails({
  inputType: regenerateStorageFileGroupContentParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const regenerateContent = await nest.storageFileServerActions.regenerateStorageFileGroupContent(data);
    const storageFileGroupDocument = await nest.useModel('storageFileGroup', {
      request,
      key: data.key,
      roles: 'regenerate',
      use: (x) => x.document
    });

    return regenerateContent(storageFileGroupDocument);
  }
});
