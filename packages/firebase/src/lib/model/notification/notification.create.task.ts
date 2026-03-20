/**
 * @module notification.create.task
 *
 * Convenience factory for creating task-type notification templates.
 * Wraps {@link createNotificationTemplate} with task-specific defaults.
 */
import { type Maybe } from '@dereekb/util';
import { NotificationSendType, type NotificationTaskCheckpointString } from './notification';
import { type CreateNotificationTemplate, createNotificationTemplate, type CreateNotificationTemplateInput } from './notification.create';
import { DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY } from './notification.id';

/**
 * Template for creating a task-type {@link Notification}. Alias for {@link CreateNotificationTemplate}.
 */
export type CreateNotificationTaskTemplate = CreateNotificationTemplate;

/**
 * Simplified input for creating task notification templates. Omits fields not applicable to tasks
 * (recipients, send type, recipient flags) and makes `notificationModel` optional.
 *
 * When `notificationModel` is omitted, defaults to {@link DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY}.
 */
export interface CreateNotificationTaskTemplateInput extends Omit<CreateNotificationTemplateInput, 'notificationModel' | 'st' | 'recipients' | 'r' | 'rf' | 'sendType' | 'st'>, Partial<Pick<CreateNotificationTemplateInput, 'notificationModel'>> {
  /**
   * Corresponds with the tpr field in the Notification.
   *
   * Provide this if some checkpoints have already been completed.
   */
  readonly completedCheckpoints?: Maybe<NotificationTaskCheckpointString[]>;
}

/**
 * Creates a {@link CreateNotificationTaskTemplate} with `TASK_NOTIFICATION` send type and no recipients.
 *
 * @param input - task template input parameters
 * @returns the configured task notification template
 * @throws {Error} When `unique=true` but no `notificationModel` or target model is specified.
 *
 * @example
 * ```ts
 * const template = createNotificationTaskTemplate({
 *   type: 'generate-report',
 *   targetModel: 'project/abc123',
 *   unique: true,
 *   data: { reportType: 'monthly' }
 * });
 * ```
 */
export function createNotificationTaskTemplate(input: CreateNotificationTaskTemplateInput): CreateNotificationTaskTemplate {
  const notificationModel = input.notificationModel ?? DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY;

  const result = createNotificationTemplate({
    ...input,
    notificationModel,
    tpr: input.completedCheckpoints ?? input.tpr,
    sendType: NotificationSendType.TASK_NOTIFICATION,
    st: undefined,
    rf: undefined,
    recipients: undefined,
    r: undefined
  });

  if (!input.notificationModel && !result.n.m && input.unique === true) {
    throw new Error('Must provide a target model when using unique=true for a notification task template. The default result otherwise would be an unintended type-global unique notification task id.');
  }

  return result;
}
