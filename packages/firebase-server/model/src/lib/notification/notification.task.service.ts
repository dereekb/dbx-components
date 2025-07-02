import { NotificationTaskType, NotificationTask, NotificationTaskCheckpointString, NotificationItemMetadata, NotificationTaskServiceTaskHandlerCompletionType } from '@dereekb/firebase';
import { ArrayOrValue } from '@dereekb/util';

/**
 * Provides a reference to a NotificationTaskService instance.
 */
export interface NotificationTaskServiceRef {
  readonly notificationTaskService: NotificationTaskService;
}

/**
 * Service dedicated to providing access to NotificationMessageFunctionFactory values for specific NotificationTemplateTypes.
 */
export abstract class NotificationTaskService {
  /**
   * Returns true if the input NotificationTaskType is known and can be handled by the NotificationTaskService.
   */
  abstract isKnownNotificationTaskType(notificationTaskType: NotificationTaskType): boolean;
  /**
   * Returns the NotificationTaskServiceTaskHandler for the input NotificationTaskType.
   */
  abstract taskHandlerForNotificationTaskType(notificationTaskType: NotificationTaskType): NotificationTaskServiceTaskHandler;
}

export interface NotificationTaskServiceHandleNotificationTaskResult<D extends NotificationItemMetadata = {}> {
  /**
   * Completion type for the task result.
   */
  readonly completion: NotificationTaskServiceTaskHandlerCompletionType;
  /**
   * Updates the metadata for the notification item.
   */
  readonly updateMetadata?: Partial<D>;
}

/**
 * Service dedicated to handling NotificationTask values.
 */
export interface NotificationTaskServiceTaskHandler {
  /**
   * Handles the input NotificationTask.
   *
   * Can throw an error if the task cannot be handled due to a configuration error.
   */
  handleNotificationTask<D extends NotificationItemMetadata>(notificationTask: NotificationTask<D>): Promise<NotificationTaskServiceHandleNotificationTaskResult<D>>;
}
