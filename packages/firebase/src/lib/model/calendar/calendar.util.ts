import { type ArrayOrValue, type Hours, MS_IN_HOUR, type Maybe, type TimezoneString, UTC_TIMEZONE_STRING, areEqualPOJOValues, asArray, isThrottled, unixDateTimeSecondsNumberFromDate, unixDateTimeSecondsNumberToDate } from '@dereekb/util';
import { type CalendarDate, CalendarDateType, DateSet, type ModelRecurrenceInfo, dateDurationSpanEndDate } from '@dereekb/date';
import { addHours, addMinutes, subDays } from 'date-fns';
import { type FirebaseAuthOwnershipKey, type FirestoreModelKey } from '../../common';
import { type Calendar, type CalendarEventItem, type CalendarRecurringEventItem, calendarEventItemsFilterUniqueFunction, calendarEventItemsSortFunction } from './calendar';
import { type CalendarEventId, CalendarEventStatus, type CalendarExtensionData, type CalendarType } from './calendar.id';
import { type CalendarTypeConfig, DEFAULT_CALENDAR_MAX_EVENTS, DEFAULT_CALENDAR_RETAIN_PAST_EVENT_DAYS } from './calendar.type';

/**
 * @module calendar.util
 *
 * The CALLER-FACING surface of the Calendar model: pure array operations and update TEMPLATES.
 *
 * Other models create and mutate a Calendar inside THEIR OWN transaction, holding the accessor and the
 * document themselves. So this module ships no `upsert…` / `remove…` server actions — an action that opened
 * its own transaction would either fight the caller's or force an awkward split write. It ships the
 * `Pick<Calendar, …>` templates the caller merges into its own `create()` / `update()`, the same convention
 * `markStorageFileForDeleteTemplate()` follows.
 *
 * The `s: true` invariant that makes the sweep correct is carried by {@link calendarTemplate} and
 * {@link updateCalendarEventsTemplate}, so it remains impossible to mutate events and forget to flag the
 * calendar for sync.
 */

// MARK: Event Item Helpers
/**
 * Returns the instant a one-off event ends at.
 *
 * @param item - The event.
 * @returns The end instant.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarEventItemEndDate(item: CalendarEventItem): Date {
  return addMinutes(item.sa, item.dur);
}

/**
 * Returns the {@link CalendarDate} view of an event, which is the input shape every `@dereekb/date`
 * expansion and iCalendar factory consumes.
 *
 * @param item - The event.
 * @returns The calendar date.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarEventItemCalendarDate(item: CalendarEventItem): CalendarDate {
  return {
    type: item.ad ? CalendarDateType.DAYS : CalendarDateType.TIME,
    startsAt: item.sa,
    duration: item.dur
  };
}

/**
 * Returns the {@link DateSet} of a recurring event's excluded occurrences, which is exactly what
 * `DateRRuleInstanceOptions.exclude` wants.
 *
 * @param item - The recurring event.
 * @returns The excluded instants. Empty when the event excludes nothing.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarEventItemExceptionDateSet(item: Pick<CalendarRecurringEventItem, 'rex'>): DateSet {
  return new DateSet((item.rex ?? []).map((x) => unixDateTimeSecondsNumberToDate(x) as Date));
}

/**
 * Returns the timezone an event's wall clock is anchored to, falling back to the calendar's timezone.
 *
 * @param item - The event.
 * @param calendarTimezone - The owning calendar's timezone.
 * @returns The resolved timezone.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarEventItemTimezone(item: Pick<CalendarEventItem, 'tz'>, calendarTimezone: TimezoneString): TimezoneString {
  return item.tz ?? calendarTimezone;
}

// MARK: Recurrence Adapters
/**
 * Projects a recurring event onto the workspace's {@link ModelRecurrenceInfo} shape.
 *
 * The mapping is total and lossless because the event's base `sa` IS the recurrence's start and its base
 * `tz` IS the recurrence's timezone — which is exactly why there is no separate `recurrenceStartsAt`.
 *
 * @param item - The recurring event.
 * @param calendarTimezone - The owning calendar's timezone, used when the event carries none.
 * @returns The recurrence info.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarRecurringEventItemModelRecurrenceInfo(item: CalendarRecurringEventItem, calendarTimezone: TimezoneString): ModelRecurrenceInfo {
  return {
    timezone: calendarEventItemTimezone(item, calendarTimezone),
    rrule: item.rr,
    start: item.sa,
    end: item.rea ?? dateDurationSpanEndDate({ startsAt: item.sa, duration: item.dur }),
    forever: item.rfe === true
  };
}

/**
 * The recurrence half of a {@link CalendarRecurringEventItem}, as produced from a {@link ModelRecurrenceInfo}.
 */
