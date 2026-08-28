import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type FullDateCellScheduleRange, type ModelRecurrenceInfo, DateRRuleParseUtility, RRULE_EXDATE_PROPERTY_TYPE, dateCellScheduleRangeRRule } from '@dereekb/date';
import { type FirestoreModelKey } from '../../common';
import { type CalendarRecurringEventItem } from './calendar';
import { type CalendarEventId, type CalendarEventStatus, type CalendarExtensionData } from './calendar.id';
import { calendarEventItemExceptionDateValue, calendarRecurringEventItemRecurrenceFields } from './calendar.util';

/**
 * @module calendar.schedule
 *
 * Turns a `@dereekb/date` {@link FullDateCellScheduleRange} into a {@link CalendarRecurringEventItem}.
 *
 * This is the bridge that makes any model carrying a date-cell schedule publishable as calendar content. It
 * is deliberately generic rather than living next to whichever model needs it first: nothing here knows what
 * produced the schedule, only how a schedule becomes an event.
 */

/**
 * Configuration for {@link calendarRecurringEventItemForScheduleRange}.
 */
export interface CalendarRecurringEventItemForScheduleRangeConfig {
  /**
   * The schedule to publish.
   */
  readonly range: FullDateCellScheduleRange;
  /**
   * Identifier for the generated event, unique within its calendar. Drives the published UID, so it must be
   * STABLE across republishes of the same source model.
   */
  readonly id: CalendarEventId;
  /**
   * Key of the model this schedule came from. Set this to make the event replaceable as a set via
   * `replaceCalendarEventItemsForModelKey()`.
   */
  readonly modelKey?: Maybe<FirestoreModelKey>;
  /**
   * Display name. Emitted as SUMMARY.
   */
  readonly name: string;
  readonly description?: Maybe<string>;
  readonly location?: Maybe<string>;
  readonly url?: Maybe<WebsiteUrl>;
  readonly status?: Maybe<CalendarEventStatus>;
  readonly categories?: Maybe<string[]>;
  readonly allDay?: Maybe<boolean>;
  readonly extensionData?: Maybe<CalendarExtensionData>;
  /**
   * Emit `FREQ=DAILY` rather than `FREQ=WEEKLY` with all seven BYDAY tokens when every day is enabled.
   * Defaults to true.
   */
  readonly preferDailyFrequency?: boolean;
  /**
   * The creation/update instant. Defaults to the current time.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Builds the recurring event that publishes a date-cell schedule.
 *
 * Returns undefined when the schedule yields no occurrences at all — an empty encoded week with no included
 * days, or every day excluded. There is deliberately no "empty recurrence" value: an event whose rule
 * produced nothing would still be retained and republished forever.
 *
 * EXCLUSIONS GO IN `rex`, NOT IN `rr`. The generator emits a self-contained rule with its own EXDATE line,
 * but `calendarRecurringEventItemICalendarRecurrence()` (calendar.ics.ts) CONCATENATES the rule's exception
 * dates with the ones from `rex` without deduplicating, so carrying them in both places emits every EXDATE
 * twice. `rex` is the field the model documents for this, and keeping it there also holds `rr` to a single
 * RRULE line plus an optional RDATE.
 *
 * @param config - The schedule, its identity, and the event's display metadata.
 * @returns The recurring event, or undefined when the schedule has no occurrences.
 *
 * @example
 * ```ts
 * const item = calendarRecurringEventItemForScheduleRange({
 *   range: fullDateCellScheduleRangeForJob(job),
 *   id: job.id,
 *   modelKey: jobDocument.key,
 *   name: job.n
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calendarRecurringEventItemForScheduleRange(config: CalendarRecurringEventItemForScheduleRangeConfig): Maybe<CalendarRecurringEventItem> {
  const { range, id, modelKey, name, description, location, url, status, categories, allDay, extensionData, preferDailyFrequency, now: inputNow } = config;
  const now = inputNow ?? new Date();

  const generated = dateCellScheduleRangeRRule({ range, preferDailyFrequency });
  let item: Maybe<CalendarRecurringEventItem>;

  if (generated.recurs) {
    // drop the EXDATE line; those instants are carried by `rex` instead (see the JSDoc above)
    const lines = generated.rruleStringLineSet.filter((line) => !line.startsWith(RRULE_EXDATE_PROPERTY_TYPE));

    const info: ModelRecurrenceInfo = {
      timezone: generated.timezone,
      rrule: DateRRuleParseUtility.toRRuleLines(lines),
      start: generated.start,
      end: generated.end,
      forever: generated.forever
    };

    item = {
      ...calendarRecurringEventItemRecurrenceFields(info),
      id,
      m: modelKey,
      dur: generated.duration,
      ad: allDay ? true : undefined,
      n: name,
      d: description,
      l: location,
      u: url,
      st: status,
      ca: categories,
      x: extensionData,
      rex: generated.exdates.length ? generated.exdates.map((x) => calendarEventItemExceptionDateValue(x)) : undefined,
      cat: now,
      uat: now
    };
  }

  return item;
}
