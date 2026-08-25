import { type DayOfWeek, type Maybe, type Minutes, type TimezoneString } from '@dereekb/util';
import { addMinutes, getDay } from 'date-fns';
import { type DateCellIndex, type DateCellTimingStartsAt, type FullDateCellScheduleRange, calculateExpectedDateCellTimingDurationPair, dateCellDayOfWeekFactory, dateCellTimingRelativeIndexFactory, dateCellTimingStartsAtDateFactory, dateTimezoneUtcNormal, expandDateCellScheduleDayCodesToDayOfWeekSet } from '../date';
import { type ModelRecurrenceInfo } from './date.recurrence';
import { DateRRuleParseUtility, RRULE_EXDATE_PROPERTY_TYPE, RRULE_RDATE_PROPERTY_TYPE, RRULE_STRING_SPLITTER, type RRuleLineString, type RRuleLines, type RRuleStringLineSet } from './date.rrule.parse';
import { RRule, type Options } from './rrule.interop';
import { iCalendarUtcDateTimeString } from '../icalendar/icalendar.value';

/**
 * @module date.cell.schedule.rrule
 *
 * Converts a {@link FullDateCellScheduleRange} into the workspace's stored {@link RRuleLines} form.
 *
 * WHY THIS EXISTS: `CalendarRecurringEventItem.rr` is an `RRuleLines`, but every other rrule path in this
 * package is parse/expand-only — there was no way to get FROM the canonical schedule type TO a publishable
 * recurrence. The correctness bar is round-trip equivalence: expanding the emitted rule through
 * `DateRRuleUtility.expand()` must reproduce exactly the occurrences `expandDateCellScheduleRange()` gives
 * for the same input.
 *
 * THREE THINGS HERE ARE LOAD-BEARING AND NOT OBVIOUS:
 *
 * 1. **COUNT, never UNTIL.** `UNTIL` is never converted between spaces: `DateRRuleInstance` shifts `dtstart`
 *    into wall space and clears `tzid`, but leaves `until` as the instant the string parsed to. So the
 *    expansion compares `UNTIL` in wall space while a published ICS reads the same bytes as an instant
 *    against a zoned DTSTART. An instant-form `UNTIL` drops the final occurrence in every east-of-UTC zone;
 *    a wall-form one drops it in the ICS west of UTC. `COUNT` is space-invariant and correct in both.
 *
 * 2. **EXDATE/RDATE are real instants in UTC.** `expand()` filters `exclude` AFTER converting results back
 *    to instants, `DateSet` keys on exact `getTime()`, and `rex` is unix seconds. Emitting `TZID=`-qualified
 *    values instead would put the set in the wrong space.
 *
 * 3. **The anchor is the first ACTUAL occurrence, not the range's `startsAt`.** `startsAt` may land on a
 *    weekday `w` does not include, and `getRecurrenceDateRange()` reports `dtstart` verbatim — so anchoring
 *    on `startsAt` would make `ModelRecurrenceInfo.start`, and therefore `CalendarRecurringEventItem.sa`,
 *    name a day on which nothing ever happens.
 */

/**
 * RFC 5545 BYDAY weekday values, indexed by {@link DayOfWeek} so the lookup is a plain index.
 *
 * Sunday-first to match `DayOfWeek` / `DateCellScheduleDayCode` ordering, which also makes the emitted token
 * order deterministic. RFC imposes no ordering on BYDAY; byte-stability is the only requirement.
 */
const RRULE_WEEKDAY_FOR_DAY_OF_WEEK = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];

/**
 * Every {@link DayOfWeek} value, ascending.
 */
const ALL_DAYS_OF_WEEK: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * Configuration for {@link dateCellScheduleRangeRRule}.
 */
export interface DateCellScheduleRangeRRuleConfig {
  /**
   * The schedule range to convert.
   */
  readonly range: FullDateCellScheduleRange;
  /**
   * Emit `FREQ=DAILY` instead of `FREQ=WEEKLY` with all seven BYDAY tokens when every day of the week is
   * enabled. The two forms are provably equivalent — this changes only the emitted bytes — so the flag
   * exists to make that equivalence directly testable. Defaults to true.
   */
  readonly preferDailyFrequency?: boolean;
}