export type CalendarRecurringEventItemRecurrenceFields = Pick<CalendarRecurringEventItem, 'sa' | 'tz' | 'rr' | 'rea' | 'rfe'>;

/**
 * Projects a {@link ModelRecurrenceInfo} back onto the recurrence fields of a recurring event.
 *
 * @param info - The recurrence info.
 * @returns The recurrence fields, ready to merge into an event item.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarRecurringEventItemRecurrenceFields(info: ModelRecurrenceInfo): CalendarRecurringEventItemRecurrenceFields {
  const forever = info.forever === true;

  return {
    sa: info.start,
    tz: info.timezone,
    rr: info.rrule,
    rea: forever ? undefined : info.end,
    rfe: forever ? true : undefined
  };
}

// MARK: Templates
/**
 * Configuration for {@link calendarTemplate}.
 */
export interface CalendarTemplateConfig {
  readonly calendarType: CalendarType;
  readonly name: string;
  readonly timezone?: Maybe<TimezoneString>;
  readonly description?: Maybe<string>;
  readonly color?: Maybe<string>;
  readonly ownerKey?: Maybe<FirebaseAuthOwnershipKey>;
  readonly events?: Maybe<CalendarEventItem[]>;
  readonly recurringEvents?: Maybe<CalendarRecurringEventItem[]>;
  readonly extensionData?: Maybe<CalendarExtensionData>;
  readonly now?: Maybe<Date>;
}

/**
 * Builds the initial document data for a new Calendar.
 *
 * The caller creates the document itself, typically as
 * `accessor.loadDocumentForId(calendarIdForModel(relatedModelKey)).create(calendarTemplate({ … }))`.
 *
 * `s` defaults to true, so a newly created Calendar is picked up by the very next sweep.
 *
 * @param config - The calendar's type, display metadata and initial events.
 * @returns The Calendar data.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarTemplate(config: CalendarTemplateConfig): Calendar {
  const { calendarType, name, timezone, description, color, ownerKey, events, recurringEvents, extensionData, now: inputNow } = config;
  const now = inputNow ?? new Date();

  const calendar: Calendar = {
    t: calendarType,
    n: name,
    d: description,
    tz: timezone ?? UTC_TIMEZONE_STRING,
    c: color,
    o: ownerKey,
    e: events ?? [],
    r: recurringEvents ?? [],
    x: extensionData,
    cat: now,
    uat: now,
    s: true
  };

  return calendar;
}

/**
 * The fields {@link markCalendarForSyncTemplate} produces.
 */
export type MarkCalendarForSyncTemplate = Pick<Calendar, 's' | 'uat'>;

/**
 * Builds the update that flags a Calendar for its next sync without touching its events.
 *
 * A caller that changed only display metadata (name, description, color) merges this.
 *
 * @param now - The update instant. Defaults to the current time.
 * @returns The update fields.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function markCalendarForSyncTemplate(now?: Maybe<Date>): MarkCalendarForSyncTemplate {
  return {
    s: true,
    uat: now ?? new Date()
  };
}

// MARK: Sync State
/**
 * Where a Calendar sits in the publish pipeline, as derived from the calendar itself.
 *
 * The read-side counterpart of {@link markCalendarForSyncTemplate}: it decodes the `s` / `sat` / `uat`
 * invariant the sweep and the ICS processor maintain, so a reader never has to re-derive it (and never
 * mistakes a stale `sat` for "the published feed is current").
 */
