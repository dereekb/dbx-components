import { assertIsAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { type DemoCreateModelFunction } from '../function.context';
import { type CreateStorageFileParams, type InitializeAllStorageFilesFromUploadsParams, type InitializeAllStorageFilesFromUploadsResult, type InitializeStorageFileFromUploadParams, createStorageFileParamsType, initializeAllStorageFilesFromUploadsParamsType, initializeStorageFileFromUploadParamsType, onCallCreateModelResultWithDocs } from '@dereekb/firebase';

export const storageFileCreate: DemoCreateModelFunction<CreateStorageFileParams> = withApiDetails({
  inputType: createStorageFileParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    const createStorageFile = await nest.storageFileServerActions.createStorageFile(data);
    const result = await createStorageFile();

    return onCallCreateModelResultWithDocs(result);
  }
});

export const storageFileFromUpload: DemoCreateModelFunction<InitializeStorageFileFromUploadParams> = withApiDetails({
  inputType: initializeStorageFileFromUploadParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    // anyone is allowed to initialize a storage file from an upload, as they may be the ones who uploaded it
    // await assertIsAdminInRequest(request);

    const initializeStorageFileFromUpload = await nest.storageFileServerActions.initializeStorageFileFromUpload(data);
    const result = await initializeStorageFileFromUpload();

    return onCallCreateModelResultWithDocs(result);
  }
});

export const storageFileAllFromUpload: DemoCreateModelFunction<InitializeAllStorageFilesFromUploadsParams, InitializeAllStorageFilesFromUploadsResult> = withApiDetails({
  inputType: initializeAllStorageFilesFromUploadsParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    const initializeAllStorageFilesFromUploads = await nest.storageFileServerActions.initializeAllStorageFilesFromUploads(data);
    return initializeAllStorageFilesFromUploads();
  }
});
