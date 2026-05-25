import { type DeleteStorageFileParams, deleteStorageFileParamsType } from '@dereekb/firebase';
import { assertIsAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { type DemoDeleteModelFunction } from '../function.context';

export const storageFileDelete: DemoDeleteModelFunction<DeleteStorageFileParams> = withApiDetails({
  inputType: deleteStorageFileParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    const deleteFn = await nest.storageFileServerActions.deleteStorageFile(data);
    const accessor = nest.demoFirestoreCollections.storageFileCollection.documentAccessor();
    const document = accessor.loadDocumentForKey(data.key);

    await deleteFn(document);
  }
});
