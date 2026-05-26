import { assertIsAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { storageFileCreateSignedUploadUrlToolDetailsFactory } from '@dereekb/firebase-server/model';
import { type DemoCreateModelFunction } from '../function.context';
import {
  type CreateStorageFileParams,
  type CreateStorageFileSignedUploadUrlParams,
  type CreateStorageFileSignedUploadUrlResult,
  type FirebaseAuthUserId,
  type InitializeAllStorageFilesFromUploadsParams,
  type InitializeAllStorageFilesFromUploadsResult,
  type InitializeStorageFileFromUploadParams,
  createStorageFileParamsType,
  createStorageFileSignedUploadUrlParamsType,
  initializeAllStorageFilesFromUploadsParamsType,
  initializeStorageFileFromUploadParamsType,
  onCallCreateModelResultWithDocs
} from '@dereekb/firebase';
import { STORAGE_FILE_PURPOSE_UPLOAD_POLICIES } from 'demo-firebase';

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

// MARK: Signed Upload URL
/**
 * Issues a short-lived, content-type-pinned signed PUT URL that lands an upload
 * inside the authenticated caller's `/uploads/u/{uid}/...` namespace.
 *
 * The path, content-type, and size cap are derived from the per-purpose
 * `STORAGE_FILE_PURPOSE_UPLOAD_POLICIES` registry wired into the server-action
 * context, so the URL can only write to a location that both `storage.rules`
 * and the existing `StorageFileInitializeFromUploadService` initializer accept.
 *
 * The returned `modelKeys` is always empty — minting a URL does not create a
 * StorageFile document; the document is created later by the upload-complete
 * pipeline.
 */
export const storageFileCreateSignedUploadUrl: DemoCreateModelFunction<CreateStorageFileSignedUploadUrlParams, CreateStorageFileSignedUploadUrlResult> = withApiDetails({
  inputType: createStorageFileSignedUploadUrlParamsType,
  mcp: {
    toolDetails: storageFileCreateSignedUploadUrlToolDetailsFactory({
      policies: STORAGE_FILE_PURPOSE_UPLOAD_POLICIES
    })
  },
  fn: async (request) => {
    const { nest, data } = request;
    const uid = request.auth.uid as FirebaseAuthUserId;

    const action = await nest.storageFileServerActions.createStorageFileSignedUploadUrl(data);
    return action({ uid });
  }
});