export enum CalendarSyncState {
  /**
   * The calendar's content has moved and no sweep has claimed it yet.
   *
   * `s` is set by {@link calendarTemplate}, {@link updateCalendarEventsTemplate} and
   * {@link markCalendarForSyncTemplate}, so this is the state every content change lands in.
   */
  QUEUED = 'queued',
  /**
   * A sweep cleared `s` but the ICS upload that writes `sat` has not landed yet.
   *
   * This is the `s === false && sat < uat` window the resync backstop self-heals, and it also covers a
   * calendar whose first ICS has never published.
   */
  PUBLISHING = 'publishing',
  /**
   * The published ICS reflects the calendar's current content.
   */
  SYNCED = 'synced'
}

/**
 * The fields {@link calendarSyncState} reads.
 */
export type CalendarSyncStateInput = Pick<Calendar, 's' | 'sat' | 'uat'>;

/**
 * Returns where a Calendar sits in the publish pipeline.
 *
 * `sat` ALONE is not "synced": it is the instant of the last successful upload, which says nothing about
 * whether the content has moved since. Only `sat > uat` with the sync flag clear means the published feed
 * matches the model.
 *
 * @param calendar - The calendar's sync flag, last publish instant and update instant.
 * @returns The calendar's sync state.
 *
 * @example
 * ```ts
 * const isPublished = calendarSyncState(calendar) === CalendarSyncState.SYNCED;
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarSyncState(calendar: CalendarSyncStateInput): CalendarSyncState {
  const { s, sat, uat } = calendar;
  let result: CalendarSyncState;

  if (s === true) {
    result = CalendarSyncState.QUEUED;
  } else if (sat == null || sat < uat) {
    result = CalendarSyncState.PUBLISHING;
  } else {
    result = CalendarSyncState.SYNCED;
  }

  return result;
}

// MARK: Ics Link Rotation
/**
 * How long a caller must wait between rotations of a Calendar's published ICS link.
 *
 * Rotation is rate-limited rather than free because it is DESTRUCTIVE to subscribers: the old url stops
 * working, and every calendar client already holding it breaks until its owner re-subscribes. A run of
 * rotations would also leave a trail of orphaned ICS objects while each replacement uploads.
 *
 * Twelve hours is chosen against the subscriber refresh cadence rather than against server cost — Google
 * re-reads a subscribed feed only every 8-24 hours, so rotating faster than that guarantees a window where
 * the feed a subscriber holds is already dead and its replacement has not been fetched yet.
 *
 * Only the default. An app wanting a different cadence passes its own value to both the server (which
 * enforces the window) and the client (which counts down to it); both sides must use the same value, or the
 * UI will offer a rotation the server rejects.
 */
export const DEFAULT_CALENDAR_ICS_ROTATE_THROTTLE_HOURS: Hours = 12;

/**
 * The fields {@link calendarNextIcsRotateAt} reads.
 */
export type CalendarNextIcsRotateAtInput = Pick<Calendar, 'rat'>;

/**
 * Input for {@link calendarNextIcsRotateAt}.
 */
export interface CalendarNextIcsRotateAtConfig {
  /**
   * The calendar's last rotation instant, if any.
   */
  readonly calendar?: Maybe<CalendarNextIcsRotateAtInput>;
  /**
   * Overrides {@link DEFAULT_CALENDAR_ICS_ROTATE_THROTTLE_HOURS}.
   */
  readonly throttleHours?: Maybe<Hours>;
}

/**
 * The earliest time a Calendar's published ICS link may be rotated again.
 *
 * Both the server (which enforces the throttle) and the client (which disables the action until then) derive
 * the window from the same stored instant, so the UI cannot offer a rotation the server would reject.
 *
 * @param config - The calendar, and optionally a throttle window to use instead of the default.
 * @returns The time the next rotation is allowed, or undefined when the link has never been rotated.
 *
 * @example
 * ```ts
 * const nextRotateAt = calendarNextIcsRotateAt({ calendar });
 * const isThrottled = nextRotateAt != null && isAfter(nextRotateAt, new Date());
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarNextIcsRotateAt(config: CalendarNextIcsRotateAtConfig): Maybe<Date> {
  const { calendar, throttleHours } = config;
  return calendar?.rat == null ? undefined : addHours(calendar.rat, throttleHours ?? DEFAULT_CALENDAR_ICS_ROTATE_THROTTLE_HOURS);
}

/**
 * Whether a Calendar's published ICS link is still inside its rotation throttle window.
 *
 * The predicate half of {@link calendarNextIcsRotateAt}, and the one the server rejects on. A calendar that
 * has never been rotated is never throttled, which `isThrottled()` already encodes by treating an absent
 * `lastRunAt` as expired.
 *
 * @param config - The calendar, and optionally a throttle window to use instead of the default.
 * @param now - Overrides the current time.
 * @returns True while another rotation would be rejected.
 *
 * @example
 * ```ts
 * if (isCalendarIcsRotateThrottled({ calendar })) {
 *   // the link was rotated too recently
 * }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isCalendarIcsRotateThrottled(config: CalendarNextIcsRotateAtConfig, now?: Maybe<Date>): boolean {
  const { calendar, throttleHours } = config;
  return isThrottled((throttleHours ?? DEFAULT_CALENDAR_ICS_ROTATE_THROTTLE_HOURS) * MS_IN_HOUR, calendar?.rat, now);
}

// MARK: Array Operations
/**
 * A partial event item update. The id is required, since it is what an upsert matches on.
 */
