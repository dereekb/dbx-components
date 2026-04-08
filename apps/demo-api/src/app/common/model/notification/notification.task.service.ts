import { type NotificationTaskService, type NotificationTaskServiceTaskHandlerConfig, type StorageFileProcessingPurposeSubtaskProcessorConfig, notificationTaskService, storageFileProcessingNotificationTaskHandler } from '@dereekb/firebase-server/model';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import {
  ALL_NOTIFICATION_TASK_TYPES,
  EXAMPLE_NOTIFICATION_TASK_PART_A_COMPLETE_VALUE,
  EXAMPLE_NOTIFICATION_TASK_PART_B_COMPLETE_VALUE,
  EXAMPLE_NOTIFICATION_TASK_TYPE,
  EXAMPLE_UNIQUE_NOTIFICATION_TASK_TYPE,
  type ExampleNotificationTaskCheckpoint,
  type ExampleNotificationTaskData,
  type ExampleUniqueNotificationTaskCheckpoint,
  type ExampleUniqueNotificationTaskData,
  USER_TEST_FILE_PURPOSE,
  USER_TEST_FILE_PURPOSE_PART_A_SUBTASK,
  USER_TEST_FILE_PURPOSE_PART_B_SUBTASK,
  type UserTestFileProcessingSubtask,
  type UserTestFileProcessingSubtaskMetadata
} from 'demo-firebase';
import { filterUndefinedValues, type Maybe } from '@dereekb/util';
import { toJsDate } from '@dereekb/date';
import { ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES, type NotificationTaskServiceHandleNotificationTaskResult } from '@dereekb/firebase';

/**
 * Builds the NotificationTaskService for the demo API, registering all task handlers
 * including the example multi-step task, the unique task variant, and storage file processing.
 *
 * @param demoFirebaseServerActionsContext - server actions context providing Firestore and storage access
 * @returns a configured NotificationTaskService with all demo task handlers
 */
export function demoNotificationTaskServiceFactory(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext): NotificationTaskService {
  /**
   * The result data parsed from the datastore should be strings only, so restore the values to their expected types.
   *
   * @param result
   * @returns
   */
  function _parseResult(result?: Maybe<NotificationTaskServiceHandleNotificationTaskResult<ExampleNotificationTaskData>>) {
    return result != null
      ? filterUndefinedValues({
          completion: result?.completion,
          updateMetadata: result?.updateMetadata,
          delayUntil: result?.delayUntil ? toJsDate(result?.delayUntil) : undefined,
          canRunNextCheckpoint: result?.canRunNextCheckpoint
        })
      : undefined;
  }

  function buildResult(taskData: Maybe<ExampleNotificationTaskData>, defaultResult: NotificationTaskServiceHandleNotificationTaskResult<ExampleNotificationTaskData>): NotificationTaskServiceHandleNotificationTaskResult<ExampleNotificationTaskData> {
    let result: NotificationTaskServiceHandleNotificationTaskResult<ExampleNotificationTaskData>;

    if (taskData?.mergeResultWithDefaultResult) {
      result = {
        ...defaultResult,
        ..._parseResult(taskData?.result)
      };
    } else {
      result = _parseResult(taskData?.result) ?? defaultResult;
    }

    return result;
  }

  const exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [
      {
        checkpoint: 'part_a',
        fn: async (notificationTask) => {
          // Do something...

          return buildResult(notificationTask.data, {
            completion: 'part_a',
            updateMetadata: {
              value: EXAMPLE_NOTIFICATION_TASK_PART_A_COMPLETE_VALUE
            }
          });
        }
      },
      {
        checkpoint: 'part_b',
        fn: async (notificationTask) => {
          // Do something else...

          return buildResult(notificationTask.data, {
            completion: 'part_b',
            updateMetadata: {
              value: EXAMPLE_NOTIFICATION_TASK_PART_B_COMPLETE_VALUE
            }
          });
        }
      },
      {
        checkpoint: 'part_c',
        fn: async (notificationTask) => {
          // Do final step...

          return buildResult(notificationTask.data, {
            completion: true
          });
        }
      }
    ]
  };

  const exampleUniqueNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<ExampleUniqueNotificationTaskData, ExampleUniqueNotificationTaskCheckpoint> = {
    type: EXAMPLE_UNIQUE_NOTIFICATION_TASK_TYPE,
    flow: [
      {
        checkpoint: 'part_a',
        fn: async (_notificationTask) => {
          // Do something...

          return {
            completion: 'part_a'
          };
        }
      },
      {
        checkpoint: 'part_b',
        fn: async (_notificationTask) => {
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

/**
 * Creates the storage file processing notification task handler for the demo API.
 * Configures subtask processors for user test file uploads with multi-step processing flow.
 *
 * @param demoFirebaseServerActionsContext - server actions context providing storage and Firestore access
 * @returns a notification task handler config for storage file processing
 */
export function demoStorageFileProcessingNotificationTaskHandler(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext) {
  const testFileProcessorConfig: StorageFileProcessingPurposeSubtaskProcessorConfig<UserTestFileProcessingSubtaskMetadata, UserTestFileProcessingSubtask> = {
    target: USER_TEST_FILE_PURPOSE,
    flow: [
      {
        subtask: USER_TEST_FILE_PURPOSE_PART_A_SUBTASK,
        fn: async (input) => {
          const delayUntil = input.subtaskData?.delayUntil;
          const canRunNextCheckpoint = input.subtaskData?.canRunNextCheckpoint ?? false;

          // TODO: pull from the file or something

          return {
            completion: USER_TEST_FILE_PURPOSE_PART_A_SUBTASK,
            canRunNextCheckpoint,
            delayUntil,
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

          const canRunNextCheckpoint = input.subtaskData?.canRunNextCheckpoint ?? false;

          return {
            completion: USER_TEST_FILE_PURPOSE_PART_B_SUBTASK,
            canRunNextCheckpoint,
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
