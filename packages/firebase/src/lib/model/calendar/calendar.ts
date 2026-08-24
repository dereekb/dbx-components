import { type FilterUniqueFunction, type Maybe, type Minutes, type NeedsSyncBoolean, type SortCompareFunction, type TimezoneString, type UnixDateTimeSecondsNumber, type WebsiteUrl, UTC_TIMEZONE_STRING, filterUniqueFunction } from '@dereekb/util';
import { sortByDateFunction, type RRuleLines } from '@dereekb/date';
import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import {
  AbstractFirestoreDocument,
  type CollectionReference,
  type FirestoreCollection,
  type FirestoreContext,
  type FirebaseAuthOwnershipKey,
  type SavedToFirestoreIfTrue,
  firestoreDate,
  firestoreModelIdString,
  firestoreModelIdentity,
  firestoreNumber,
  firestoreObjectArray,
  firestoreString,
  firestoreSubObject,
  firestoreTimezoneString,
  firestoreUnixDateTimeSecondsNumber,
  optionalFirestoreBoolean,
  optionalFirestoreDate,
  optionalFirestoreEnum,
  optionalFirestoreNumber,
  optionalFirestorePassthroughJsonField,
  optionalFirestoreString,
  optionalFirestoreArray,
  optionalFirestoreUnixDateTimeSecondsNumber,
  snapshotConverterFunctions
} from '../../common';
import { type CalendarEventId, type CalendarEventStatus, type CalendarExtensionData, type CalendarType, inferCalendarRelatedModelKey } from './calendar.id';
import { type StorageFileId } from '../storagefile';

/**
 * @module calendar
 *
 * Defines the Calendar Firestore model: a calendar and ALL of its events stored compactly in a single
 * document, published as an ".ics" file through the existing StorageFile processing machinery.
 *
 * **Why one document.** A downstream app reads the model directly and renders it, so what it shows is
 * always current — it never waits on, or re-parses, the published ICS. The cost is a 1 MiB ceiling and a
 * whole-array rewrite per edit, which is why growth is bounded by the {@link CalendarTypeConfig} retention
 * policy and why this shape suits publish-oriented calendars rather than high-churn shared ones.
 *
 * **Publishing.** Writing a Calendar flags it with `s` (needs sync). A scheduled sweep prunes it, creates or
 * re-flags the ICS StorageFile named by `isf`, and clears `s`. The StorageFile processing pipeline then
 * renders and uploads the file, inheriting its retry / stuck-detection / cleanup behaviour, and sets `sat`
 * on success. `StorageFileProcessingState.SUCCESS` therefore means "the published ICS matches this model".
 *
 * This is the same flow as StorageFileGroup → zip (`shouldRegenerate` flag → sweep → derived StorageFile →
 * subtask processor → upload), which is the reference implementation it mirrors.
 */

// MARK: Calendar
/**
 * Model identity for the Calendar collection (collection name: `calendar`, prefix: `cal`).
 */
export const calendarIdentity = firestoreModelIdentity('calendar', 'cal');

/**
 * A single non-recurring event embedded in a {@link Calendar}.
 *
 * Dates are stored as unix seconds rather than ISO strings, and the span is `{ startsAt, durationMinutes }`
 * rather than a start/end pair: both halve the stored bytes, and `{ startsAt, duration }` is already the
 * input shape of every `@dereekb/date` utility this model expands and emits through, so an end date would
 * mean converting back on every expansion and every ICS emit.
 *
 * @dbxModelSubObject
 */