export type CalendarEventItemUpdate<T extends CalendarEventItem = CalendarEventItem> = Partial<T> & Pick<CalendarEventItem, 'id'>;

/**
 * The fields excluded when deciding whether an upsert actually changed an event.
 *
 * `uat` and `q` are the RESULT of a change, so including them would make every upsert look like a change.
 *
 * `m` is a private targeting handle that is never emitted to the ICS, so a change to it alone is invisible
 * to a subscriber. Counting it would mean that back-filling an owner key onto existing events bumped every
 * SEQUENCE and made every client re-fetch a feed whose content had not moved.
 */
const CALENDAR_EVENT_ITEM_CHANGE_IGNORED_FIELDS: readonly string[] = ['uat', 'q', 'm'];

/**
 * @returns True when the two items differ in any field that carries meaning to a subscriber.
 */
function calendarEventItemHasSemanticChange<T extends CalendarEventItem>(existing: T, updated: T): boolean {
  const stripped = (item: T) => {
    const copy = { ...item } as Record<string, unknown>;
    CALENDAR_EVENT_ITEM_CHANGE_IGNORED_FIELDS.forEach((key) => delete copy[key]);
    return copy;
  };

  return !areEqualPOJOValues(stripped(existing), stripped(updated));
}

/**
 * Configuration for {@link upsertCalendarEventItems}.
 */
