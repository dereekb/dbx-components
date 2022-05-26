import { Maybe, TimezoneString } from '@dereekb/util';
import { addSeconds } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
import { DateRangeType, makeDateRange } from '../date/date.range';
import { DateDayTimezoneHintFilter, DateItemOccuringFilter, DateItemQueryStartsEndsFilter, DateItemRangeFilter } from './query.filter';

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
 *
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

export interface MakeFieldFilterInput<R> {
  startsAt?: Maybe<R>;
  endsAt?: Maybe<R>;
}

export type MakeFieldFilterFunction<R, F> = (input: MakeFieldFilterInput<R>) => F;

export function makeDateQueryForOccuringFilter(find: DateItemOccuringFilter & DateDayTimezoneHintFilter): RawDateQuery {
  const result: RawDateQuery = {};

  result.timezone = find.timezone;

  result.startsLte = find.occuringAt;
  result.endsGte = find.occuringAt;
  result.rStart = result.rEnd = find.occuringAt;

  return result;
}

export function makeDateQueryForDateItemRangeFilter(find: DateItemRangeFilter): RawDateQuery {
  const result: RawDateQuery = {};

  result.timezone = find.timezone;

  // Apply the timezone to the date range if provided.
  const range = find.timezone ? { ...find.range, date: utcToZonedTime(find.range.date, find.timezone) } : find.range;
  const dateRange = makeDateRange(range);

  switch (range.type) {
    case DateRangeType.DAY:
    case DateRangeType.WEEK:
    case DateRangeType.MONTH:
      dateRange.end = addSeconds(dateRange.end, 1); // Ends on the next day to encompass the full 24 hours, instead of 23:59:59 hours.
      break;
  }

  result.rStart = dateRange.start;
  result.rEnd = dateRange.end;

  // Range returns all values that are running withing that time period.

  if (find.rangeContained) {
    // If range contained, must have started and ended within the box entirely.
    result.startsGte = dateRange.start;
    result.endsLte = dateRange.end;
  } else {
    result.startsLte = dateRange.end;
    result.endsGte = dateRange.start;
  }

  return result;
}

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

export function makeDaysAndTimeFiltersFunction<R, F>(builder: DateQueryBuilder<R, F>): DaysAndTimeFiltersFunction<F> {
  return (dateQueryInstance: RawDateQuery) => {
    const { timezone, startsGte, startsLte, endsGte, endsLte } = dateQueryInstance;

    const startsAt = builder.makeRangeFilter(startsGte, startsLte);
    const endsAt = builder.makeRangeFilter(endsGte, endsLte);
    const timeFilter = builder.makeFieldFilter({ startsAt: startsAt, endsAt: endsAt });

    let daysFilter: Maybe<F>;

    function tzDate(date: Maybe<Date>): Maybe<Date> {
      return date ? utcToZonedTime(date, timezone as string) : undefined;
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
