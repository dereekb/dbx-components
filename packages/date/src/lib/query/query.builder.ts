import { type Maybe, type TimezoneString } from '@dereekb/util';
import { addSeconds } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { DateRangeType, dateRange } from '../date/date.range';
import { type DateDayTimezoneHintFilter, type DateItemOccuringFilter, type DateItemQueryStartsEndsFilter, type DateItemRangeFilter } from './query.filter';

/**
 * Paired time and day filters produced by a {@link DaysAndTimeFiltersFunction}.
 *
 * Separates the UTC-based time filter from the timezone-adjusted day filter so
 * that consumers can apply each independently or together.
 */
export interface DaysAndTimeFilter<F> {
  /**
   * The time filter is the primary filter.
   */
  timeFilter: F;
  /**
   * The days filter is calculated when a timezone is provided, and filters on the days that match the range.
   */
  daysFilter: Maybe<F>;
}

/**
 * Intermediate representation of a date query before it is compiled into
 * database-specific filters via a {@link DateQueryBuilder}.
 *
 * Captures upper/lower bounds for both the starts-at and ends-at fields,
 * plus the implied recurrence range used internally for range-based filtering.
 */
export interface RawDateQuery extends DateDayTimezoneHintFilter {
  timezone?: Maybe<TimezoneString>;

  startsLte?: Maybe<Date>;
  startsGte?: Maybe<Date>;
  endsLte?: Maybe<Date>;
  endsGte?: Maybe<Date>;

  /**
   * Implied Range to filter on.
   *
   * We want to include all recurring items that start before the end, AND end after the start.
   *
   * rStart or rEnd may not be defined if no start or end are defined.
   */
  rStart?: Maybe<Date>;
  rEnd?: Maybe<Date>;
}

/**
 * Strategy interface that converts {@link RawDateQuery} bounds into
 * database-specific range objects (`R`) and field filter objects (`F`).
 *
 * Implementations are provided for different query backends (e.g. MongoDB-like).
 */
export interface DateQueryBuilder<R, F> {
  /**
   * Makes the "range" filter, which denotes the range to filter on. It is only used for building the "field" filter later.
   */
  makeRangeFilter: MakeRangeFilterFunction<R>;
  /**
   * Actual filter used to return values.
   */
  makeFieldFilter: MakeFieldFilterFunction<R, F>;
}

export type MakeRangeFilterFunction<R> = (gte: Maybe<Date>, lte: Maybe<Date>) => Maybe<R>;

/**
 * A single field that manages start/end will start and end at the same instant (end = start), so we merge the gte/lte values.
 *
 * The "start" should be the startsAt start range first, and then the endsAt start range if provided.
 * The "ends" should be equal to the endsAt end range first, and then the startsAt end range if provided.
 */
export type MergeStartsAtEndsAtFilterFunction<R> = (startsAt: Maybe<R>, endsAt: Maybe<R>) => R;

/**
 * Input to {@link MakeFieldFilterFunction} containing the optional range
 * objects for starts-at and ends-at fields.
 */
export interface MakeFieldFilterInput<R> {
  startsAt?: Maybe<R>;
  endsAt?: Maybe<R>;
}

export type MakeFieldFilterFunction<R, F> = (input: MakeFieldFilterInput<R>) => F;

/**
 * Builds a {@link RawDateQuery} that matches items occurring at a single point in time.
 *
 * Sets `startsLte` and `endsGte` to the same instant so only items whose
 * active window contains the target date are included.
 *
 * @example
 * ```ts
 * const query = makeDateQueryForOccuringFilter({
 *   occuringAt: new Date('2026-06-15T12:00:00Z'),
 *   timezone: 'America/Chicago'
 * });
 * ```
 *
 * @param find - Filter specifying the target date and optional timezone hint.
 * @returns A raw date query representing the "occurring at" constraint.
 */
export function makeDateQueryForOccuringFilter(find: DateItemOccuringFilter & DateDayTimezoneHintFilter): RawDateQuery {
  const result: RawDateQuery = {};

  result.timezone = find.timezone;

  result.startsLte = find.occuringAt;
  result.endsGte = find.occuringAt;
  result.rStart = result.rEnd = find.occuringAt;

  return result;
}

/**
 * Builds a {@link RawDateQuery} from a {@link DateItemRangeFilter}, deriving
 * the concrete start/end dates from the provided {@link DateRangeParams}.
 *
 * When `rangeContained` is true, only items fully enclosed within the range
 * are matched. Otherwise items merely overlapping the range are included.
 *
 * @example
 * ```ts
 * const query = makeDateQueryForDateItemRangeFilter({
 *   range: { type: DateRangeType.WEEK, date: new Date() },
 *   timezone: 'America/New_York',
 *   rangeContained: false
 * });
 * ```
 *
 * @param find - Range filter with optional timezone and containment flag.
 * @returns A raw date query bounded by the resolved range.
 */