export interface UpsertCalendarEventItemsConfig {
  /**
   * The update instant, applied to `uat` (and `cat` for a newly inserted item). Defaults to the current time.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Merges updates into an event array, inserting an item whose id is not present yet.
 *
 * An update that changes something a subscriber can observe bumps `q` (SEQUENCE) and moves `uat`; an update
 * that changes nothing leaves the item, and therefore the published feed, byte-identical.
 *
 * @param items - The current items.
 * @param updates - The partial updates, each carrying the id it applies to.
 * @param config - Optional update instant.
 * @returns A new array, sorted ascending by start instant and unique by id.
 *
 * @example
 * ```ts
 * const events = upsertCalendarEventItems(calendar.e, [{ id: 'a', n: 'Renamed' }]);
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function upsertCalendarEventItems<T extends CalendarEventItem>(items: T[], updates: CalendarEventItemUpdate<T>[], config?: Maybe<UpsertCalendarEventItemsConfig>): T[] {
  const now = config?.now ?? new Date();
  const result = [...items];

  updates.forEach((update) => {
    const index = result.findIndex((x) => x.id === update.id);

    if (index === -1) {
      const inserted = {
        sa: now,
        dur: 0,
        n: '',
        ...update,
        cat: now,
        uat: now
      } as unknown as T;

      result.push(inserted);
    } else {
      const existing = result[index];
      const merged = { ...existing, ...update } as T;

      if (calendarEventItemHasSemanticChange(existing, merged)) {
        result[index] = { ...merged, q: (existing.q ?? 0) + 1, uat: now };
      }
    }
  });

  const sorted = result.sort(calendarEventItemsSortFunction<T>());
  return calendarEventItemsFilterUniqueFunction<T>()(sorted);
}

/**
 * Configuration for {@link removeCalendarEventItems}.
 */
export interface RemoveCalendarEventItemsConfig {
  /**
   * If true, the items are SPLICED OUT rather than tombstoned.
   *
   * Only correct for an event that was never published: a subscriber that already holds the event has no way
   * to learn it is gone once its VEVENT simply stops appearing in the feed.
   */
  readonly hard?: Maybe<boolean>;
  /**
   * The update instant. Defaults to the current time.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Removes events from an array.
 *
 * By default this TOMBSTONES: the item is marked `CANCELLED` and its `q` is bumped, which is the only way a
 * published feed communicates a deletion to a client that already holds the event. Retention is what
 * eventually drops the tombstone.
 *
 * @param items - The current items.
 * @param ids - The ids to remove.
 * @param config - Optional hard-remove flag and update instant.
 * @returns A new array.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function removeCalendarEventItems<T extends CalendarEventItem>(items: T[], ids: ArrayOrValue<CalendarEventId>, config?: Maybe<RemoveCalendarEventItemsConfig>): T[] {
  const now = config?.now ?? new Date();
  const idSet = new Set(asArray(ids));
  let result: T[];

  if (config?.hard === true) {
    result = items.filter((x) => !idSet.has(x.id));
  } else {
    result = items.map((x) => (idSet.has(x.id) && x.st !== CalendarEventStatus.CANCELLED ? { ...x, st: CalendarEventStatus.CANCELLED, q: (x.q ?? 0) + 1, uat: now } : x));
  }

  return result;
}

// MARK: Model Key Targeting
/**
 * Finds a single event in a calendar by its id, looking in BOTH the one-off and the recurring arrays.
 *
 * The two arrays share one id space -- an id is unique within its calendar, not merely within its array --
 * so a caller holding only an id (an emailed invite, a targeted update) has no way to know which array to
 * look in, and no reason to care.
 *
 * @param calendar - The calendar to search.
 * @param eventId - The id to find.
 * @returns The matching event, or undefined.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarEventItemForId(calendar: Pick<Calendar, 'e' | 'r'>, eventId: CalendarEventId): Maybe<CalendarEventItem | CalendarRecurringEventItem> {
  return (calendar.e ?? []).find((x) => x.id === eventId) ?? (calendar.r ?? []).find((x) => x.id === eventId);
}

/**
 * Returns the events that were generated from the given model key.
 *
 * @param items - The current items.
 * @param modelKey - The key to match on.
 * @returns The matching events, in their original order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarEventItemsForModelKey<T extends CalendarEventItem>(items: T[], modelKey: FirestoreModelKey): T[] {
  return items.filter((x) => x.m === modelKey);
}

/**
 * Configuration for {@link replaceCalendarEventItemsForModelKey}.
 */
export interface ReplaceCalendarEventItemsForModelKeyConfig<T extends CalendarEventItem = CalendarEventItem> {
  /**
   * The key whose events are being replaced. Every item in {@link items} is stamped with it, so a caller
   * cannot accidentally write events that the next replace would fail to find.
   */
  readonly modelKey: FirestoreModelKey;
  /**
   * The COMPLETE desired set of events for this key. Anything previously carrying the key and absent here is
   * removed.
   */
  readonly items: CalendarEventItemUpdate<T>[];
  /**
   * If true, events dropped by the replacement are SPLICED OUT rather than tombstoned.
   *
   * Only correct when they were never published: a subscriber holding an event has no way to learn it is
   * gone once its VEVENT simply stops appearing.
   */
  readonly hard?: Maybe<boolean>;
  /**
   * The update instant. Defaults to the current time.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Replaces the whole set of events belonging to one model key, leaving every other event untouched.
 *
 * This is the primitive a producer needs when it regenerates its events from source: it cannot know which
 * generated ids it wrote last time, only which model they came from. Matching on {@link CalendarEventItem.m}
 * rather than on `id` is what makes "publish the current state of this model" a single idempotent call.
 *
 * An event that survives the replacement is UPSERTED, so it keeps its `cat` and only bumps `q` / `uat` if
 * something a subscriber can observe actually changed. An event that disappears is tombstoned by default.
 *
 * @param items - The current items.
 * @param config - The model key, the complete desired set, and the removal mode.
 * @returns A new array, sorted ascending by start instant and unique by id.
 *
 * @example
 * ```ts
 * const events = replaceCalendarEventItemsForModelKey(calendar.e, { modelKey: job.key, items: generated });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function replaceCalendarEventItemsForModelKey<T extends CalendarEventItem>(items: T[], config: ReplaceCalendarEventItemsForModelKeyConfig<T>): T[] {
  const { modelKey, items: inputUpdates, hard, now: inputNow } = config;
  const now = inputNow ?? new Date();

  // stamped rather than trusted, so the set written is always the set the next replace will find
  const updates = inputUpdates.map((x) => ({ ...x, m: modelKey }));
  const retainedIds = new Set(updates.map((x) => x.id));
  const staleIds = items.filter((x) => x.m === modelKey && !retainedIds.has(x.id)).map((x) => x.id);

  let result = upsertCalendarEventItems(items, updates, { now });

  if (staleIds.length) {
    result = removeCalendarEventItems(result, staleIds, { hard, now });
  }

  return result;
}

/**
 * Configuration for {@link updateCalendarEventsTemplate}.
 */
export interface UpdateCalendarEventsTemplateConfig {
  /**
   * The calendar's current events.
   */
  readonly calendar: Pick<Calendar, 'e' | 'r'>;
  readonly upsertEvents?: Maybe<CalendarEventItemUpdate<CalendarEventItem>[]>;
  readonly upsertRecurringEvents?: Maybe<CalendarEventItemUpdate<CalendarRecurringEventItem>[]>;
  readonly removeEventIds?: Maybe<ArrayOrValue<CalendarEventId>>;
  /**
   * Replaces the COMPLETE set of events belonging to one model key, in both arrays.
   *
   * This is the "republish this model" path: the caller supplies what the model produces now and anything
   * else previously carrying the key is removed. Applied BEFORE {@link removeEventIds}, so an explicit
   * removal still wins.
   */
  readonly replaceForModelKey?: Maybe<ReplaceCalendarEventsForModelKey>;
  readonly hardRemove?: Maybe<boolean>;
  readonly now?: Maybe<Date>;
}

/**
 * The complete desired event set for one model key, as consumed by {@link updateCalendarEventsTemplate}.
 */
export interface ReplaceCalendarEventsForModelKey {
  readonly modelKey: FirestoreModelKey;
  readonly events?: Maybe<CalendarEventItemUpdate<CalendarEventItem>[]>;
  readonly recurringEvents?: Maybe<CalendarEventItemUpdate<CalendarRecurringEventItem>[]>;
}

/**
 * The fields {@link updateCalendarEventsTemplate} produces.
 */
export type UpdateCalendarEventsTemplate = Pick<Calendar, 'e' | 'r' | 's' | 'uat'>;

/**
 * Builds the update a caller merges into its own `document.update()` to change a calendar's events.
 *
 * ALWAYS includes `s: true` and `uat`, so a caller cannot mutate events and forget to flag the calendar for
 * sync — the invariant the whole publish pipeline rests on.
 *
 * @param config - The calendar's current events plus the upserts, replacements and removals to apply.
 * @returns The update fields.
 *
 * @example
 * ```ts
 * await calendarDocument.update(updateCalendarEventsTemplate({ calendar, upsertEvents: [item] }));
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function updateCalendarEventsTemplate(config: UpdateCalendarEventsTemplateConfig): UpdateCalendarEventsTemplate {
  const { calendar, upsertEvents, upsertRecurringEvents, removeEventIds, replaceForModelKey, hardRemove, now: inputNow } = config;
  const now = inputNow ?? new Date();

  let e = calendar.e ?? [];
  let r = calendar.r ?? [];

  if (upsertEvents?.length) {
    e = upsertCalendarEventItems(e, upsertEvents, { now });
  }

  if (upsertRecurringEvents?.length) {
    r = upsertCalendarEventItems(r, upsertRecurringEvents, { now });
  }

  if (replaceForModelKey != null) {
    const { modelKey, events, recurringEvents } = replaceForModelKey;
    const replaceConfig = { modelKey, hard: hardRemove, now };

    e = replaceCalendarEventItemsForModelKey(e, { ...replaceConfig, items: events ?? [] });
    r = replaceCalendarEventItemsForModelKey(r, { ...replaceConfig, items: recurringEvents ?? [] });
  }

  if (removeEventIds != null) {
    const removeConfig = { hard: hardRemove, now };
    e = removeCalendarEventItems(e, removeEventIds, removeConfig);
    r = removeCalendarEventItems(r, removeEventIds, removeConfig);
  }

  return {
    e,
    r,
    s: true,
    uat: now
  };
}

// MARK: Retention
/**
 * Input for {@link pruneCalendarEvents}.
 */
export interface PruneCalendarEventsInput {
  readonly calendar: Pick<Calendar, 'e' | 'r'>;
  readonly config: CalendarTypeConfig;
  readonly now?: Maybe<Date>;
}

/**
 * Result of {@link pruneCalendarEvents}.
 */
export interface PruneCalendarEventsResult {
  readonly e: CalendarEventItem[];
  readonly r: CalendarRecurringEventItem[];
  readonly prunedEventCount: number;
  readonly prunedRecurringEventCount: number;
  /**
   * False when nothing was dropped.
   *
   * The sync transaction only writes `e` / `r` when this is true, otherwise every hourly sweep would rewrite
   * both arrays — and burn a full document write — for nothing.
   */
  readonly changed: boolean;
}

/**
 * Applies a {@link CalendarTypeConfig}'s retention policy to a calendar's events. Pure; performs no I/O.
 *
 * 1. Drops recurrences whose series ended before the recurrence cutoff. A forever recurrence is NEVER dropped.
 * 2. Drops one-off events whose end instant is before the past cutoff.
 * 3. If still over `maxEvents`, drops the oldest one-off events first, then the oldest-started recurrences.
 *    Both arrays are already ascending by start, so this is a `slice`. A FUTURE-dated item is never dropped
 *    before a past-dated one.
 *
 * @param input - The calendar's events, its type config, and the reference instant.
 * @returns The retained events plus what was dropped.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function pruneCalendarEvents(input: PruneCalendarEventsInput): PruneCalendarEventsResult {
  const { calendar, config, now: inputNow } = input;
  const now = inputNow ?? new Date();

  const retainPastEventDays = config.retainPastEventDays ?? DEFAULT_CALENDAR_RETAIN_PAST_EVENT_DAYS;
  const retainEndedRecurrenceDays = config.retainEndedRecurrenceDays ?? retainPastEventDays;
  const maxEvents = config.maxEvents ?? DEFAULT_CALENDAR_MAX_EVENTS;
  const pruneEndedRecurrences = config.pruneEndedRecurrences !== false;

  const pastCutoff = subDays(now, retainPastEventDays);
  const recurrenceCutoff = subDays(now, retainEndedRecurrenceDays);

  const inputEvents = calendar.e ?? [];
  const inputRecurringEvents = calendar.r ?? [];

  let r = pruneEndedRecurrences ? inputRecurringEvents.filter((x) => x.rfe === true || x.rea == null || x.rea >= recurrenceCutoff) : [...inputRecurringEvents];
  let e = inputEvents.filter((x) => calendarEventItemEndDate(x) >= pastCutoff);

  // both arrays are ascending by start, so the overflow is always the head
  const overflow = e.length + r.length - maxEvents;

  if (overflow > 0) {
    const droppedFromEvents = Math.min(overflow, e.length);
    e = e.slice(droppedFromEvents);

    const remainingOverflow = overflow - droppedFromEvents;

    if (remainingOverflow > 0) {
      r = r.slice(Math.min(remainingOverflow, r.length));
    }
  }

  const prunedEventCount = inputEvents.length - e.length;
  const prunedRecurringEventCount = inputRecurringEvents.length - r.length;

  return {
    e,
    r,
    prunedEventCount,
    prunedRecurringEventCount,
    changed: prunedEventCount > 0 || prunedRecurringEventCount > 0
  };
}

/**
 * Converts a Date into the unix seconds form stored inside a {@link CalendarRecurringEventItem.rex} array.
 *
 * @param date - The instant to encode.
 * @returns The unix seconds value.
 *
 * @__NO_SIDE_EFFECTS__
 */
export const calendarEventItemExceptionDateValue = unixDateTimeSecondsNumberFromDate;
