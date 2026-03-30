import { type DemoReadModelFunction } from '../function.context';
import { type DownloadStorageFileParams, type DownloadStorageFileResult, type DownloadMultipleStorageFilesParams, type DownloadMultipleStorageFilesResult, type DownloadMultipleStorageFileErrorItem, type DownloadMultipleStorageFilesFileParams, type StorageFileDocument } from '@dereekb/firebase';

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

export const storageFileDownloadMultiple: DemoReadModelFunction<DownloadMultipleStorageFilesParams, DownloadMultipleStorageFilesResult> = async (request) => {
  const { nest, data } = request;
  const { files, asAdmin } = data;

  return nest.useMultipleModels('storageFile', {
    request,
    keys: files.map((file) => file.key),
    roles: asAdmin ? 'admin_download' : 'download',
    throwOnFirstError: false,
    use: async (successful, failure) => {
      // Map successful readers back to their file params and documents
      const permittedFiles: DownloadMultipleStorageFilesFileParams[] = [];
      const permittedDocuments: StorageFileDocument[] = [];

      for (const reader of successful) {
        const key = reader.document.key;
        const file = files.find((f) => f.key === key);

        if (file) {
          permittedFiles.push(file);
          permittedDocuments.push(reader.document);
        }
      }

      const errors: DownloadMultipleStorageFileErrorItem[] = failure.errors.map((item) => ({
        key: item.key as string,
        error: item.error instanceof Error ? item.error.message : 'Access denied'
      }));

      // Download permitted files via server action
      let result: DownloadMultipleStorageFilesResult;

      if (permittedFiles.length > 0) {
        const downloadFn = await nest.storageFileServerActions.downloadMultipleStorageFiles({
          ...data,
          files: permittedFiles
        });

        const downloadResult = await downloadFn(permittedDocuments);
        result = {
          success: downloadResult.success,
          errors: [...errors, ...downloadResult.errors]
        };
      } else {
        result = { success: [], errors };
      }

      return result;
    }
  });
};
