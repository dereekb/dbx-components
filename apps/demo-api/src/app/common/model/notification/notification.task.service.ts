import { NotificationTaskService, NotificationTaskServiceTaskHandlerConfig, notificationTaskService } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_PART_A_COMPLETE_VALUE, EXAMPLE_NOTIFICATION_TASK_PART_B_COMPLETE_VALUE, EXAMPLE_NOTIFICATION_TASK_TYPE, EXAMPLE_UNIQUE_NOTIFICATION_TASK_TYPE, ExampleNotificationTaskCheckpoint, ExampleNotificationTaskData, ExampleUniqueNotificationTaskCheckpoint, ExampleUniqueNotificationTaskData } from 'demo-firebase';
import { Maybe } from '@dereekb/util';
import { toJsDate } from '@dereekb/date';
import { NotificationTaskServiceHandleNotificationTaskResult } from '@dereekb/firebase';

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

  const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [exampleNotificationTaskHandler, exampleUniqueNotificationTaskHandler];

  const notificationSendService: NotificationTaskService = notificationTaskService({
    validate: ALL_NOTIFICATION_TASK_TYPES,
    handlers
  });

  return notificationSendService;
}
