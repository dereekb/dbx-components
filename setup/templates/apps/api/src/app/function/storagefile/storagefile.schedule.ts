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
    initializeAllStorageFileGroups: async () => {
      const initializeAllStorageFileGroups = await request.nest.storageFileInitActions.initializeAllApplicableStorageFileGroups({});
      const initializeAllStorageFileGroupsResult = await initializeAllStorageFileGroups();
      return { initializeAllStorageFileGroupsResult };
    },
    deleteAllQueuedStorageFiles: async () => {
      const deleteAllQueuedStorageFiles = await request.nest.storageFileServerActions.deleteAllQueuedStorageFiles({});
      const deleteAllQueuedStorageFilesResult = await deleteAllQueuedStorageFiles();
      return { deleteAllQueuedStorageFilesResult };
    },
    syncAllFlaggedStorageFilesWithGroups: async () => {
      const syncAllFlaggedStorageFilesWithGroups = await request.nest.storageFileServerActions.syncAllFlaggedStorageFilesWithGroups({});
      const syncAllFlaggedStorageFilesWithGroupsResult = await syncAllFlaggedStorageFilesWithGroups();
      return { syncAllFlaggedStorageFilesWithGroupsResult };
    },
    regenerateAllFlaggedStorageFileGroupsContent: async () => {
      const regenerateAllFlaggedStorageFileGroupsContent = await request.nest.storageFileServerActions.regenerateAllFlaggedStorageFileGroupsContent({});
      const regenerateAllFlaggedStorageFileGroupsContentResult = await regenerateAllFlaggedStorageFileGroupsContent();
      return { regenerateAllFlaggedStorageFileGroupsContentResult };
    }
  });

  console.log('storageFileHourlyUpdateSchedule - done');
};
