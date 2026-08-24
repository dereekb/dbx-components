import { type ArrayOrValue, type Maybe, type TimezoneString, UTC_TIMEZONE_STRING, areEqualPOJOValues, asArray, unixDateTimeSecondsNumberFromDate, unixDateTimeSecondsNumberToDate } from '@dereekb/util';
import { type CalendarDate, CalendarDateType, DateSet, type ModelRecurrenceInfo, dateDurationSpanEndDate } from '@dereekb/date';
import { addMinutes, subDays } from 'date-fns';
import { type FirebaseAuthOwnershipKey } from '../../common';
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

// MARK: Array Operations
/**
 * A partial event item update. The id is required, since it is what an upsert matches on.
 */
export type CalendarEventItemUpdate<T extends CalendarEventItem = CalendarEventItem> = Partial<T> & Pick<CalendarEventItem, 'id'>;

/**
 * The fields excluded when deciding whether an upsert actually changed an event.
 *
 * `uat` and `q` are the RESULT of a change, so including them would make every upsert look like a change.
 */
const CALENDAR_EVENT_ITEM_CHANGE_IGNORED_FIELDS: readonly string[] = ['uat', 'q'];

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
  readonly hardRemove?: Maybe<boolean>;
  readonly now?: Maybe<Date>;
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
 * @param config - The calendar's current events plus the upserts and removals to apply.
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
  const { calendar, upsertEvents, upsertRecurringEvents, removeEventIds, hardRemove, now: inputNow } = config;
  const now = inputNow ?? new Date();

  let e = calendar.e ?? [];
  let r = calendar.r ?? [];

  if (upsertEvents?.length) {
    e = upsertCalendarEventItems(e, upsertEvents, { now });
  }

  if (upsertRecurringEvents?.length) {
    r = upsertCalendarEventItems(r, upsertRecurringEvents, { now });
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
