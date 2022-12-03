import { StringOrder, Maybe, mergeArrayIntoArray, firstValueFromIterable, DayOfWeek, addToSet, Day, range, DecisionFunction, FilterFunction, IndexRange, invertFilter } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsString, Matches, IsOptional, Min, IsArray } from 'class-validator';
import { getDay } from 'date-fns';
import { DateBlock, dateBlockDayOfWeekFactory, DateBlockDurationSpan, DateBlockIndex, dateBlockIndexRange, DateBlockRange, DateBlocksExpansionFactory, dateBlocksExpansionFactory, DateBlockTiming, getCurrentDateBlockTimingStartDate } from './date.block';
import { dateBlockDurationSpanHasNotStartedFilterFunction, dateBlockDurationSpanHasNotEndedFilterFunction } from './date.filter';
import { YearWeekCodeConfig, yearWeekCodeDateTimezoneInstance } from './date.week';

export enum DateScheduleDayCode {
  /**
   * Special no-op/unused code
   */
  NONE = 0,
  SUNDAY = 1, // Day.SUNDAY + 1
  MONDAY = 2,
  TUESDAY = 3,
  WEDNESDAY = 4,
  THURSDAY = 5,
  FRIDAY = 6,
  SATURDAY = 7,
  /**
   * All weekdays (Mon-Fri)
   */
  WEEKDAY = 8,
  /**
   * All weekend days (Sat/Sun)
   */
  WEEKEND = 9
}

/**
 * Encoded days of the week that the job block schedule should contain.
 */
export type DateScheduleEncodedWeek = '' | StringOrder<`${DateScheduleDayCode}`, ''>;

export const DATE_SCHEDULE_ENCODED_WEEK_REGEX = /^[0-9]{0,9}$/;

/**
 * Returns true if the input is a DateScheduleEncodedWeek.
 *
 * @param input
 * @returns
 */
export function isDateScheduleEncodedWeek(input: string): input is DateScheduleEncodedWeek {
  return DATE_SCHEDULE_ENCODED_WEEK_REGEX.test(input);
}

/**
 * Creates a DateScheduleEncodedWeek from an array of DateScheduleDayCode values.
 *
 * The returned encoded week is simplified.
 *
 * @param codes
 */
export function dateScheduleEncodedWeek(codes: DateScheduleDayCode[]): DateScheduleEncodedWeek {
  const codesSet = new Set(codes);
  const result: DateScheduleDayCode[] = [];

  if (codesSet.size >= 2) {
    let weekDays: Maybe<DateScheduleDayCode[]>;
    let hasAllWeekDays: boolean = codesSet.has(DateScheduleDayCode.WEEKDAY);

    if (!hasAllWeekDays) {
      weekDays = range(DateScheduleDayCode.MONDAY, DateScheduleDayCode.SATURDAY).filter((code) => codesSet.has(code));
      hasAllWeekDays = weekDays.length === 5;
    }

    const hasSaturday = codesSet.has(DateScheduleDayCode.SATURDAY);
    const hasSunday = codesSet.has(DateScheduleDayCode.SUNDAY);
    let hasAllWeekendDays: boolean = codesSet.has(DateScheduleDayCode.WEEKEND) || (hasSaturday && hasSunday);

    if (!hasAllWeekendDays && hasSunday) {
      result.push(DateScheduleDayCode.SUNDAY);
    }

    if (!hasAllWeekDays) {
      mergeArrayIntoArray(result, weekDays as DateScheduleDayCode[]);
    }

    if (!hasAllWeekendDays && hasSaturday) {
      result.push(DateScheduleDayCode.SATURDAY);
    }

    if (hasAllWeekDays) {
      result.push(DateScheduleDayCode.WEEKDAY);
    }

    if (hasAllWeekendDays) {
      result.push(DateScheduleDayCode.WEEKEND);
    }
  } else {
    const only = firstValueFromIterable(codesSet);

    if (only) {
      result.push(only);
    }
  }

  return result.join('') as DateScheduleEncodedWeek;
}

