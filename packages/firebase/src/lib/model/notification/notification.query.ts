/**
 * @module notification.query
 *
 * Firestore query constraint builders for notification model documents.
 * Used by the server-side action service to find documents that need processing.
 */
import { type FirestoreQueryConstraint, where, whereDocumentId } from '../../common/firestore';
import { type NotificationSummary, type Notification, type NotificationBox, type NotificationUser } from './notification';
import { toISODateString, toISO8601DayStringForUTC } from '@dereekb/date';
import { type NotificationBoxSendExclusion } from './notification.id';
import { addDays } from 'date-fns';
import { type ArrayOrValue } from '@dereekb/util';

// MARK: NotificationUser
/**
 * Query constraints for finding {@link NotificationUser} documents that have pending config syncs (`ns == true`).
 *
 * Used by the server to discover users whose configs need to be synced to their NotificationBox recipients.
 *
 * @returns array of Firestore query constraints filtering for users needing sync
 */
export function notificationUsersFlaggedForNeedsSyncQuery(): FirestoreQueryConstraint[] {
  return [where<NotificationUser>('ns', '==', true)];
}

/**
 * Query constraints for finding {@link NotificationUser} documents that have any of the given exclusion IDs in their `x` array.
 *
 * @param exclusionId - one or more box IDs or collection name prefixes to match against
 * @returns array of Firestore query constraints filtering for users with matching exclusions
 */
export function notificationUserHasExclusionQuery(exclusionId: ArrayOrValue<NotificationBoxSendExclusion>): FirestoreQueryConstraint[] {
  return [where<NotificationUser>('x', 'array-contains-any', exclusionId)];
}

// MARK: NotificationSummary
/**
 * Query constraints for finding {@link NotificationSummary} documents that need server-side initialization (`s == true`).
 *
 * @returns array of Firestore query constraints filtering for summaries needing initialization
 */
export function notificationSummariesFlaggedForNeedsInitializationQuery(): FirestoreQueryConstraint[] {
  return [where<NotificationSummary>('s', '==', true)];
}

// TODO: Also grab summaries that are flagged as invalid and use to delete/cleanup as needed.

// MARK: NotificationBox
/**
 * Query constraints for finding {@link NotificationBox} documents that need server-side initialization (`s == true`).
 *
 * @returns array of Firestore query constraints filtering for boxes needing initialization
 */
export function notificationBoxesFlaggedForNeedsInitializationQuery(): FirestoreQueryConstraint[] {
  return [where<NotificationBox>('s', '==', true)];
}

/**
 * Query constraints for finding {@link NotificationBox} documents flagged as invalid (`fi == true`).
 *
 * Used by the server to clean up boxes that could not be initialized.
 *
 * @returns array of Firestore query constraints filtering for boxes flagged as invalid
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
 * @returns array of Firestore query constraints filtering for notifications past their scheduled send time
 */
export function notificationsPastSendAtTimeQuery(now = new Date()): FirestoreQueryConstraint[] {
  return [where<Notification>('d', '==', false), where<Notification>('sat', '<=', toISODateString(now))];
}

/**
 * Query constraints for finding {@link Notification} documents marked as done (`d == true`)
 * and ready to be archived to {@link NotificationWeek} and then deleted.
 *
 * @returns array of Firestore query constraints filtering for completed notifications ready to archive
 */
export function notificationsReadyForCleanupQuery(): FirestoreQueryConstraint[] {
  return [
    where<Notification>('d', '==', true)
    // orderByDocumentId('asc') // todo: consider using orderby to get notificationboxes sorted
  ];
}

// MARK: NotificationLoggedEventDay
/**
 * Query constraints for finding {@link NotificationLoggedEventDay} documents whose ISO day string
 * document ID is older than `now - retentionDays`.
 *
 * Intended for use against the {@link NotificationLoggedEventDayFirestoreCollectionGroup} during
 * scheduled retention cleanup. Documents older than the cutoff (and their nested page subcollection
 * contents) should be deleted.
 *
 * @param now - reference time for the cutoff (defaults to current time)
 * @param retentionDays - number of days of history to retain; days strictly older than `now - retentionDays` match
 * @returns array of Firestore query constraints filtering by document ID
 */
export function notificationLoggedEventDaysOlderThanQuery(now: Date = new Date(), retentionDays: number): FirestoreQueryConstraint[] {
  const cutoff = toISO8601DayStringForUTC(addDays(now, -retentionDays));
  return [whereDocumentId('<', cutoff)];
}
