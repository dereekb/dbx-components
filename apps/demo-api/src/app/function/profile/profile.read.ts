import { DownloadProfileArchiveParams, DownloadProfileArchiveResult, type ProfileDocument, userProfileStorageFileGroupId } from 'demo-firebase';
import { DemoReadModelFunction } from '../function';
import { profileForUserRequest } from './profile.util';
import { storageFileGroupZipStorageFileKey } from '@dereekb/firebase';
import { assertIsAdminInRequest } from '@dereekb/firebase-server';

export const profileDownloadArchive: DemoReadModelFunction<DownloadProfileArchiveParams, DownloadProfileArchiveResult> = async (request) => {
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
};