/**
 * Expands a DateScheduleEncodedWeek to an array of DateScheduleDayCode valeus.
 *
 * @param week
 * @returns
 */
export function expandDateScheduleEncodedWeek(week: DateScheduleEncodedWeek): DateScheduleDayCode[] {
  return Array.from(new Set(week)).map((x) => Number(x)) as DateScheduleDayCode[];
}

export type DateScheduleDayCodesInput = DateScheduleEncodedWeek | DateScheduleDayCode[];

/**
 * Converts the input DateScheduleDayCodesInput to an array of DateScheduleDayCode values.
 *
 * @param input
 * @returns
 */
export function dateScheduleDayCodes(input: DateScheduleDayCodesInput): DateScheduleDayCode[] {
  return typeof input === 'string' ? expandDateScheduleEncodedWeek(input) : input;
}

/**
 * Expands the input DateScheduleDayCodesInput to a Set of DayOfWeek values.
 *
 * @param input
 * @returns
 */
export function expandDateScheduleDayCodesToDayOfWeekSet(input: DateScheduleDayCodesInput): Set<DayOfWeek> {
  const codes: DateScheduleDayCode[] = dateScheduleDayCodes(input);
  const days = new Set<DayOfWeek>();

  codes.forEach((code) => {
    switch (code) {
      case 0:
        // do nothing
        break;
      case 8:
        addToSet(days, [1, 2, 3, 4, 5]); // monday-friday
        break;
      case 9:
        addToSet(days, [Day.SUNDAY, Day.SATURDAY]);
        break;
      default: // remove offset
        days.add((code - 1) as DayOfWeek);
        break;
    }
  });

  return days;
}

/**
 * Used to convert the input dates into a DateScheduleDayCode.
 */
export type DateScheduleDayCodeFactory = (date: Date) => DateScheduleDayCode;

export interface DateScheduleDayCodeConfig extends Pick<YearWeekCodeConfig, 'timezone'> {}

/**
 * Creates a DateScheduleDayCodeFactory using the optional input config.
 *
 * @param config
 * @returns
 */
export function dateScheduleDayCodeFactory(config?: DateScheduleDayCodeConfig): DateScheduleDayCodeFactory {
  const normal = yearWeekCodeDateTimezoneInstance(config?.timezone);
  return (date: Date) => {
    const target = normal.systemDateToTargetDate(date);
    const day = getDay(target);
    return day + 1;
  };
}

// MARK: DateSchedule
/**
 * Scheduled used to filter to disable DateBlock values for a job.
 */
export interface DateSchedule {
  /**
   * Days of the week to include.
   */
  w: DateScheduleEncodedWeek;
  /**
   * Specific DateBlockIndex values to include.
   */
  d?: DateBlockIndex[];
  /**
   * Specific DateBlockIndex values to exclude.
   */
  ex?: DateBlockIndex[];
}

export class DateSchedule implements DateSchedule {
  @Expose()
  @IsString()
  @Matches(DATE_SCHEDULE_ENCODED_WEEK_REGEX)
  w!: DateScheduleEncodedWeek;

  @Expose()
  @IsOptional()
  @Min(0, { each: true })
  @IsArray()
  d?: DateBlockIndex[];

  @Expose()
  @IsOptional()
  @Min(0, { each: true })
  @IsArray()
  ex?: DateBlockIndex[];
}

// MARK: DateScheduleDateBlockTimingFilter
export type DateScheduleDateBlockTimingFilter<B extends DateBlock = DateBlock> = DecisionFunction<B>;

/**
 * Configuration for dateScheduleDateBlockTimingFilter()
 */