/**
 * Fields shared by both outcomes of {@link dateCellScheduleRangeRRule}.
 */
export interface DateCellScheduleRangeRRuleResultBase {
  readonly timezone: TimezoneString;
  readonly duration: Minutes;
  /**
   * Every occurrence's startsAt instant, ascending.
   *
   * Produced by `expandDateCellScheduleRange()` itself rather than recomputed, so agreement with the
   * expansion is structural rather than merely tested.
   */
  readonly occurrences: readonly Date[];
}

/**
 * The result for a schedule range that produced at least one occurrence.
 */
export interface DateCellScheduleRangeRecurrenceRRule extends DateCellScheduleRangeRRuleResultBase {
  readonly recurs: true;
  /**
   * Stored form: exactly one RRULE line, then optional EXDATE and RDATE lines. Never a DTSTART.
   */
  readonly rrule: RRuleLines;
  readonly rruleStringLineSet: RRuleStringLineSet;
  /**
   * The recurrence anchor: the first occurrence's startsAt.
   *
   * Feeds `ModelRecurrenceInfo.start` and `CalendarRecurringEventItem.sa`, and must be supplied back as
   * `options.date.startsAt` when expanding.
   */
  readonly start: Date;
  /**
   * End of the final occurrence's duration. Feeds `ModelRecurrenceInfo.end` / `rea`.
   */
  readonly end: Date;
  /**
   * Always false — a schedule range is always bounded.
   */
  readonly forever: false;
  /**
   * The COUNT carried by the emitted rule.
   */
  readonly count: number;
  /**
   * Occurrences the weekly pattern does not produce, matching the emitted RDATE line.
   */
  readonly rdates: readonly Date[];
  /**
   * Pattern occurrences removed by `ex`, matching the emitted EXDATE line. Feed these to
   * `CalendarRecurringEventItem.rex`.
   */
  readonly exdates: readonly Date[];
  /**
   * True when the emitted rule does not itself produce {@link start} — i.e. the anchor came only from `d`.
   *
   * RFC 5545 3.8.5.3 says DTSTART SHOULD match the pattern. `rrule` tolerates a mismatch by skipping the
   * anchor (which is why the anchor is always also in {@link rdates} when this is true), but a third-party
   * client's behavior is undefined, so callers get to see it.
   */
  readonly anchorOffPattern: boolean;
}

/**
 * The result for a schedule range that produced no occurrences at all.
 */
export interface DateCellScheduleRangeNoRecurrenceRRule extends DateCellScheduleRangeRRuleResultBase {
  readonly recurs: false;
  /**
   * Deliberately undefined rather than an empty string: an empty rule parses to `{}`, and rrule defaults an
   * absent FREQ to YEARLY, so storing `''` would silently create a forever-yearly recurrence.
   */
  readonly rrule?: undefined;
  readonly start?: undefined;
  readonly end?: undefined;
  readonly occurrences: readonly [];
}

/**
 * The result of {@link dateCellScheduleRangeRRule}, discriminated on `recurs`.
 */
export type DateCellScheduleRangeRRuleResult = DateCellScheduleRangeRecurrenceRRule | DateCellScheduleRangeNoRecurrenceRRule;

