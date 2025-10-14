import { APP_CODE_PREFIXScheduleFunction, runAPP_CODE_PREFIXScheduledTasks } from '../function';

export const storageFileHourlyUpdateSchedule: APP_CODE_PREFIXScheduleFunction = async (request) => {
  console.log('storageFileHourlyUpdateSchedule - running');

  await runAPP_CODE_PREFIXScheduledTasks({
    initializeAllStorageFilesFromUploads: async () => {
      const initializeAllStorageFilesFromUploads = await request.nest.storageFileServerActions.initializeAllStorageFilesFromUploads({});
      const initializeAllStorageFilesFromUploadsResult = await initializeAllStorageFilesFromUploads();
      return { initializeAllStorageFilesFromUploadsResult };
    },
    processAllQueuedStorageFiles: async () => {
      const processAllQueuedStorageFiles = await request.nest.storageFileServerActions.processAllQueuedStorageFiles({});
      const processAllQueuedStorageFilesResult = await processAllQueuedStorageFiles();
      return { processAllQueuedStorageFilesResult };
    },
    deleteAllQueuedStorageFiles: async () => {
      const deleteAllQueuedStorageFiles = await request.nest.storageFileServerActions.deleteAllQueuedStorageFiles({});
      const deleteAllQueuedStorageFilesResult = await deleteAllQueuedStorageFiles();
      return { deleteAllQueuedStorageFilesResult };
    }
  });

  console.log('storageFileHourlyUpdateSchedule - done');
};