export interface CalendarEventItem {
  /**
   * Identifier of the event, unique within its calendar. Stable across publishes.
   *
   * @dbxModelVariable eventId
   */
  id: CalendarEventId;
  /**
   * Instant the event starts at.
   *
   * For a recurring event this doubles as the recurrence's anchor — see {@link CalendarRecurringEventItem}.
   *
   * @dbxModelVariable startsAt
   */
  sa: Date;
  /**
   * Duration of the event in minutes.
   *
   * @dbxModelVariable durationMinutes
   */
  dur: Minutes;
  /**
   * True if the event occupies whole calendar days rather than an instant range.
   *
   * @dbxModelVariable allDay
   */
  ad?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Timezone the event's wall clock is anchored to. Defaults to the calendar's timezone.
   *
   * For a recurring event this doubles as the recurrence's timezone.
   *
   * @dbxModelVariable timezone
   */
  tz?: Maybe<TimezoneString>;
  /**
   * Display name of the event. Emitted as SUMMARY.
   *
   * @dbxModelVariable name
   */
  n: string;
  /**
   * Longer description of the event. Emitted as DESCRIPTION.
   *
   * @dbxModelVariable description
   */
  d?: Maybe<string>;
  /**
   * Location of the event. Emitted as LOCATION.
   *
   * @dbxModelVariable location
   */
  l?: Maybe<string>;
  /**
   * Website for the event. Emitted as URL.
   *
   * @dbxModelVariable url
   */
  u?: Maybe<WebsiteUrl>;
  /**
   * Status of the event. Emitted as STATUS.
   *
   * CANCELLED is a tombstone: it is how the feed tells a client that already holds the event that it was
   * removed. Retention is what eventually drops the tombstone.
   *
   * @dbxModelVariable status
   */
  st?: Maybe<CalendarEventStatus>;
  /**
   * Revision counter. Emitted as SEQUENCE.
   *
   * Subscribers compare it against the copy they hold to decide whether a same-UID event is newer, so it is
   * bumped on every semantic change to an already-published event.
   *
   * @dbxModelVariable sequence
   */
  q?: Maybe<number>;
  /**
   * Categories of the event. Emitted as CATEGORIES.
   *
   * @dbxModelVariable categories
   */
  ca?: Maybe<string[]>;
  /**
   * Extension data emitted as "X-" properties on this event's VEVENT.
   *
   * @dbxModelVariable extensionData
   */
  x?: Maybe<CalendarExtensionData>;
  /**
   * Created at date.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * Updated at date.
   *
   * @dbxModelVariable updatedAt
   */
  uat: Date;
}

/**
 * A recurring event embedded in a {@link Calendar}.
 *
 * The recurrence fields are jointly required or jointly absent, so `extends` makes that a type-level
 * invariant rather than four `Maybe<>` fields plus a runtime guard. The two kinds live in two separate
 * arrays because their retention rules are structurally different (a one-off is pruned on its own end
 * instant, a recurrence on the series' end) and because the ICS mapper genuinely forks between them.
 *
 * There is deliberately NO `recurrenceStartsAt` / `recurrenceTimezone`: the base `sa` IS the recurrence's
 * start and the base `tz` IS its timezone, which makes the mapping to {@link ModelRecurrenceInfo} total and
 * lossless in both directions.
 *
 * @dbxModelSubObject
 */
export interface CalendarRecurringEventItem extends CalendarEventItem {
  /**
   * The recurrence rule, in the workspace's compact newline-joined storage form.
   *
   * NOTE: this KEEPS its "RRULE:" prefix and may carry EXDATE lines, so it cannot be handed to
   * {@link ICalendarRecurrence.rules} directly — see `iCalendarRecurrenceForRRuleLines()`.
   *
   * @dbxModelVariable recurrenceRule
   */
  rr: RRuleLines;
  /**
   * Instant the final occurrence of the series ends at, when the series ends.
   *
   * @dbxModelVariable recurrenceEndsAt
   */
  rea?: Maybe<Date>;
  /**
   * True if the series never ends. A forever recurrence is never pruned.
   *
   * @dbxModelVariable recurrenceForever
   */
  rfe?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Occurrences excluded from the series, as unix seconds.
   *
   * Stored raw because no unix-seconds ARRAY snapshot field exists; `calendarEventItemExceptionDateSet()`
   * builds the DateSet the expansion wants.
   *
   * @dbxModelVariable recurrenceExceptionDates
   */
  rex?: Maybe<UnixDateTimeSecondsNumber[]>;
}

/**
 * Creates the comparison that orders calendar event items ascending by their start instant.
 *
 * The stored arrays are always in chronological order, which is what lets retention drop the oldest items
 * with a `slice` instead of a sort.
 *
 * A factory rather than a constant because it is used for both item types, and a
 * `SortCompareFunction<CalendarEventItem>` does not satisfy a `SortCompareFunction<CalendarRecurringEventItem>`.
 *
 * @returns The ascending-by-start comparison.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarEventItemsSortFunction<T extends CalendarEventItem>(): SortCompareFunction<T> {
  return sortByDateFunction<T>((x) => x.sa);
}

/**
 * Creates the filter that keeps only the last entry carrying a given {@link CalendarEventId}.
 *
 * @returns The unique-by-id filter.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarEventItemsFilterUniqueFunction<T extends CalendarEventItem>(): FilterUniqueFunction<T, CalendarEventId> {
  return filterUniqueFunction<T, CalendarEventId>((x) => x.id);
}

/**
 * The converter fields shared by {@link CalendarEventItem} and {@link CalendarRecurringEventItem}.
 *
 * Every optional field either uses an `optional*` factory or a `dontStoreIf`, so an absent field costs
 * nothing in the stored document.
 */
