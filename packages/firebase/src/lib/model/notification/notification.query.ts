/**
 * @module notification.query
 *
 * Firestore query constraint builders for notification model documents.
 * Used by the server-side action service to find documents that need processing.
 */
import { type FirestoreQueryConstraint, where } from '../../common/firestore';
import { type NotificationSummary, type Notification, type NotificationBox, type NotificationUser } from './notification';
import { toISODateString } from '@dereekb/date';
import { type NotificationBoxSendExclusion } from './notification.id';
import { type ArrayOrValue } from '@dereekb/util';

// MARK: NotificationUser
/**
 * Query constraints for finding {@link NotificationUser} documents that have pending config syncs (`ns == true`).
 *
 * Used by the server to discover users whose configs need to be synced to their NotificationBox recipients.
 */
export function notificationUsersFlaggedForNeedsSyncQuery(): FirestoreQueryConstraint[] {
  return [where<NotificationUser>('ns', '==', true)];
}

/**
 * Query constraints for finding {@link NotificationUser} documents that have any of the given exclusion IDs in their `x` array.
 *
 * @param exclusionId - one or more box IDs or collection name prefixes to match against
 */
export function notificationUserHasExclusionQuery(exclusionId: ArrayOrValue<NotificationBoxSendExclusion>): FirestoreQueryConstraint[] {
  return [where<NotificationUser>('x', 'array-contains-any', exclusionId)];
}

// MARK: NotificationSummary
/**
 * Query constraints for finding {@link NotificationSummary} documents that need server-side initialization (`s == true`).
 */
export function notificationSummariesFlaggedForNeedsInitializationQuery(): FirestoreQueryConstraint[] {
  return [where<NotificationSummary>('s', '==', true)];
}

// TODO: Also grab summaries that are flagged as invalid and use to delete/cleanup as needed.

// MARK: NotificationBox
/**
 * Query constraints for finding {@link NotificationBox} documents that need server-side initialization (`s == true`).
 */
export function notificationBoxesFlaggedForNeedsInitializationQuery(): FirestoreQueryConstraint[] {
  return [where<NotificationBox>('s', '==', true)];
}

/**
 * Query constraints for finding {@link NotificationBox} documents flagged as invalid (`fi == true`).
 *
 * Used by the server to clean up boxes that could not be initialized.
 */
export function notificationBoxesFlaggedInvalidQuery(): FirestoreQueryConstraint[] {
  return [where<NotificationBox>('fi', '==', true)];
}

// MARK: Notification
/**
 * Query constraints for finding {@link Notification} documents that are ready to be sent
 * (not done and `sat` is in the past).
 *
 * This is the primary query used by the send queue processor.
 *
 * @param now - reference time for the `sat` comparison (defaults to current time)
 */
export function notificationsPastSendAtTimeQuery(now = new Date()): FirestoreQueryConstraint[] {
  return [where<Notification>('d', '==', false), where<Notification>('sat', '<=', toISODateString(now))];
}

/**
 * Query constraints for finding {@link Notification} documents marked as done (`d == true`)
 * and ready to be archived to {@link NotificationWeek} and then deleted.
 */
export function notificationsReadyForCleanupQuery(): FirestoreQueryConstraint[] {
  return [
    where<Notification>('d', '==', true)
    // orderByDocumentId('asc') // todo: consider using orderby to get notificationboxes sorted
  ];
}
