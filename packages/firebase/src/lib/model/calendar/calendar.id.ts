import { type FlatFirestoreModelKey, inferKeyFromTwoWayFlatFirestoreModelKey, twoWayFlatFirestoreModelKey, type FirestoreModelId, type FirestoreModelKey } from '../../common';

/**
 * @module calendar.id
 *
 * Identity types and id-generation patterns for the Calendar model.
 *
 * A Calendar that belongs to another model uses that model's key, two-way flat encoded, as its own document
 * id — the same mechanism {@link StorageFileGroupId} uses. The profile "pr/abc123" therefore owns the
 * calendar "cal/pr_abc123", loadable directly with no query and no lookup field.
 *
 * There is deliberately NO `modelKey` field on the Calendar itself: the id IS the association, and a
 * queryable duplicate of it would be a second source of truth for the same fact.
 */

/**
 * Firestore document id for a Calendar.
 *
 * For a Calendar that belongs to a model this is a {@link FlatFirestoreModelKey}; for a standalone
 * calendar it is an arbitrary id.
 */
export type CalendarId = FirestoreModelId;

/**
 * Full Firestore document key (collection path + id) for a Calendar.
 */
export type CalendarKey = FirestoreModelKey;

/**
 * Identifier for a single event embedded in a Calendar. Unique within its own calendar only.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:calendar
 */
export type CalendarEventId = string;

/**
 * Identifier for a single expanded OCCURRENCE of a calendar event.
 *
 * A one-off event's occurrence key is its {@link CalendarEventId}. A recurring event's occurrence key is
 * its id plus the occurrence's unix seconds, which is what keeps a published VEVENT's UID stable across
 * republishes of the same series.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:calendar
 */
export type CalendarOccurrenceKey = string;

/**
 * Separates a recurring event's id from its occurrence's unix seconds within a {@link CalendarOccurrenceKey}.
 */
export const CALENDAR_OCCURRENCE_KEY_SEPARATOR = '_';

/**
 * Arbitrary string describing the kind of calendar a document is, driving its retention policy and its ICS
 * emission config through the app's {@link CalendarTypeConfig} registry.
 *
 * Open by design, exactly like {@link StorageFilePurpose}: a downstream app registers its own types without
 * a library change.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:calendar
 */
export type CalendarType = string;

/**
 * Arbitrary extension data attached to a Calendar or one of its events.
 *
 * THIS IS AN ICS EXTENSION LEVER, not general-purpose storage. Every entry is emitted as an "X-" property
 * on the corresponding VCALENDAR/VEVENT, so values are STRINGS ONLY — an ICS property value simply is text.
 * Anything structured is JSON-stringified into a single key by the caller.
 *
 * Keys are stored WITHOUT the "X-" prefix and are prefixed at emit time, which is what makes it impossible
 * for a stored key to shadow a standard property like SUMMARY.
 */
export type CalendarExtensionData = Readonly<Record<string, string>>;

/**
 * The status of a calendar event, mirroring RFC 5545 3.8.1.11.
 *
 * CANCELLED is the only way a published feed communicates a deletion to a client that already holds the
 * event, so removing an event tombstones it as CANCELLED rather than splicing it out.
 */
export enum CalendarEventStatus {
  TENTATIVE = 'TENTATIVE',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED'
}

/**
 * Encodes a {@link FirestoreModelKey} into the {@link CalendarId} of the Calendar that belongs to it.
 *
 * @example
 * ```ts
 * const calendarId = calendarIdForModel('pr/abc123'); // 'pr_abc123'
 * ```
 */
export const calendarIdForModel = twoWayFlatFirestoreModelKey;

/**
 * Decodes a {@link CalendarId} back into the {@link FirestoreModelKey} of the model it belongs to.
 *
 * Returns a meaningless value for a standalone calendar with a random id, exactly as
 * {@link inferStorageFileGroupRelatedModelKey} does.
 *
 * @example
 * ```ts
 * const modelKey = inferCalendarRelatedModelKey('pr_abc123'); // 'pr/abc123'
 * ```
 */
export const inferCalendarRelatedModelKey = inferKeyFromTwoWayFlatFirestoreModelKey;

/**
 * A Calendar id that encodes the key of the model it belongs to.
 */
export type CalendarModelId = FlatFirestoreModelKey;
