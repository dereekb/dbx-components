import { assertIsAdminInRequest } from '@dereekb/firebase-server';
import { type DemoCreateModelFunction } from '../function';
import { type CreateStorageFileParams, type InitializeAllStorageFilesFromUploadsParams, type InitializeAllStorageFilesFromUploadsResult, type InitializeStorageFileFromUploadParams, onCallCreateModelResultWithDocs } from '@dereekb/firebase';

export const storageFileCreate: DemoCreateModelFunction<CreateStorageFileParams> = async (request) => {
  const { nest, data } = request;

  await assertIsAdminInRequest(request);

  const createStorageFile = await nest.storageFileServerActions.createStorageFile(data);
  const result = await createStorageFile();

  return onCallCreateModelResultWithDocs(result);
};

export const storageFileInitializeFromUpload: DemoCreateModelFunction<InitializeStorageFileFromUploadParams> = async (request) => {
  const { nest, data } = request;

  // anyone is allowed to initialize a storage file from an upload, as they may be the ones who uploaded it
  // await assertIsAdminInRequest(request);

  const initializeStorageFileFromUpload = await nest.storageFileServerActions.initializeStorageFileFromUpload(data);
  const result = await initializeStorageFileFromUpload();

  return onCallCreateModelResultWithDocs(result);
};

export const storageFileInitializeAllFromUploads: DemoCreateModelFunction<InitializeAllStorageFilesFromUploadsParams, InitializeAllStorageFilesFromUploadsResult> = async (request) => {
  const { nest, data } = request;

  await assertIsAdminInRequest(request);

  const initializeAllStorageFilesFromUploads = await nest.storageFileServerActions.initializeAllStorageFilesFromUploads(data);
  const result = await initializeAllStorageFilesFromUploads();

  return result;
};