export interface DateScheduleDateBlockTimingFilterConfig {
  timing: DateBlockTiming;
  schedule: DateSchedule;
  /**
   * Wether or not to expand on the inverse of the schedule, returning blocks that are not in the schedule.
   *
   * Other date filtering behaves the same (I.E. onlyBlocksNotYetStarted, etc.)
   */
  invertSchedule?: boolean;
  /**
   * (Optional) date to use when filtering from now.
   */
  now?: Date;
  /**
   * (Optional) filters in blocks that have not yet started.
   */
  onlyBlocksNotYetStarted?: boolean;
  /**
   * (Optional) filters in blocks that have not yet ended.
   */
  onlyBlocksNotYetEnded?: boolean;
  /**
   * (Optional) Maximum number of blocks to return.
   */
  maxDateBlocksToReturn?: number;
}

/**
 * Creates a DateScheduleDateBlockTimingFilter.
 *
 * @param param0
 * @returns
 */
export function dateScheduleDateBlockTimingFilter<B extends DateBlock = DateBlock>({ timing, schedule }: DateScheduleDateBlockTimingFilterConfig): DateScheduleDateBlockTimingFilter<B> {
  const allowedDays: Set<DayOfWeek> = expandDateScheduleDayCodesToDayOfWeekSet(schedule.w);

  // start date in the current system timezone.
  const firstDate = getCurrentDateBlockTimingStartDate(timing);
  const firstDateDay = getDay(firstDate);
  const dayForIndex = dateBlockDayOfWeekFactory(firstDateDay);
  const includedIndexes = new Set(schedule.d);
  const excludedIndexes = new Set(schedule.ex);

  return (block: Readonly<B>) => {
    const i = block.i;
    const day = dayForIndex(i);
    return (allowedDays.has(day) && !excludedIndexes.has(i)) || includedIndexes.has(i);
  };
}

/**
 * Creates a DateBlocksExpansionFactory using the input DateScheduleDateBlockTimingFilterConfig.
 *
 * @param config
 * @returns
 */
export function expandDateScheduleFactory<B extends DateBlock = DateBlock>(config: DateScheduleDateBlockTimingFilterConfig): DateBlocksExpansionFactory<B> {
  const { invertSchedule = false, now, onlyBlocksNotYetEnded, onlyBlocksNotYetStarted, maxDateBlocksToReturn } = config;
  let durationSpanFilter: FilterFunction<DateBlockDurationSpan<DateBlock>> | undefined;

  if (onlyBlocksNotYetStarted) {
    durationSpanFilter = dateBlockDurationSpanHasNotStartedFilterFunction(now);
  } else if (onlyBlocksNotYetEnded) {
    durationSpanFilter = dateBlockDurationSpanHasNotEndedFilterFunction(now);
  }

  const expansionFactory = dateBlocksExpansionFactory<B>({
    timing: config.timing,
    filter: invertFilter(dateScheduleDateBlockTimingFilter(config) as FilterFunction, invertSchedule), // TODO: Use invertDecision
    durationSpanFilter,
    maxDateBlocksToReturn
  });

  return expansionFactory;
}

export interface ExpandDateScheduleInput extends DateScheduleDateBlockTimingFilterConfig {
  inputRange?: IndexRange;
}

/**
 * Expands the input DateBlockTiming and DateSchedule into an array of DateBlockDurationSpan value that correspond with blocks in the event.
 *
 * Can optionally provide an IndexRange to specify a specific range to filter on. The range will be capped to the range of the timing.
 *
 * @param timing
 * @param schedule
 * @param inputRange
 * @returns
 */
export function expandDateSchedule(input: ExpandDateScheduleInput): DateBlockDurationSpan<DateBlock>[] {
  const { timing, inputRange } = input;
  const expansionFactory = expandDateScheduleFactory(input);
  const completeRange = dateBlockIndexRange(timing);
  const range = inputRange ? { minIndex: Math.max(inputRange.minIndex, completeRange.minIndex), maxIndex: Math.min(inputRange.maxIndex, completeRange.maxIndex) } : completeRange;
  const dateBlockForRange: DateBlockRange = {
    i: range.minIndex,
    to: range.maxIndex
  }; // Index is considered to be used as inclusive already, so no need to use dateBlockIndexRangeToDateBlockRange

  return expansionFactory([dateBlockForRange]);
}
