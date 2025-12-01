import { type RegenerateStorageFileGroupContentParams, type RegenerateStorageFileGroupContentResult } from '@dereekb/firebase';
import { type DemoUpdateModelFunction } from '../function';

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
