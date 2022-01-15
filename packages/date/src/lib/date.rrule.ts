import { addHours, addMilliseconds } from 'date-fns';
import { getTimezoneOffset, utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { RRule, Options, rrulestr, RRuleSet } from 'rrule';
import { DateUtility, TimezoneString, DateRange, DateRangeParams } from './date';
import { CalendarDate } from './date.calendar';
import { DateSet } from './date.hashset';
import { DateRRule } from './date.rrule.extension';
import { DateRRuleParseUtility, RRuleLines, RRuleStringLineSet, RRuleStringSetSeparation } from './date.rrule.parse';
export * from './date.rrule.parse';

/**
 * Since RRule only deals with UTC date/times, dates going into it must always be in UTC.
 *
 * We use this "weird" date when transforming an instance (11AM in Los Angeles) into a UTC date that says the same thing,
 * 11AM UTC.
 */
export type RRuleBaseDateAsUTC = Date;

export interface DateRRuleExpansionOptions {

  /**
   * Start/End Dates to get the range between.
   */
  range?: DateRange;

  /**
   * Optional DateRangeParams to derive the start/end from.
   */
  rangeParams?: DateRangeParams;

}

export interface MakeDateRRuleInstance {

  /**
   * Lines string to build an RRule from.
   */
  rruleLines?: RRuleLines;

  /**
   * Line set to build an RRule from.
   */
  rruleStringLineSet?: RRuleStringLineSet;

  /**
   * Options to use when creating the DateRRule.
   */
  options: DateRRuleInstanceOptions;
}

export interface DateRRuleStaticExpansionOptions extends DateRRuleExpansionOptions {

  /**
   * DateRRuleInstanceInstance to use for expansion.
   */
  instance?: DateRRuleInstance;

  /**
   * DateRRuleInstance to build.
   */
  instanceFrom?: MakeDateRRuleInstance;

}

export interface DateRRuleExpansion {
  /**
   * Range used for expansion, if applicable.
   */
  between?: DateRange;
  dates: CalendarDate[];
}

export interface DateRRuleInstanceOptions {
  /**
   * Start date. Required if DTSTART is not provided.
   */
  date?: CalendarDate;
  /**
   * (Optional) Timezone to use for the recurrence.
   *
   * This is not the timezone to convert values to, as this is
   */
  timezone?: TimezoneString;
  /**
   * Dates to exclude.
   */
  exclude?: DateSet;
}

export interface RecurrenceDateRange extends DateRange {

  /**
   * True if the recurrence never ends.
   */
  forever: boolean;

  /**
   * Date the final recurrence will end at, based on the duration of the event.
   * 
   * If forever, this date is undefined.
   */
  finalRecurrenceEndsAt?: Date;

}

export class DateRRuleInstance {

  readonly rrule: DateRRule;

  /**
   * Timezone the events originally occur in.
   */
  readonly timezone: TimezoneString;

  /**
   * Creates a new DateRRuleInstance from the input.
   */
  static make(params: MakeDateRRuleInstance): DateRRuleInstance {
    if (!(params.rruleLines || params.rruleStringLineSet)) {
      throw new Error('Missing rruleLines or rruleStringLineSet input.');
    }

    const rruleStringLineSet = params.rruleStringLineSet ?? DateRRuleParseUtility.toRRuleStringSet(params.rruleLines);
    const rruleOptions = DateRRuleUtility.toRRuleOptions(rruleStringLineSet);
    const exclude = rruleOptions.exdates.addAll(params.options.exclude?.valuesArray());
    const rrule = new DateRRule(rruleOptions.options);
    return new DateRRuleInstance(rrule, {
      ...params.options,
      exclude
    });
  }

  constructor(rrule: RRule, readonly options: DateRRuleInstanceOptions) {

    const tzid = rrule.origOptions.tzid;
    let dtstart = rrule.origOptions.dtstart;

    this.timezone = tzid || options.timezone;

    if (dtstart && tzid) {
      // Date was passed to both. The dtstart is the base UTC date, but correct for RRule.
    } else if (this.timezone) {
      const startsAt: Date = options.date?.startsAt;

      // If startsAt is provided, need to change it to start from the "weird" UTC date, if any timezone is provided.
      if (startsAt) {
        const baseStartDate: RRuleBaseDateAsUTC = this._normalDateToBaseDateFn()(options.date?.startsAt);
        dtstart = baseStartDate;
      }
    } else {
      // If start date is provided without a timezone, assume timezone is UTC. Do nothing.
      dtstart = dtstart ?? options.date?.startsAt;
    }

    const rruleOptions: Partial<Options> = {
      ...rrule.origOptions,
      // tzid,
      dtstart
    };

    if (!rruleOptions.dtstart) {
      throw new Error('No start time specified. Must by specified in options as or via DTSTART.');
    }

    this.rrule = new DateRRule(rruleOptions, true);
  }

  nextRecurrenceDate(from: Date = new Date()): Date {
    const baseFrom = this._normalDateToBaseDateFn()(from);
    const rawNext = this.rrule.next(baseFrom);
    const next = (rawNext) ? this._baseDateToNormalDateFn()(rawNext) : undefined;
    return next;
  }

  expand(options: DateRRuleExpansionOptions): DateRRuleExpansion {
    let between: DateRange;

    const convertToBaseDateFn = this._normalDateToBaseDateFn();

    if (options.range ?? options.rangeParams) {
      between = options.range ?? DateUtility.makeDateRange(options.rangeParams);

      if (convertToBaseDateFn) {
        between.start = convertToBaseDateFn(between.start);
        between.end = convertToBaseDateFn(between.end);
      }
    }

    let startsAtDates: Date[];

    if (between) {
      startsAtDates = this.rrule.between(between.start, between.end, true);
    } else if (this.hasForeverRange()) {
      throw new Error('Rule expands infinitely. Specify a range.');
    } else {
      startsAtDates = this.rrule.all();
    }

    const referenceDate = this.options.date;
    const allDates = startsAtDates.map(startsAt => ({ ...referenceDate, startsAt })); // Inherit calendar time, etc.
    let dates = allDates;

    // Fix Dates w/ Timezones
    const fixDateFn = this._baseDateToNormalDateFn();

    if (fixDateFn) {
      dates = dates.map((x) => ({ ...x, startsAt: fixDateFn(x.startsAt) }));
    }

    // Exclude dates
    const exclude = this.options.exclude;

    if (exclude) {
      dates = dates.filter(x => !exclude.has(x.startsAt));
    }

    return {
      between,
      dates
    };
  }

  /**
   * Returns true if there is a single date within the range.
   */
  haveRecurrenceInDateRange(dateRange: DateRange): boolean {
    const convertToBaseDateFn = this._normalDateToBaseDateFn();

    const baseStart = convertToBaseDateFn(dateRange.start);
    const baseEnd = convertToBaseDateFn(dateRange.end);

    return this.rrule.any(baseStart, baseEnd);
  }

  /**
   * Returns the date range from when the recurrence starts, to the end date.
   */
  getRecurrenceDateRange(): RecurrenceDateRange {
    const options = this.rrule.options;
    const forever = this.hasForeverRange();

    let start: Date = this.rrule.options.dtstart;
    let end: Date;
    let finalRecurrenceEndsAt: Date;

    if (forever) {
      end = DateUtility.maxFutureDate();
    } else {

      if (options.until) {
        end = this.rrule.before(options.until, true);
      } else {
        end = this.rrule.last();
      }

      const referenceDate = this.options.date;
      const finalRecurrenceDateRange = DateUtility.durationSpanToDateRange({
        ...referenceDate,
        startsAt: end
      });

      finalRecurrenceEndsAt = finalRecurrenceDateRange.end;
    }

    // Fix Dates w/ timezone.
    const fixDateFn = this._baseDateToNormalDateFn();

    if (fixDateFn) {
      const [startF, endF] = [start, end].filter(x => Boolean(x)).map(x => fixDateFn(x));
      start = startF;
      end = endF;
    }

    return {
      forever,
      start,
      end,
      finalRecurrenceEndsAt
    };
  }

  _normalDateToBaseDateFn(): ((date: RRuleBaseDateAsUTC | Date) => Date) | undefined {
    const tzid = this.timezone;

    if (tzid) {
      return (x) => {
        const offset = getTimezoneOffset(tzid, x);
        return addMilliseconds(x, offset);
      };
    } else {
      return undefined;
    }
  }

  _baseDateToNormalDateFn(): ((date: RRuleBaseDateAsUTC | Date) => Date) | undefined {
    const tzid = this.timezone;

    if (tzid) {
      return (x) => {
        const offset = getTimezoneOffset(tzid, x);
        return addMilliseconds(x, -offset);
      };
    } else {
      return undefined;
    }
  }

  hasForeverRange(): boolean {
    const options = this.rrule.options;
    const forever = !options.count && !options.until;
    return forever;
  }

}

export interface RRuleOptions extends RRuleStringSetSeparation {

  /**
   * Options for an RRule instance
   */
  options: Partial<Options>;

}

export class DateRRuleUtility {

  /**
   * Creates the expansion item results based on the input.
   */
  static expand(options: DateRRuleStaticExpansionOptions): DateRRuleExpansion {
    if (!options.instance && !options.instanceFrom) {
      throw new Error('Rrules be defined for expansion.');
    }

    const dateRrule = options.instance ?? DateRRuleInstance.make(options.instanceFrom);
    return dateRrule.expand(options);
  }

  static makeInstance(params: MakeDateRRuleInstance): DateRRuleInstance {
    return DateRRuleInstance.make(params);
  }

  // MARK: RRule
  static toRRuleOptions(rruleStringLineSet: RRuleStringLineSet): RRuleOptions {
    const rules: RRuleStringSetSeparation = DateRRuleParseUtility.separateRRuleStringSetValues(rruleStringLineSet);
    const lines = DateRRuleParseUtility.toRRuleLines(rules.basic);
    const ruleOptions = RRule.parseString(lines);

    return {
      ...rules,
      options: ruleOptions
    };
  }

}
