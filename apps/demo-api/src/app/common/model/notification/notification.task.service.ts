import { NotificationTaskService, NotificationTaskServiceTaskHandlerConfig, StorageFileProcessingPurposeSubtaskProcessorConfig, StorageFileProcessingPurposeSubtaskResult, notificationTaskService, storageFileProcessingNotificationTaskHandler } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import {
  ALL_NOTIFICATION_TASK_TYPES,
  EXAMPLE_NOTIFICATION_TASK_PART_A_COMPLETE_VALUE,
  EXAMPLE_NOTIFICATION_TASK_PART_B_COMPLETE_VALUE,
  EXAMPLE_NOTIFICATION_TASK_TYPE,
  EXAMPLE_UNIQUE_NOTIFICATION_TASK_TYPE,
  ExampleNotificationTaskCheckpoint,
  ExampleNotificationTaskData,
  ExampleUniqueNotificationTaskCheckpoint,
  ExampleUniqueNotificationTaskData,
  USER_TEST_FILE_PURPOSE,
  USER_TEST_FILE_PURPOSE_PART_A_SUBTASK,
  USER_TEST_FILE_PURPOSE_PART_B_SUBTASK,
  UserTestFileProcessingSubtask,
  UserTestFileProcessingSubtaskMetadata
} from 'demo-firebase';
import { Maybe } from '@dereekb/util';
import { toJsDate } from '@dereekb/date';
import { ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES, NotificationTaskServiceHandleNotificationTaskResult } from '@dereekb/firebase';

export function demoNotificationTaskServiceFactory(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext): NotificationTaskService {
  /**
   * The result data parsed from the datastore should be strings only, so restore the values to their expected types.
   *
   * @param result
   * @returns
   */
  function parseResult(result?: Maybe<NotificationTaskServiceHandleNotificationTaskResult<ExampleNotificationTaskData>>) {
    return result != null
      ? {
          completion: result?.completion,
          updateMetadata: result?.updateMetadata,
          delayUntil: result?.delayUntil ? toJsDate(result?.delayUntil) : undefined
        }
      : undefined;
  }

  const exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [
      {
        checkpoint: 'part_a',
        fn: async (notificationTask) => {
          // Do something...

          return (
            parseResult(notificationTask.data?.result) ?? {
              completion: 'part_a',
              updateMetadata: {
                value: EXAMPLE_NOTIFICATION_TASK_PART_A_COMPLETE_VALUE
              }
            }
          );
        }
      },
      {
        checkpoint: 'part_b',
        fn: async (notificationTask) => {
          // Do something else...

          return (
            parseResult(notificationTask.data?.result) ?? {
              completion: 'part_b',
              updateMetadata: {
                value: EXAMPLE_NOTIFICATION_TASK_PART_B_COMPLETE_VALUE
              }
            }
          );
        }
      },
      {
        checkpoint: 'part_c',
        fn: async (notificationTask) => {
          // Do final step...

          return (
            parseResult(notificationTask.data?.result) ?? {
              completion: true
            }
          );
        }
      }
    ]
  };

  const exampleUniqueNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<ExampleUniqueNotificationTaskData, ExampleUniqueNotificationTaskCheckpoint> = {
    type: EXAMPLE_UNIQUE_NOTIFICATION_TASK_TYPE,
    flow: [
      {
        checkpoint: 'part_a',
        fn: async (notificationTask) => {
          // Do something...

          return {
            completion: 'part_a'
          };
        }
      },
      {
        checkpoint: 'part_b',
        fn: async (notificationTask) => {
          // Do something else...

          return {
            completion: 'part_b'
          };
        }
      }
    ]
  };

  const storageFileHandler = demoStorageFileProcessingNotificationTaskHandler(demoFirebaseServerActionsContext);

  const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [exampleNotificationTaskHandler, exampleUniqueNotificationTaskHandler, storageFileHandler];

  const notificationSendService: NotificationTaskService = notificationTaskService({
    validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES],
    handlers
  });

  return notificationSendService;
}

export function demoStorageFileProcessingNotificationTaskHandler(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext) {
  const testFileProcessorConfig: StorageFileProcessingPurposeSubtaskProcessorConfig<UserTestFileProcessingSubtaskMetadata, UserTestFileProcessingSubtask> = {
    purpose: USER_TEST_FILE_PURPOSE,
    flow: [
      {
        subtask: USER_TEST_FILE_PURPOSE_PART_A_SUBTASK,
        fn: async (input) => {
          // TODO: pull from the file or something

          return {
            completion: USER_TEST_FILE_PURPOSE_PART_A_SUBTASK,
            updateMetadata: {
              numberValue: 1,
              stringValue: 'a'
            }
          };
        }
      },
      {
        subtask: USER_TEST_FILE_PURPOSE_PART_B_SUBTASK,
        fn: async (input) => {
          // TODO: pull from the file or something

          return {
            completion: USER_TEST_FILE_PURPOSE_PART_B_SUBTASK,
            updateMetadata: {
              numberValue: 2,
              stringValue: 'b'
            }
          };
        }
      }
    ]
  };

  const processors: StorageFileProcessingPurposeSubtaskProcessorConfig[] = [testFileProcessorConfig];

  return storageFileProcessingNotificationTaskHandler({
    processors,
    storageFileFirestoreCollections: demoFirebaseServerActionsContext,
    storageAccessor: demoFirebaseServerActionsContext.storageService
  });
}
