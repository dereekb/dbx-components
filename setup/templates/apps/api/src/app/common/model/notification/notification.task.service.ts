import { NotificationTaskService, NotificationTaskServiceTaskHandlerConfig, notificationTaskService, storageFileProcessingNotificationTaskHandler, StorageFileProcessingPurposeSubtaskProcessorConfig } from '@dereekb/firebase-server/model';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';
import { ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';

export function APP_CODE_PREFIX_CAMELNotificationTaskServiceFactory(APP_CODE_PREFIX_CAMELFirebaseServerActionsContext: APP_CODE_PREFIXFirebaseServerActionsContext): NotificationTaskService {
  const storageFileHandler = APP_CODE_PREFIX_CAMELStorageFileProcessingNotificationTaskHandler(APP_CODE_PREFIX_CAMELFirebaseServerActionsContext);

  const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [
    storageFileHandler
  ];

  const notificationSendService: NotificationTaskService = notificationTaskService({
    validate: [
      ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES
    ],
    handlers
  });

  return notificationSendService;
}

export function APP_CODE_PREFIX_CAMELStorageFileProcessingNotificationTaskHandler(APP_CODE_PREFIX_CAMELFirebaseServerActionsContext: APP_CODE_PREFIXFirebaseServerActionsContext) {
  const processors: StorageFileProcessingPurposeSubtaskProcessorConfig[] = [];

  return storageFileProcessingNotificationTaskHandler({
    processors,
    storageFileFirestoreCollections: APP_CODE_PREFIX_CAMELFirebaseServerActionsContext,
    storageAccessor: APP_CODE_PREFIX_CAMELFirebaseServerActionsContext.storageService
  });
}
