import { Maybe } from '@dereekb/util';
import { NotificationSendType, NotificationTaskCheckpointString } from './notification';
import { CreateNotificationTemplate, createNotificationTemplate, CreateNotificationTemplateInput } from './notification.create';

/**
 * Template use for creating a new Notification task.
 */
export type CreateNotificationTaskTemplate = CreateNotificationTemplate;

export interface CreateNotificationTaskTemplateInput extends Omit<CreateNotificationTemplateInput, 'st' | 'recipients' | 'r' | 'rf' | 'sendType' | 'st'> {
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
    tpr: input.completedCheckpoints ?? input.tpr,
    sendType: NotificationSendType.TASK_NOTIFICATION,
    st: undefined,
    rf: undefined,
    recipients: undefined,
    r: undefined
  });
}
