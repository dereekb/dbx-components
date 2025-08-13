import { Maybe } from '@dereekb/util';
import { NotificationSendType, NotificationTaskCheckpointString } from './notification';
import { CreateNotificationTemplate, createNotificationTemplate, CreateNotificationTemplateInput } from './notification.create';
import { FirestoreModelKey } from '../../common';
import { DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY } from './notification.id';

/**
 * Template use for creating a new Notification task.
 */
export type CreateNotificationTaskTemplate = CreateNotificationTemplate;

export interface CreateNotificationTaskTemplateInput extends Omit<CreateNotificationTemplateInput, 'notificationModel' | 'st' | 'recipients' | 'r' | 'rf' | 'sendType' | 'st'>, Partial<Pick<CreateNotificationTemplateInput, 'notificationModel'>> {
  /**
   * Corresponds with the tpr field in the Notification.
   *
   * Provide this if some checkpoints have already been completed.
   */
  readonly completedCheckpoints?: Maybe<NotificationTaskCheckpointString[]>;
}

/**
 * Creates a notification template for a Notification with the task type.
 *
 * @param input
 * @returns
 */
export function createNotificationTaskTemplate(input: CreateNotificationTaskTemplateInput): CreateNotificationTaskTemplate {
  return createNotificationTemplate({
    ...input,
    notificationModel: input.notificationModel ?? DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY,
    tpr: input.completedCheckpoints ?? input.tpr,
    sendType: NotificationSendType.TASK_NOTIFICATION,
    st: undefined,
    rf: undefined,
    recipients: undefined,
    r: undefined
  });
}