/**
 * Converts a {@link FullDateCellScheduleRange} into the stored {@link RRuleLines} form plus the metadata
 * needed to build a {@link ModelRecurrenceInfo}.
 *
 * The range's `startsAt` is truncated to whole seconds, because `iCalendarUtcDateTimeString` has
 * second granularity while `DateSet` matches at millisecond precision — an unrounded anchor would emit
 * EXDATE values that silently fail to match anything. The stored `rex` field is unix seconds anyway, so the
 * storage model already requires this.
 *
 * @param config - The schedule range and emission preferences.
 * @returns The recurrence result, or the no-recurrence variant when the range yields no occurrences.
 *
 * @example
 * ```ts
 * const result = dateCellScheduleRangeRRule({ range });
 *
 * if (result.recurs) {
 *   // 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6'
 *   console.log(result.rrule);
 * }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function dateCellScheduleRangeRRule(config: DateCellScheduleRangeRRuleConfig): DateCellScheduleRangeRRuleResult {
  const { range, preferDailyFrequency = true } = config;
  const { w, d, ex, end: rangeEnd, duration, timezone } = range;

  // truncate to whole seconds so the emitted EXDATE/RDATE values can round-trip (see the JSDoc above)
  const startsAt = new Date(Math.floor(range.startsAt.getTime() / 1000) * 1000);
  const startsAtTiming: DateCellTimingStartsAt = { startsAt, timezone };

  const indexFactory = dateCellTimingRelativeIndexFactory(startsAtTiming);
  const startsAtFactory = dateCellTimingStartsAtDateFactory(startsAtTiming);
  const normalInstance = dateTimezoneUtcNormal(timezone);

  // day-of-week of index 0, read in the schedule's own timezone, exactly as dateCellScheduleDateFilter does
  const dayForIndex = dateCellDayOfWeekFactory(getDay(normalInstance.systemDateToTargetDate(startsAt)) as DayOfWeek);

  // the same derivation dateCellScheduleDateFilter and dateCellIndexRange use, so the bound agrees
  const { expectedFinalStartsAt } = calculateExpectedDateCellTimingDurationPair({ startsAt, timezone, end: rangeEnd });
  const maxIndex = indexFactory(expectedFinalStartsAt);

  const allowedDays = expandDateCellScheduleDayCodesToDayOfWeekSet(w);
  const excludedIndexes = new Set(ex);
  // `d` values outside the range are DROPPED: dateCellScheduleDateFilter would accept them, but
  // expandDateCellSchedule only iterates dateCellIndexRange(timing), so they are not in the ground truth.
  const includedIndexes = new Set((d ?? []).filter((i) => i >= 0 && i <= maxIndex));

  const isPatternIndex = (i: DateCellIndex) => allowedDays.has(dayForIndex(i));
  const isInSet = (i: DateCellIndex) => (isPatternIndex(i) || includedIndexes.has(i)) && !excludedIndexes.has(i);

  const inSetIndexes: DateCellIndex[] = [];
  const patternInSetIndexes: DateCellIndex[] = [];

  for (let i = 0; i <= maxIndex; i += 1) {
    if (isInSet(i)) {
      inSetIndexes.push(i);

      if (isPatternIndex(i)) {
        patternInSetIndexes.push(i);
      }
    }
  }

  const occurrences = inSetIndexes.map((i) => startsAtFactory(i));
  let result: DateCellScheduleRangeRRuleResult;

  if (inSetIndexes.length) {
    const anchorIndex = inSetIndexes[0];
    const lastIndex = inSetIndexes[inSetIndexes.length - 1];

    const ruleOptions: Partial<Options> = {};
    let exdateIndexes: DateCellIndex[];
    let rdateIndexes: DateCellIndex[];

    if (patternInSetIndexes.length) {
      const lastCountedPattern = patternInSetIndexes[patternInSetIndexes.length - 1];
      const isEveryDayAllowed = allowedDays.size === ALL_DAYS_OF_WEEK.length;

      if (isEveryDayAllowed && preferDailyFrequency) {
        ruleOptions.freq = RRule.DAILY;
      } else {
        ruleOptions.freq = RRule.WEEKLY;
        ruleOptions.byweekday = ALL_DAYS_OF_WEEK.filter((day) => allowedDays.has(day)).map((day) => RRULE_WEEKDAY_FOR_DAY_OF_WEEK[day]);
      }

      // COUNT spans the pattern days the rule will actually emit: from the anchor through the last
      // NON-EXCLUDED pattern day. Trailing exclusions are trimmed out rather than EXDATE'd, so that
      // rrule.last() -- and therefore `rea`, a retention field -- does not outlive the real series.
      const countedPatternIndexes: DateCellIndex[] = [];

      for (let i = anchorIndex; i <= lastCountedPattern; i += 1) {
        if (isPatternIndex(i)) {
          countedPatternIndexes.push(i);
        }
      }

      ruleOptions.count = countedPatternIndexes.length;

      // Only INTERIOR exclusions need an EXDATE. Leading ones fall below the anchor and are never generated;
      // trailing ones were trimmed out of COUNT above.
      exdateIndexes = countedPatternIndexes.filter((i) => excludedIndexes.has(i));
      rdateIndexes = inSetIndexes.filter((i) => !isPatternIndex(i));
    } else {
      // No weekly pattern survives — either `w` is empty, or every pattern day is excluded. A rule is still
      // REQUIRED: an empty rule string parses to `{}` and rrule defaults FREQ to YEARLY, so omitting it
      // would produce an infinite recurrence. FREQ=DAILY;COUNT=1 pins the rule to the anchor alone and the
      // RDATE line carries the rest, which keeps one storage shape instead of fanning out one-offs.
      ruleOptions.freq = RRule.DAILY;
      ruleOptions.count = 1;
      exdateIndexes = [];
      rdateIndexes = inSetIndexes.slice(1);
    }

    const exdates = exdateIndexes.map((i) => startsAtFactory(i));
    const rdates = rdateIndexes.map((i) => startsAtFactory(i));

    const lines: RRuleStringLineSet = [RRule.optionsToString(ruleOptions) as RRuleLineString];

    if (exdates.length) {
      lines.push(dateListPropertyLine(RRULE_EXDATE_PROPERTY_TYPE, exdates));
    }

    if (rdates.length) {
      lines.push(dateListPropertyLine(RRULE_RDATE_PROPERTY_TYPE, rdates));
    }

    result = {
      recurs: true,
      timezone,
      duration,
      occurrences,
      rrule: DateRRuleParseUtility.toRRuleLines(lines),
      rruleStringLineSet: lines,
      start: startsAtFactory(anchorIndex),
      end: addMinutes(startsAtFactory(lastIndex), duration),
      forever: false,
      count: ruleOptions.count as number,
      exdates,
      rdates,
      anchorOffPattern: !isPatternIndex(anchorIndex)
    };
  } else {
    result = {
      recurs: false,
      timezone,
      duration,
      occurrences: []
    };
  }

  return result;
}

/**
 * Builds a single EXDATE/RDATE content line from a set of instants.
 *
 * Values are emitted in UTC form and ascending order, so identical input yields byte-identical output.
 *
 * @param propertyType - EXDATE or RDATE.
 * @param dates - The instants to emit.
 * @returns The content line.
 *
 * @__NO_SIDE_EFFECTS__
 */
function dateListPropertyLine(propertyType: string, dates: Date[]): RRuleLineString {
  const values = dates.map((x) => iCalendarUtcDateTimeString(x)).join(',');
  return `${propertyType}${RRULE_STRING_SPLITTER}${values}`;
}

/**
 * Projects a {@link DateCellScheduleRangeRRuleResult} onto a {@link ModelRecurrenceInfo}.
 *
 * Computed by direct field reads rather than via
 * `ModelRecurrenceInfoUtility.expandModelRecurrenceStartToModelRecurrenceInfo()`, which drops the input
 * timezone and would therefore derive `start`/`end` at offset 0.
 *
 * @param result - The generator result.
 * @returns The recurrence info, or undefined when the range produced no occurrences.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function dateCellScheduleRangeModelRecurrenceInfo(result: DateCellScheduleRangeRRuleResult): Maybe<ModelRecurrenceInfo> {
  let info: Maybe<ModelRecurrenceInfo>;

  if (result.recurs) {
    info = {
      timezone: result.timezone,
      rrule: result.rrule,
      start: result.start,
      end: result.end,
      forever: result.forever
    };
  }

  return info;
}
