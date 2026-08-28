import { type NotificationTaskService, type NotificationTaskServiceTaskHandlerConfig, type StorageFileProcessingPurposeSubtaskProcessorConfig, formSpaceSubmissionNotificationTaskHandler, notificationTaskService, storageFileProcessingNotificationTaskHandler } from '@dereekb/firebase-server/model';
import { type OpenRouterRunTaskService } from '@dereekb/openrouter/firebase-server';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { demoExampleHandledNotificationTaskHandler } from './handlers/task.handler.example.handled';
import { DEMO_EXAMPLE_FORM_SPACE_PROCESSOR } from '../formspace/handlers/handler.formspace.example';
import { demoCalendarIcsFileProcessingSubtaskProcessor } from './handlers/storagefile/task.handler.storagefile.calendar';
import { demoUserResumeFileProcessingSubtaskProcessor } from './handlers/storagefile/task.handler.storagefile.resume';
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
  DEMO_FORM_SPACE_TYPE_CONFIGS,
  USER_TEST_FILE_PURPOSE,
  USER_TEST_FILE_PURPOSE_PART_A_SUBTASK,
  USER_TEST_FILE_PURPOSE_PART_B_SUBTASK,
  type UserTestFileProcessingSubtask,
  type UserTestFileProcessingSubtaskMetadata
} from 'demo-firebase';
import { filterUndefinedValues, type Maybe } from '@dereekb/util';
import { toJsDate } from '@dereekb/date';
import { ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES, ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES, type NotificationTaskServiceHandleNotificationTaskResult } from '@dereekb/firebase';

/**
 * Builds the NotificationTaskService for the demo API, registering all task handlers
 * including the example multi-step task, the unique task variant, and storage file processing.
 *
 * @param demoFirebaseServerActionsContext - Server actions context providing Firestore and storage access.
 * @returns A configured NotificationTaskService with all demo task handlers.
 */
export function demoNotificationTaskServiceFactory(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext, openRouterRunTaskService: OpenRouterRunTaskService): NotificationTaskService {
  /**
   * The result data parsed from the datastore should be strings only, so restore the values to their expected types.
   *
   * @param result
   * @returns
   */
  function _parseResult(result?: Maybe<NotificationTaskServiceHandleNotificationTaskResult<ExampleNotificationTaskData>>) {
    return result == null
      ? undefined
      : filterUndefinedValues({
          completion: result?.completion,
          updateMetadata: result?.updateMetadata,
          delayUntil: result?.delayUntil ? toJsDate(result?.delayUntil) : undefined,
          canRunNextCheckpoint: result?.canRunNextCheckpoint
        });
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

  const storageFileHandler = demoStorageFileProcessingNotificationTaskHandler(demoFirebaseServerActionsContext, openRouterRunTaskService);
  const exampleHandledHandler = demoExampleHandledNotificationTaskHandler(demoFirebaseServerActionsContext);

  // The FormSpace submission handler dispatches by FormSpaceType, so `validate` is the app's registered
  // type list — an unhandled type is caught here, at wiring time, rather than at the first submission.
  const formSpaceHandler = formSpaceSubmissionNotificationTaskHandler({
    processors: [DEMO_EXAMPLE_FORM_SPACE_PROCESSOR],
    validate: DEMO_FORM_SPACE_TYPE_CONFIGS.map((x) => x.formSpaceType),
    formSpaceFirestoreCollections: demoFirebaseServerActionsContext
  });

  const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [exampleNotificationTaskHandler, exampleUniqueNotificationTaskHandler, storageFileHandler, exampleHandledHandler, formSpaceHandler];

  const notificationSendService: NotificationTaskService = notificationTaskService({
    validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES, ...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES],
    handlers
  });

  return notificationSendService;
}

/**
 * Creates the storage file processing notification task handler for the demo API.
 * Configures subtask processors for user test file uploads with multi-step processing flow.
 *
 * @param demoFirebaseServerActionsContext - Server actions context providing storage and Firestore access.
 * @param openRouterRunTaskService - The OpenRouter queue the `resume` purpose enqueues into and polls.
 * @returns A notification task handler config for storage file processing.
 */
export function demoStorageFileProcessingNotificationTaskHandler(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext, openRouterRunTaskService: OpenRouterRunTaskService) {
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

  // No new NotificationTaskType: the framework's `SFP` storage-file processing task already covers this,
  // so the resume check is one more entry here rather than a task type of its own.
  const resumeFileProcessorConfig = demoUserResumeFileProcessingSubtaskProcessor({ openRouterRunTaskService, profileCollection: demoFirebaseServerActionsContext.profileCollection });

  // The Calendar's published ".ics" rides the same `SFP` storage-file processing task — the whole point of
  // modelling publishing as a StorageFile purpose is that it inherits the retry / stuck-detection / cleanup
  // behaviour instead of growing a pipeline of its own.
  const calendarIcsProcessorConfig = demoCalendarIcsFileProcessingSubtaskProcessor({
    calendarFirestoreCollections: demoFirebaseServerActionsContext,
    storageAccessor: demoFirebaseServerActionsContext.storageService
  });

  const processors: StorageFileProcessingPurposeSubtaskProcessorConfig[] = [testFileProcessorConfig, resumeFileProcessorConfig, calendarIcsProcessorConfig];

  return storageFileProcessingNotificationTaskHandler({
    processors,
    storageFileFirestoreCollections: demoFirebaseServerActionsContext,
    storageAccessor: demoFirebaseServerActionsContext.storageService
  });
}
