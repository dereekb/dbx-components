import { computeNextFreeIndexFunction, type Maybe, ModelRelationUtility, readIndexNumber, RelationChange } from '@dereekb/util';
import { type Notification, type NotificationBox, NotificationRecipientSendFlag, type NotificationSendFlags, NotificationSendState, NotificationUser } from './notification';
import { NotificationUserNotificationBoxRecipientConfig, type NotificationBoxRecipient, NotificationBoxRecipientFlag } from './notification.config';
import { NotificationBoxId } from './notification.id';

// MARK: Notification
/**
 * Returns true if the notification's send types are all marked as sent.
 *
 * @param input
 * @returns
 */
export function notificationSendFlagsImplyIsComplete(input: NotificationSendFlags): boolean {
  return isCompleteNotificationSendState(input.es) && isCompleteNotificationSendState(input.ps) && isCompleteNotificationSendState(input.ts);
}

/**
 * Returns true if the state implies completion of sending (not necessarily success, but that attempts to send are done)
 *
 * @param input
 * @returns
 */
export function isCompleteNotificationSendState(input: NotificationSendState): boolean {
  let isComplete = false;

  switch (input) {
    case NotificationSendState.NONE:
    case NotificationSendState.NO_TRY:
    case NotificationSendState.SENT:
    case NotificationSendState.SKIPPED:
      isComplete = true;
      break;
    default:
      isComplete = false;
      break;
  }

  return isComplete;
}

export interface AllowedNotificationRecipients {
  readonly canSendToGlobalRecipients: boolean;
  readonly canSendToBoxRecipients: boolean;
  readonly canSendToExplicitRecipients: boolean;
}

/**
 * Returns a AllowedNotificationRecipients from the input NotificationRecipientSendFlag.
 *
 * @param flag
 * @returns
 */
export function allowedNotificationRecipients(flag?: Maybe<NotificationRecipientSendFlag>): AllowedNotificationRecipients {
  let canSendToGlobalRecipients: boolean = true;
  let canSendToBoxRecipients: boolean = true;
  let canSendToExplicitRecipients: boolean = true;

  switch (flag) {
    case NotificationRecipientSendFlag.SKIP_NOTIFICATION_BOX_RECIPIENTS:
      canSendToBoxRecipients = false;
      break;
    case NotificationRecipientSendFlag.SKIP_GLOBAL_RECIPIENTS:
      canSendToGlobalRecipients = false;
      break;
    case NotificationRecipientSendFlag.ONLY_EXPLICIT_RECIPIENTS:
      canSendToBoxRecipients = false;
      canSendToGlobalRecipients = false;
      break;
    case NotificationRecipientSendFlag.ONLY_GLOBAL_RECIPIENTS:
      canSendToBoxRecipients = false;
      canSendToExplicitRecipients = false;
      break;
    case NotificationRecipientSendFlag.NORMAL:
    default:
      // all true
      break;
  }

  return {
    canSendToGlobalRecipients,
    canSendToBoxRecipients,
    canSendToExplicitRecipients
  };
}

// MARK: NotificationWeek
/**
 * Whether or not the Notification should be saved to the NotificationWeek.
 *
 * A Notification should only be saved when the notification can be sent to box recipients.
 *
 * @param notification
 * @returns
 */
export function shouldSaveNotificationToNotificationWeek(notification: Notification): boolean {
  return allowedNotificationRecipients(notification.rf).canSendToBoxRecipients;
}

// MARK: NotificationBox
export function mergeNotificationUserNotificationBoxRecipientConfigs(a: NotificationUserNotificationBoxRecipientConfig, b: Partial<NotificationUserNotificationBoxRecipientConfig>): NotificationUserNotificationBoxRecipientConfig {
  return {
    ...mergeNotificationBoxRecipients(a, b),
    // retain the following states always
    f: a.f === NotificationBoxRecipientFlag.OPT_OUT ? a.f : b.f ?? a.f, // do not override if marked OPT OUT
    nb: a.nb,
    rm: a.rm,
    ns: a.ns,
    lk: a.lk,
    bk: a.bk
  };
}

export function mergeNotificationBoxRecipients<T extends NotificationBoxRecipient>(a: T, b: Partial<T>): T {
  return {
    ...a,
    ...b,
    // configs should be merged/ovewritten
    c: {
      ...a.c,
      ...b.c
    }
  };
}
