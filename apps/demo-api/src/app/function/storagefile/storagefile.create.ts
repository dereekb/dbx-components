import { assertIsAdminInRequest } from '@dereekb/firebase-server';
import { DemoCreateModelFunction } from '../function';
import { CreateStorageFileParams, InitializeAllStorageFilesFromUploadsParams, InitializeAllStorageFilesFromUploadsResult, InitializeStorageFileFromUploadParams, OnCallCreateModelResult, onCallCreateModelResultWithDocs } from '@dereekb/firebase';

export const storageFileCreate: DemoCreateModelFunction<CreateStorageFileParams> = async (request) => {
  const { nest, data } = request;

  await assertIsAdminInRequest(request);

  const createStorageFile = await nest.storageFileActions.createStorageFile(data);
  const result = await createStorageFile();

  return onCallCreateModelResultWithDocs(result);
};

export const storageFileInitializeFromUpload: DemoCreateModelFunction<InitializeStorageFileFromUploadParams> = async (request) => {
  const { nest, data } = request;

  await assertIsAdminInRequest(request);

  const initializeStorageFileFromUpload = await nest.storageFileActions.initializeStorageFileFromUpload(data);
  const result = await initializeStorageFileFromUpload();

  return onCallCreateModelResultWithDocs(result);
};

export const storageFileInitializeAllFromUploads: DemoCreateModelFunction<InitializeAllStorageFilesFromUploadsParams, InitializeAllStorageFilesFromUploadsResult> = async (request) => {
  const { nest, data } = request;

  await assertIsAdminInRequest(request);

  const initializeAllStorageFilesFromUploads = await nest.storageFileActions.initializeAllStorageFilesFromUploads(data);
  const result = await initializeAllStorageFilesFromUploads();

  return result;
};
