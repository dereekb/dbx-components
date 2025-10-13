import { DemoScheduleFunction, runDemoScheduledTasks } from '../function';

export const storageFileHourlyUpdateSchedule: DemoScheduleFunction = async (request) => {
  console.log('storageFileHourlyUpdateSchedule - running');

  await runDemoScheduledTasks({
    initializeAllStorageFilesFromUploads: async () => {
      const initializeAllStorageFilesFromUploads = await request.nest.storageFileActions.initializeAllStorageFilesFromUploads({});
      const initializeAllStorageFilesFromUploadsResult = await initializeAllStorageFilesFromUploads();
      return { initializeAllStorageFilesFromUploadsResult };
    },
    processAllQueuedStorageFiles: async () => {
      const processAllQueuedStorageFiles = await request.nest.storageFileActions.processAllQueuedStorageFiles({});
      const processAllQueuedStorageFilesResult = await processAllQueuedStorageFiles();
      return { processAllQueuedStorageFilesResult };
    },
    deleteAllQueuedStorageFiles: async () => {
      const deleteAllQueuedStorageFiles = await request.nest.storageFileActions.deleteAllQueuedStorageFiles({});
      const deleteAllQueuedStorageFilesResult = await deleteAllQueuedStorageFiles();
      return { deleteAllQueuedStorageFilesResult };
    }
  });

  console.log('storageFileHourlyUpdateSchedule - done');
};
