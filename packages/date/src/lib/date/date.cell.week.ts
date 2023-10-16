import { DayOfWeek, getNextDay, MapFunction, Maybe } from '@dereekb/util';
import { DateCellIndex, DateCellTiming } from './date.cell';
import { YearWeekCode, YearWeekCodeDateReader, YearWeekCodeFactory, yearWeekCodeFromDate, yearWeekCodeGroupFactory, YearWeekCodeGroupFactory, YearWeekCodeReader } from './date.week';
import { dateCellTimingStartDateFactory } from './date.cell.factory';

/**
 * Converts the input index into the DayOfWeek that it represents.
 */
export type DateCellDayOfWeekFactory = MapFunction<DateCellIndex, DayOfWeek>;

/**
 * Creates a DateCellDayOfWeekFactory.
 *
 * @param dayForIndexZero
 * @returns
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

export function dateCellIndexYearWeekCodeFactory(config: DateCellIndexYearWeekCodeConfig): DateCellIndexYearWeekCodeFactory {
  const { timing } = config;
  const startDateFactory = dateCellTimingStartDateFactory(timing);
  const normalInstance = startDateFactory._indexFactory._normalInstance;

  return (indexOrDate: DateCellIndex | Date) => {
    const dateInSystemTimezone = normalInstance.systemDateToTargetDate(startDateFactory(indexOrDate));
    const yearWeekCode = yearWeekCodeFromDate(dateInSystemTimezone);
    return yearWeekCode;
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

export function dateCellIndexYearWeekCodeGroupFactory<B>(config: DateCellIndexYearWeekCodeGroupFactoryConfig<B>): YearWeekCodeGroupFactory<B> {
  const { dateCellIndexReader, dateCellIndexYearWeekCodeFactory: inputDateCellIndexYearWeekCodeFactory } = config;
  const dateCellIndexYearWeekCode = typeof inputDateCellIndexYearWeekCodeFactory === 'function' ? inputDateCellIndexYearWeekCodeFactory : dateCellIndexYearWeekCodeFactory(inputDateCellIndexYearWeekCodeFactory);

  const factory = yearWeekCodeGroupFactory<B>({
    yearWeekCodeFactory: dateCellIndexYearWeekCode as YearWeekCodeFactory,
    yearWeekCodeReader: dateCellIndexYearWeekCode as YearWeekCodeReader,
    dateReader: dateCellIndexReader as YearWeekCodeDateReader<B>
  });

  return factory;
}