export function makeDateQueryForDateItemRangeFilter(find: DateItemRangeFilter): RawDateQuery {
  const result: RawDateQuery = {};

  result.timezone = find.timezone;

  // Apply the timezone to the date range if provided.
  const range = find.timezone ? { ...find.range, date: toZonedTime(find.range.date, find.timezone) } : find.range;
  const dates = dateRange(range);

  switch (range.type) {
    case DateRangeType.DAY:
    case DateRangeType.WEEK:
    case DateRangeType.MONTH:
      dates.end = addSeconds(dates.end, 1); // Ends on the next day to encompass the full 24 hours, instead of 23:59:59 hours.
      break;
  }

  result.rStart = dates.start;
  result.rEnd = dates.end;

  // Range returns all values that are running withing that time period.

  if (find.rangeContained) {
    // If range contained, must have started and ended within the box entirely.
    result.startsGte = dates.start;
    result.endsLte = dates.end;
  } else {
    result.startsLte = dates.end;
    result.endsGte = dates.start;
  }

  return result;
}

/**
 * Builds a {@link RawDateQuery} from explicit starts/ends boundary constraints.
 *
 * Allows callers to independently control the before/after bounds for both
 * the start and end fields of date items.
 *
 * @example
 * ```ts
 * const query = makeDateQueryForDateStartsEndsFilter({
 *   starts: { after: new Date('2026-01-01'), before: new Date('2026-12-31') },
 *   ends: { after: new Date('2026-06-01') },
 *   timezone: 'UTC'
 * });
 * ```
 *
 * @param find - Filter with optional starts/ends boundaries and timezone hint.
 * @returns A raw date query with the corresponding GTE/LTE bounds populated.
 */
export function makeDateQueryForDateStartsEndsFilter(find: DateItemQueryStartsEndsFilter & DateDayTimezoneHintFilter): RawDateQuery {
  const result: RawDateQuery = {};
  result.timezone = find.timezone;

  if (find.starts) {
    const { before, after, at: equals } = find.starts;
    result.startsGte = after ?? equals;
    result.startsLte = before ?? equals;
    result.rStart = result.startsGte ?? result.startsLte;
  }

  if (find.ends) {
    const { before, after, at: equals } = find.ends;
    result.endsGte = after ?? equals;
    result.endsLte = before ?? equals;
    result.rEnd = result.endsGte ?? result.endsLte;
  }

  return result;
}

export type DaysAndTimeFiltersFunction<F> = (dateQueryInstance: RawDateQuery) => DaysAndTimeFilter<F>;

/**
 * Creates a function that splits a {@link RawDateQuery} into separate time
 * and day filters using the supplied {@link DateQueryBuilder}.
 *
 * The day filter is only produced when a timezone is present, allowing
 * timezone-aware day-level filtering alongside the UTC time filter.
 *
 * @example
 * ```ts
 * const filtersFunction = makeDaysAndTimeFiltersFunction(mongoBuilder);
 * const rawQuery = makeDateQueryForOccuringFilter({ occuringAt: new Date() });
 * const { timeFilter, daysFilter } = filtersFunction(rawQuery);
 * ```
 *
 * @param builder - Strategy for converting date bounds into backend-specific filters.
 * @returns A function that produces a {@link DaysAndTimeFilter} from a raw query.
 */
export function makeDaysAndTimeFiltersFunction<R, F>(builder: DateQueryBuilder<R, F>): DaysAndTimeFiltersFunction<F> {
  return (dateQueryInstance: RawDateQuery) => {
    const { timezone, startsGte, startsLte, endsGte, endsLte } = dateQueryInstance;

    const startsAt = builder.makeRangeFilter(startsGte, startsLte);
    const endsAt = builder.makeRangeFilter(endsGte, endsLte);
    const timeFilter = builder.makeFieldFilter({ startsAt: startsAt, endsAt: endsAt });

    let daysFilter: Maybe<F>;

    function tzDate(date: Maybe<Date>): Maybe<Date> {
      return date ? toZonedTime(date, timezone as string) : undefined;
    }

    if (timezone) {
      const tzDayStartsAtFilter = builder.makeRangeFilter(tzDate(startsGte), tzDate(startsLte));
      const tzDayEndsAtFilter = builder.makeRangeFilter(tzDate(endsGte), tzDate(endsLte));
      daysFilter = builder.makeFieldFilter({ startsAt: tzDayStartsAtFilter, endsAt: tzDayEndsAtFilter });
    }

    return {
      timeFilter,
      daysFilter
    };
  };
}
