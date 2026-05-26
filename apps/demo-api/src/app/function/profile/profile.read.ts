import { type DownloadProfileArchiveParams, type DownloadProfileArchiveResult, type ProfileDocument, downloadProfileArchiveParamsType, userProfileStorageFileGroupId } from 'demo-firebase';
import { type DemoReadModelFunction } from '../function.context';
import { profileForUserRequest } from './profile.util';
import { storageFileGroupZipStorageFileKey } from '@dereekb/firebase';
import { assertIsAdminInRequest, withApiDetails } from '@dereekb/firebase-server';

export const profileDownloadArchive: DemoReadModelFunction<DownloadProfileArchiveParams, DownloadProfileArchiveResult> = withApiDetails({
  inputType: downloadProfileArchiveParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    if (data.asAdmin) {
      assertIsAdminInRequest(request);
    }

    const profileDocument: ProfileDocument = await profileForUserRequest(request);

    const targetStorageFileGroupId = userProfileStorageFileGroupId(profileDocument.id);
    const targetStorageFileKey = storageFileGroupZipStorageFileKey(targetStorageFileGroupId);

    const downloadStorageFile = await nest.storageFileServerActions.downloadStorageFile({
      key: targetStorageFileKey
    });

    return downloadStorageFile();
  }
});
