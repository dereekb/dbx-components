import { computeNextFreeIndexFunction, type Maybe, ModelRelationUtility, readIndexNumber, type RelationChange } from '@dereekb/util';
import { type Notification, type NotificationBox, NotificationRecipientSendFlag, type NotificationSendFlags, NotificationSendState } from './notification';
import { type NotificationBoxRecipient } from './notification.config';

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
export interface ChangeRecipientInNotificationBoxInput {
  /**
   * Relation change to perform
   */
  readonly change: RelationChange;
  /**
   * Recipient to change
   */
  readonly recipient: Partial<NotificationBoxRecipient>;
  readonly recipientsRef: Pick<NotificationBox, 'r'>;
}

export function changeRecipientInNotificationBox(input: ChangeRecipientInNotificationBoxInput): NotificationBoxRecipient[] {
  const { change, recipient, recipientsRef } = input;
  const { uid } = recipient;
  let { i } = recipient;

  // look up the user's index if it isn't provided
  if (i == null && uid) {
    i = recipientsRef.r.find((x) => x.uid === uid)?.i;
  }

  // set the next/default index
  if (i == null) {
    i = computeNextFreeIndexFunction(readIndexNumber)(recipientsRef.r);
  }

  const fullRecipient = {
    ...recipient,
    i
  } as NotificationBoxRecipient;

  const mods: NotificationBoxRecipient[] = [fullRecipient];
  return ModelRelationUtility.modifyCollection<NotificationBoxRecipient>(input.recipientsRef.r, change, mods, {
    readKey: readIndexNumber,
    merge: (a, b) => {
      return {
        ...b,
        ...a,
        c: {
          ...a.c,
          ...b.c
        }
      };
    }
  });
}
