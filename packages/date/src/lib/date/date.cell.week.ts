import { type DayOfWeek, getNextDay, type MapFunction, type Maybe } from '@dereekb/util';
import { type DateCellIndex, type DateCellTiming } from './date.cell';
import { type YearWeekCode, type YearWeekCodeDateReader, type YearWeekCodeFactory, yearWeekCodeFromDate, yearWeekCodeGroupFactory, type YearWeekCodeGroupFactory, type YearWeekCodeReader } from './date.week';
import { dateCellTimingStartDateFactory } from './date.cell.factory';

/**
 * Converts the input index into the DayOfWeek that it represents.
 */
export type DateCellDayOfWeekFactory = MapFunction<DateCellIndex, DayOfWeek>;

/**
 * Creates a factory that maps a {@link DateCellIndex} to its corresponding {@link DayOfWeek}.
 *
 * @param inputDayForIndexZero - the day of the week for index 0 (can be a DayOfWeek number or a Date)
 * @returns a function that computes the day of the week for any given index
 *
 * @example
 * ```ts
 * import { Day } from '@dereekb/util';
 * const dayFactory = dateCellDayOfWeekFactory(Day.MONDAY);
 * dayFactory(0); // Day.MONDAY
 * dayFactory(1); // Day.TUESDAY
 * dayFactory(6); // Day.SUNDAY
 * ```
 */
export function dateCellDayOfWeekFactory(inputDayForIndexZero: DayOfWeek | Date): DateCellDayOfWeekFactory {
  const dayForIndexZero = typeof inputDayForIndexZero === 'number' ? inputDayForIndexZero : (inputDayForIndexZero.getDay() as DayOfWeek);
  return (index: DateCellIndex) => getNextDay(dayForIndexZero, index);
}

/**
 * Used to return the proper YearWeekCode for the input DateCellIndex relative to the configured timing, or a Date.
 */
export type DateCellIndexYearWeekCodeFactory = (indexOrDate: DateCellIndex | Date) => YearWeekCode;

export interface DateCellIndexYearWeekCodeConfig {
  readonly timing: DateCellTiming;
}

/**
 * Creates a factory that computes the {@link YearWeekCode} for a given {@link DateCellIndex} or Date, relative to the configured timing.
 *
 * @param config - timing configuration to compute dates from indexes
 * @returns a function that returns the YearWeekCode for a given index or date
 */
export function dateCellIndexYearWeekCodeFactory(config: DateCellIndexYearWeekCodeConfig): DateCellIndexYearWeekCodeFactory {
  const { timing } = config;
  const startDateFactory = dateCellTimingStartDateFactory(timing);
  const normalInstance = startDateFactory._indexFactory._normalInstance;

  return (indexOrDate: DateCellIndex | Date) => {
    const dateInSystemTimezone = normalInstance.systemDateToTargetDate(startDateFactory(indexOrDate));
    return yearWeekCodeFromDate(dateInSystemTimezone);
  };
}

/**
 * MapFunction that reads the relevant date to use for the YearWeekCode calculation from the input item.
 */
export type DateCellIndexYearWeekCodeReader<B> = MapFunction<B, Maybe<DateCellIndex | Date>>;

export interface DateCellIndexYearWeekCodeGroupFactoryConfig<B> {
  readonly dateCellIndexReader: DateCellIndexYearWeekCodeReader<B>;
  readonly dateCellIndexYearWeekCodeFactory: DateCellIndexYearWeekCodeFactory | DateCellIndexYearWeekCodeConfig;
}

/**
 * Creates a factory that groups items by their {@link YearWeekCode} based on a DateCellIndex reader and timing.
 *
 * @param config - reader and factory configuration
 * @returns a function that groups input items into YearWeekCode groups
 */
export function dateCellIndexYearWeekCodeGroupFactory<B>(config: DateCellIndexYearWeekCodeGroupFactoryConfig<B>): YearWeekCodeGroupFactory<B> {
  const { dateCellIndexReader, dateCellIndexYearWeekCodeFactory: inputDateCellIndexYearWeekCodeFactory } = config;
  const dateCellIndexYearWeekCode = typeof inputDateCellIndexYearWeekCodeFactory === 'function' ? inputDateCellIndexYearWeekCodeFactory : dateCellIndexYearWeekCodeFactory(inputDateCellIndexYearWeekCodeFactory);

  return yearWeekCodeGroupFactory<B>({
    yearWeekCodeFactory: dateCellIndexYearWeekCode as YearWeekCodeFactory,
    yearWeekCodeReader: dateCellIndexYearWeekCode as YearWeekCodeReader,
    dateReader: dateCellIndexReader as YearWeekCodeDateReader<B>
  });
}
