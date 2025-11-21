import { type DemoReadModelFunction } from '../function';
import { type DownloadStorageFileParams, type DownloadStorageFileResult } from '@dereekb/firebase';

export const storageFileDownload: DemoReadModelFunction<DownloadStorageFileParams, DownloadStorageFileResult> = async (request) => {
  const { nest, data } = request;

  const downloadStorageFile = await nest.storageFileServerActions.downloadStorageFile(data);
  const storageFileDocument = await nest.useModel('storageFile', {
    request,
    key: data.key,
    roles: data.asAdmin ? 'admin_download' : 'download',
    use: (x) => x.document
  });

  return downloadStorageFile(storageFileDocument);
};
