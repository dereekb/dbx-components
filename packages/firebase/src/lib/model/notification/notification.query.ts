import { type FirestoreQueryConstraint, where } from '../../common/firestore';
import { type Notification, type NotificationBox } from './notification';
import { toISODateString } from '@dereekb/date';

// MARK: NotificationBox
/**
 * Query for notificationBoxes that are flagged for initialization.
 *
 * @param now
 * @returns
 */
export function notificationBoxesFlaggedForNeedsInitializationQuery(): FirestoreQueryConstraint[] {
  return [where<NotificationBox>('s', '==', true)];
}

/**
 * Query for notificationBoxes that are flagged as invalid.
 *
 * @param now
 * @returns
 */
export function notificationBoxesFlaggedInvalidQuery(): FirestoreQueryConstraint[] {
  return [where<NotificationBox>('fi', '==', true)];
}

// MARK: Notifcation
/**
 * Query for notifications that are not done and the send at time is in the past.
 *
 * @param now
 * @returns
 */
export function notificationsPastSendAtTimeQuery(now = new Date()): FirestoreQueryConstraint[] {
  return [where<Notification>('d', '==', false), where<Notification>('sat', '<=', toISODateString(now))];
}

/**
 * Query for notifications that are marked ready for cleanup/deletion.
 *
 * @param now
 * @returns
 */
export function notificationsReadyForCleanupQuery(): FirestoreQueryConstraint[] {
  return [
    where<Notification>('d', '==', true)
    // orderByDocumentId('asc') // todo: consider using orderby to get notificationboxes sorted
  ];
}
