import { assertIsAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { type APP_CODE_PREFIXCreateModelFunction } from '../function';
import { type CreateStorageFileParams, type InitializeAllStorageFilesFromUploadsParams, type InitializeAllStorageFilesFromUploadsResult, type InitializeStorageFileFromUploadParams, onCallCreateModelResultWithDocs } from '@dereekb/firebase';

export const storageFileCreate: APP_CODE_PREFIXCreateModelFunction<CreateStorageFileParams> = withApiDetails({
  fn: async (request) => {
    const { nest, data } = request;

    await assertIsAdminInRequest(request);

    const createStorageFile = await nest.storageFileServerActions.createStorageFile(data);
    const result = await createStorageFile();

    return onCallCreateModelResultWithDocs(result);
  }
});

export const storageFileInitializeFromUpload: APP_CODE_PREFIXCreateModelFunction<InitializeStorageFileFromUploadParams> = withApiDetails({
  fn: async (request) => {
    const { nest, data } = request;

    // anyone is allowed to initialize a storage file from an upload, as they may be the ones who uploaded it
    // await assertIsAdminInRequest(request);

    const initializeStorageFileFromUpload = await nest.storageFileServerActions.initializeStorageFileFromUpload(data);
    const result = await initializeStorageFileFromUpload();

    return onCallCreateModelResultWithDocs(result);
  }
});

export const storageFileInitializeAllFromUploads: APP_CODE_PREFIXCreateModelFunction<InitializeAllStorageFilesFromUploadsParams, InitializeAllStorageFilesFromUploadsResult> = withApiDetails({
  fn: async (request) => {
    const { nest, data } = request;

    await assertIsAdminInRequest(request);

    const initializeAllStorageFilesFromUploads = await nest.storageFileServerActions.initializeAllStorageFilesFromUploads(data);
    return initializeAllStorageFilesFromUploads();
  }
});
