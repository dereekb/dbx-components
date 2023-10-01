import { addDays } from 'date-fns';
import { DayOfWeek, getNextDay, MapFunction, Maybe } from '@dereekb/util';
import { DateCellIndex, DateCellTiming, getCurrentDateCellTimingStartDate } from './date.cell';
import { YearWeekCode, YearWeekCodeDateReader, YearWeekCodeFactory, yearWeekCodeFromDate, yearWeekCodeGroupFactory, YearWeekCodeGroupFactory, YearWeekCodeReader } from './date.week';

/**
 * Converts the input index into the DayOfWeek that it represents.
 */
export type DateCellDayOfWeekFactory = MapFunction<DateCellIndex, DayOfWeek>;

/**
 * Creates a DateCellDayOfWeekFactory
 *
 * @param dayForIndexZero
 * @returns
 */
export function dateCellDayOfWeekFactory(inputDayForIndexZero: DayOfWeek | Date): DateCellDayOfWeekFactory {
  const dayForIndexZero = typeof inputDayForIndexZero === 'number' ? inputDayForIndexZero : (inputDayForIndexZero.getUTCDay() as DayOfWeek);
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
  const startDate = getCurrentDateCellTimingStartDate(timing); // midnight of day 0

  return (indexOrDate: DateCellIndex | Date) => {
    let inputDate: Date;

    if (typeof indexOrDate === 'number') {
      inputDate = addDays(startDate, indexOrDate);
    } else {
      inputDate = indexOrDate;
    }

    const yearWeekCode = yearWeekCodeFromDate(inputDate);
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
