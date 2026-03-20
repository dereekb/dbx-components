import { type NotificationTaskType, type NotificationTask, type NotificationItemMetadata, type NotificationTaskServiceHandleNotificationTaskResult } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

/**
 * Provides a reference to a NotificationTaskService instance.
 */
export interface NotificationTaskServiceRef {
  readonly notificationTaskService: NotificationTaskService;
}

/**
 * Abstract service that dispatches {@link NotificationTask} instances to the appropriate
 * {@link NotificationTaskServiceTaskHandler} based on the task's type.
 *
 * Implementations register handlers for each known {@link NotificationTaskType} and route
 * incoming tasks during the notification send pipeline's task-processing phase.
 *
 * @see {@link notificationTaskService} for the default implementation.
 */
export abstract class NotificationTaskService {
  /**
   * Returns true if the input NotificationTaskType is known and can be handled by the NotificationTaskService.
   */
  abstract isKnownNotificationTaskType(notificationTaskType: NotificationTaskType): boolean;
  /**
   * Returns the NotificationTaskServiceTaskHandler for the input NotificationTaskType.
   */
  abstract taskHandlerForNotificationTaskType(notificationTaskType: NotificationTaskType): Maybe<NotificationTaskServiceTaskHandler>;
}

/**
 * Function that processes a single {@link NotificationTask} and returns a result describing
 * the completion state, any checkpoint progress, and optional metadata updates.
 *
 * @template D - the task's metadata type
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type NotificationTaskServiceTaskHandlerFunction<D extends NotificationItemMetadata = {}> = (notificationTask: NotificationTask<D>) => Promise<NotificationTaskServiceHandleNotificationTaskResult<D>>;

/**
 * Service dedicated to handling NotificationTask values.
 */
export interface NotificationTaskServiceTaskHandler {
  /**
   * Handles the input NotificationTask.
   *
   * Can throw an error if the task cannot be handled due to a configuration error.
   */
  readonly handleNotificationTask: NotificationTaskServiceTaskHandlerFunction;
}
