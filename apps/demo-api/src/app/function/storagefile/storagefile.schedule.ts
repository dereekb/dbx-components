import { DemoScheduleFunction } from '../function';

export const storageFileHourlyUpdateSchedule: DemoScheduleFunction = async (request) => {
  // init all storage files from uploads
  const initializeAllStorageFilesFromUploads = await request.nest.storageFileActions.initializeAllStorageFilesFromUploads({});
  const initializeAllStorageFilesFromUploadsResult = await initializeAllStorageFilesFromUploads();

  console.log({ initializeAllStorageFilesFromUploadsResult });

  // process all storage files that are queued for processing
  const processAllQueuedStorageFiles = await request.nest.storageFileActions.processAllQueuedStorageFiles({});
  const processAllQueuedStorageFilesResult = await processAllQueuedStorageFiles();

  console.log({ processAllQueuedStorageFilesResult });

  // delete all storage files that are queued for deletion
  const deleteAllQueuedStorageFiles = await request.nest.storageFileActions.deleteAllQueuedStorageFiles({});
  const deleteAllQueuedStorageFilesResult = await deleteAllQueuedStorageFiles();

  console.log({ deleteAllQueuedStorageFilesResult });
};
