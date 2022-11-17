import { addDays } from 'date-fns';
import { MapFunction, Maybe } from '@dereekb/util';
import { DateBlockIndex, DateBlockTiming, getCurrentDateBlockTimingStartDate } from './date.block';
import { YearWeekCode, YearWeekCodeDateReader, YearWeekCodeFactory, yearWeekCodeFromDate, yearWeekCodeGroupFactory, YearWeekCodeGroupFactory } from './date.week';

/**
 * Used to return the proper YearWeekCode for the input DateBlockIndex relative to the configured timing, or a Date.
 */
export type DateBlockIndexYearWeekCodeFactory = (indexOrDate: DateBlockIndex | Date) => YearWeekCode;

export interface DateBlockIndexYearWeekCodeConfig {
  readonly timing: DateBlockTiming;
}

export function dateBlockIndexYearWeekCodeFactory(config: DateBlockIndexYearWeekCodeConfig): DateBlockIndexYearWeekCodeFactory {
  const { timing } = config;
  const startDate = getCurrentDateBlockTimingStartDate(timing); // midnight of day 0

  return (indexOrDate: DateBlockIndex | Date) => {
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
export type DateBlockIndexYearWeekCodeReader<B> = MapFunction<B, Maybe<DateBlockIndex | Date>>;

export interface DateBlockIndexYearWeekCodeGroupFactoryConfig<B> {
  readonly dateBlockIndexReader: DateBlockIndexYearWeekCodeReader<B>;
  readonly dateBlockIndexYearWeekCodeFactory: DateBlockIndexYearWeekCodeFactory | DateBlockIndexYearWeekCodeConfig;
}

export function dateBlockIndexYearWeekCodeGroupFactory<B>(config: DateBlockIndexYearWeekCodeGroupFactoryConfig<B>): YearWeekCodeGroupFactory<B> {
  const { dateBlockIndexReader, dateBlockIndexYearWeekCodeFactory: inputDateBlockIndexYearWeekCodeFactory } = config;
  const dateBlockIndexYearWeekCode = typeof inputDateBlockIndexYearWeekCodeFactory === 'function' ? inputDateBlockIndexYearWeekCodeFactory : dateBlockIndexYearWeekCodeFactory(inputDateBlockIndexYearWeekCodeFactory);

  const factory = yearWeekCodeGroupFactory<B>({
    yearWeekCodeFactory: dateBlockIndexYearWeekCode as YearWeekCodeFactory,
    dateReader: dateBlockIndexReader as YearWeekCodeDateReader<B>
  });

  return factory;
}