export const calendarEventItemFields = {
  id: firestoreModelIdString,
  sa: firestoreUnixDateTimeSecondsNumber({ saveDefaultAsNow: true }),
  dur: firestoreNumber<Minutes>({ default: 0 }),
  ad: optionalFirestoreBoolean({ dontStoreIf: false }),
  tz: optionalFirestoreString<TimezoneString>(),
  n: firestoreString<string>({ default: '' }),
  d: optionalFirestoreString(),
  l: optionalFirestoreString(),
  u: optionalFirestoreString<WebsiteUrl>(),
  st: optionalFirestoreEnum<CalendarEventStatus>(),
  q: optionalFirestoreNumber(),
  ca: optionalFirestoreArray<string>({ filterUnique: true, dontStoreIfEmpty: true }),
  x: optionalFirestorePassthroughJsonField<CalendarExtensionData>({ filterEmptyValues: true, dontStoreIfEmpty: true }),
  cat: firestoreUnixDateTimeSecondsNumber({ saveDefaultAsNow: true }),
  uat: firestoreUnixDateTimeSecondsNumber({ saveDefaultAsNow: true })
};

/**
 * Firestore sub-object converter for a {@link CalendarEventItem}.
 */
export const calendarEventItem = firestoreSubObject<CalendarEventItem>({
  objectField: {
    fields: calendarEventItemFields
  }
});

/**
 * Firestore sub-object converter for a {@link CalendarRecurringEventItem}.
 */
export const calendarRecurringEventItem = firestoreSubObject<CalendarRecurringEventItem>({
  objectField: {
    fields: {
      ...calendarEventItemFields,
      rr: firestoreString<RRuleLines>({ default: '' as RRuleLines }),
      rea: optionalFirestoreUnixDateTimeSecondsNumber(),
      rfe: optionalFirestoreBoolean({ dontStoreIf: false }),
      rex: optionalFirestoreArray<UnixDateTimeSecondsNumber>({ dontStoreIfEmpty: true })
    }
  }
});

/**
 * A calendar and all of its events, stored in one document and published as an ".ics" file.
 *
 * A Calendar that belongs to another model uses that model's two-way flat key as its document id, so the
 * profile "pr/abc123" owns "cal/pr_abc123" — see {@link calendarIdForModel}. There is no `modelKey` field:
 * the id IS the association.
 *
 * `s` / `sat` / `isf` mirror {@link StorageFileGroup}'s `s` / `zat` / `zsf` exactly, and `o` drives
 * `resourceIsOwnedByAuthOwnershipKey()` in the security rules identically to `sf` / `sfg`.
 *
 * @dbxModel
 * @dbxModelRead owner
 */
export interface Calendar {
  /**
   * The kind of calendar this is, resolving its retention policy and ICS emission config.
   *
   * @dbxModelVariable calendarType
   */
  t: CalendarType;
  /**
   * Display name of the calendar. Emitted as NAME/X-WR-CALNAME.
   *
   * @dbxModelVariable name
   */
  n: string;
  /**
   * Description of the calendar. Emitted as DESCRIPTION/X-WR-CALDESC.
   *
   * @dbxModelVariable description
   */
  d?: Maybe<string>;
  /**
   * Default timezone of the calendar. Emitted as X-WR-TIMEZONE, and the fallback for an event with no `tz`.
   *
   * @dbxModelVariable timezone
   */
  tz: TimezoneString;
  /**
   * CSS3 color name for the calendar. Emitted as COLOR.
   *
   * @dbxModelVariable color
   */
  c?: Maybe<string>;
  /**
   * Ownership key, if applicable. Drives read access in the security rules.
   *
   * @dbxModelVariable ownerKey
   */
  o?: Maybe<FirebaseAuthOwnershipKey>;
  /**
   * The calendar's one-off events, ascending by start instant and unique by id.
   *
   * @dbxModelVariable events
   */
  e: CalendarEventItem[];
  /**
   * The calendar's recurring events, ascending by anchor instant and unique by id.
   *
   * @dbxModelVariable recurringEvents
   */
  r: CalendarRecurringEventItem[];
  /**
   * Extension data emitted as "X-" properties on the calendar's VCALENDAR.
   *
   * @dbxModelVariable extensionData
   */
  x?: Maybe<CalendarExtensionData>;
  /**
   * Created at date.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * Updated at date. Moves on every content change.
   *
   * @dbxModelVariable updatedAt
   */
  uat: Date;
  /**
   * True if this Calendar should be swept and its published ICS regenerated.
   *
   * Cleared inside the sync transaction, mirroring the `re` flag of the zip flow.
   *
   * @dbxModelVariable needsSync
   */
  s?: Maybe<NeedsSyncBoolean>;
  /**
   * The last date the published ICS was successfully uploaded.
   *
   * Set ONLY by the processor's success path. `s === false && sat < uat` therefore means "queued, not yet
   * published", which is exactly the state `flagStaleCalendarsForSync()` self-heals.
   *
   * @dbxModelVariable syncedAt
   */
  sat?: Maybe<Date>;
  /**
   * StorageFile that holds the published ICS for this calendar.
   *
   * @dbxModelVariable icsStorageFileId
   */
  isf?: Maybe<StorageFileId>;
}

