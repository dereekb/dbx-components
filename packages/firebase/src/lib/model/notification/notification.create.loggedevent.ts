/**
 * @module notification.create.loggedevent
 *
 * Convenience factory for creating logged-event notification templates.
 * Wraps {@link createNotificationTemplate} with logged-event defaults — `LOGGED_EVENT` send type, no
 * recipients, and a required `notificationModel` since logged events are always model-scoped.
 */
import { NotificationSendType } from './notification';
import { type CreateNotificationTemplate, createNotificationTemplate, type CreateNotificationTemplateInput } from './notification.create';

/**
 * Template for creating a logged-event {@link Notification}. Alias for {@link CreateNotificationTemplate}.
 */
export type CreateNotificationLoggedEventTemplate = CreateNotificationTemplate;

/**
 * Simplified input for creating logged-event notification templates. Omits fields not applicable to
 * logged events (recipients, send type, recipient flags) and requires `notificationModel` since
 * logged events are always associated with a target model.
 */
export type CreateNotificationLoggedEventTemplateInput = Omit<CreateNotificationTemplateInput, 'st' | 'recipients' | 'r' | 'rf' | 'sendType'>;

/**
 * Creates a {@link CreateNotificationLoggedEventTemplate} with `LOGGED_EVENT` send type and no recipients.
 *
 * The persisted {@link Notification} is born with `d: true` and `NO_TRY` channel states (set by
 * {@link createNotificationDocumentPair}), so it is invisible to the send loop and is archived to
 * {@link NotificationLoggedEventDay} during cleanup.
 *
 * @param input - Logged-event template input parameters.
 * @returns The configured logged-event notification template.
 * @throws {Error} When `notificationModel` is not provided.
 *
 * @example
 * ```ts
 * const template = createNotificationLoggedEventTemplate({
 *   type: 'workerClockedIn',
 *   notificationModel: 'project/abc123',
 *   data: { workerId: 'w_001', at: new Date().toISOString() }
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createNotificationLoggedEventTemplate(input: CreateNotificationLoggedEventTemplateInput): CreateNotificationLoggedEventTemplate {
  if (!input.notificationModel) {
    throw new Error('Must provide a notificationModel when creating a logged-event notification template.');
  }

  return createNotificationTemplate({
    ...input,
    sendType: NotificationSendType.LOGGED_EVENT,
    st: undefined,
    rf: undefined,
    recipients: undefined,
    r: undefined
  });
}
