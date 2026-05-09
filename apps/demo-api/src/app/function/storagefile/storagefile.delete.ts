import { type DeleteStorageFileParams } from '@dereekb/firebase';
import { assertIsAdminInRequest } from '@dereekb/firebase-server';
import { type DemoDeleteModelFunction } from '../function.context';

export const storageFileDelete: DemoDeleteModelFunction<DeleteStorageFileParams> = async (request) => {
  const { nest, data } = request;

  assertIsAdminInRequest(request);

  const deleteFn = await nest.storageFileServerActions.deleteStorageFile(data);
  const accessor = nest.demoFirestoreCollections.storageFileCollection.documentAccessor();
  const document = accessor.loadDocumentForKey(data.key);

  await deleteFn(document);
};
