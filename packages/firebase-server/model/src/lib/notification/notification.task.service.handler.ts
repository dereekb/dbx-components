import { NotificationTaskType, NotificationTask, NotificationTaskCheckpointString, NotificationItemMetadata, NotificationTaskServiceHandleNotificationTaskResult } from '@dereekb/firebase';
import { NotificationTaskService, NotificationTaskServiceTaskHandler, NotificationTaskServiceTaskHandlerFunction } from './notification.task.service';
import { separateValues } from '@dereekb/util';

/**
 * A checkpoint/function pair used for responding to a specific checkpoint.
 */
export interface NotificationTaskServiceTaskHandlerFlowEntry<D extends NotificationItemMetadata = {}, S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString> {
  /**
   * Checkpoint this flow entry represents.
   */
  readonly checkpoint?: S;
  /**
   * The handler function.
   */
  readonly fn: NotificationTaskServiceTaskHandlerFunction<D>;
}

export interface NotificationTaskServiceTaskHandlerConfig<D extends NotificationItemMetadata = {}, S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString> {
  readonly type: NotificationTaskType;
  /**
   * The order/flow of checkpoints and handler functions.
   *
   * When handling a notification task, if the checkpoint has already been completed then entry will be skipped.
   */
  readonly flow: NotificationTaskServiceTaskHandlerFlowEntry<D, S>[];
}

export interface NotificationTaskServiceConfig {
  /**
   * List of NotificationTaskTypes for the app. Used for verifying that all NotificationTaskTypes are handled.
   */
  readonly validate?: NotificationTaskType[];
  /**
   * List of handlers for NotificationTaskTypes.
   */
  readonly handlers: NotificationTaskServiceTaskHandlerConfig<any, any>[];
}

/**
 * A basic NotificationTaskService implementation.
 */
export function notificationTaskService(config: NotificationTaskServiceConfig): NotificationTaskService {
  const { handlers: inputHandlers } = config;

  const handlers: Record<NotificationTaskType, NotificationTaskServiceTaskHandler> = {};

  inputHandlers.forEach((handlerConfig) => {
    const { type } = handlerConfig;
    handlers[type] = handlerForConfig(handlerConfig);
  });

  function handlerForConfig(handlerConfig: NotificationTaskServiceTaskHandlerConfig<any, any>): NotificationTaskServiceTaskHandler {
    const { flow: inputFlows } = handlerConfig;
    const { included: checkpointFlows, excluded: nonCheckpointFlows } = separateValues(inputFlows, (x) => x.checkpoint != null);

    if (inputFlows.length === 0) {
      throw new Error('notificationTaskService(): NotificationTaskServiceTaskHandlerConfig must have at least one flow entry.');
    } else if (nonCheckpointFlows.length > 1) {
      throw new Error('notificationTaskService(): NotificationTaskServiceTaskHandlerConfig must not have more than one non-checkpoint flow.');
    }

    return {
      handleNotificationTask: async (notificationTask: NotificationTask) => {
        const { checkpoints: completedCheckpoints } = notificationTask;
        let fn: NotificationTaskServiceTaskHandlerFunction | undefined;

        switch (completedCheckpoints.length) {
          case 0:
            fn = (nonCheckpointFlows[0] ?? checkpointFlows[0])?.fn;
            break;
          default:
            const completedCheckpointsSet = new Set(completedCheckpoints);
            /**
             * Find the next flow function that hasn't had its checkpoint completed yet.
             */
            const nextCheckpoint = checkpointFlows.find((x) => !completedCheckpointsSet.has(x.checkpoint as string));
            fn = nextCheckpoint?.fn;
            break;
        }

        let result: NotificationTaskServiceHandleNotificationTaskResult;

        if (fn) {
          result = await fn(notificationTask);
        } else {
          result = {
            completion: true // if there are no functions remaining, then the task is complete
          };
        }

        return result;
      }
    };
  }

  return {
    isKnownNotificationTaskType: (notificationTaskType: NotificationTaskType) => {
      return handlers[notificationTaskType] !== undefined;
    },
    taskHandlerForNotificationTaskType: (notificationTaskType: NotificationTaskType) => handlers[notificationTaskType]
  };
}