/**
 * Permission roles for Calendar operations.
 *
 * `sync` is the publish-side role held by the scheduled sweep.
 */
export type CalendarRoles = GrantedReadRole | GrantedUpdateRole | 'sync';

/**
 * Firestore document wrapper for a {@link Calendar}.
 *
 * Provides a convenience getter to infer the related model key from the calendar's own id.
 */
export class CalendarDocument extends AbstractFirestoreDocument<Calendar, CalendarDocument, typeof calendarIdentity> {
  get modelIdentity() {
    return calendarIdentity;
  }

  get calendarRelatedModelKey() {
    return inferCalendarRelatedModelKey(this.id);
  }
}

/**
 * Snapshot converter for {@link Calendar} documents, including both embedded event arrays.
 */
export const calendarConverter = snapshotConverterFunctions<Calendar>({
  fields: {
    t: firestoreString<CalendarType>(),
    n: firestoreString<string>({ default: '' }),
    d: optionalFirestoreString(),
    tz: firestoreTimezoneString({ default: UTC_TIMEZONE_STRING }),
    c: optionalFirestoreString(),
    o: optionalFirestoreString(),
    e: firestoreObjectArray({
      objectField: calendarEventItem,
      sortWith: calendarEventItemsSortFunction<CalendarEventItem>(),
      filterUnique: calendarEventItemsFilterUniqueFunction<CalendarEventItem>()
    }),
    r: firestoreObjectArray({
      objectField: calendarRecurringEventItem,
      sortWith: calendarEventItemsSortFunction<CalendarRecurringEventItem>(),
      filterUnique: calendarEventItemsFilterUniqueFunction<CalendarRecurringEventItem>()
    }),
    x: optionalFirestorePassthroughJsonField<CalendarExtensionData>({ filterEmptyValues: true, dontStoreIfEmpty: true }),
    cat: firestoreDate({ saveDefaultAsNow: true }),
    uat: firestoreDate({ saveDefaultAsNow: true }),
    s: optionalFirestoreBoolean({ dontStoreIf: false }),
    sat: optionalFirestoreDate(),
    isf: optionalFirestoreString()
  }
});

/**
 * Returns the raw Firestore CollectionReference for the Calendar collection.
 *
 * @param context - The Firestore context to use.
 * @returns The CollectionReference for Calendar documents.
 */
export function calendarCollectionReference(context: FirestoreContext): CollectionReference<Calendar> {
  return context.collection(calendarIdentity.collectionName);
}

/**
 * Typed FirestoreCollection for {@link Calendar} documents.
 */
export type CalendarFirestoreCollection = FirestoreCollection<Calendar, CalendarDocument>;

/**
 * Creates a fully configured {@link CalendarFirestoreCollection} with snapshot conversion and document factory.
 *
 * @param firestoreContext - The Firestore context to use.
 * @returns A configured CalendarFirestoreCollection.
 *
 * @example
 * ```ts
 * const collection = calendarFirestoreCollection(firestoreContext);
 * const doc = collection.documentAccessor().loadDocumentForId(calendarIdForModel(profileDocument.key));
 * ```
 */
export function calendarFirestoreCollection(firestoreContext: FirestoreContext): CalendarFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: calendarIdentity,
    converter: calendarConverter,
    collection: calendarCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new CalendarDocument(accessor, documentAccessor),
    firestoreContext
  });
}

/**
 * Abstract base providing access to the Calendar Firestore collection.
 *
 * Implement this in your app module to wire up the collection for dependency injection.
 *
 * @dbxModelGroup Calendar
 */
export abstract class CalendarFirestoreCollections {
  abstract readonly calendarCollection: CalendarFirestoreCollection;
}

/**
 * Union of all Calendar-related model identity types.
 */
export type CalendarTypes = typeof calendarIdentity;
