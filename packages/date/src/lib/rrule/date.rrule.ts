import { Maybe, TimezoneString } from '@dereekb/util';
import { RRule, Options } from 'rrule';
import { CalendarDate, DateSet, DateRange, DateRangeParams, makeDateRange, maxFutureDate, durationSpanToDateRange } from '../date';
import { BaseDateAsUTC, calculateAllConversions, DateTimezoneUtcNormalInstance } from '../date/date.timezone';
import { DateRRule } from './date.rrule.extension';
import { DateRRuleParseUtility, RRuleLines, RRuleStringLineSet, RRuleStringSetSeparation } from './date.rrule.parse';

/**
 * Since RRule only deals with UTC date/times, dates going into it must always be in UTC.
 */
export type RRuleBaseDateAsUTC = BaseDateAsUTC;

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
  between?: Maybe<DateRange>;
  dates: CalendarDate[];
}

export interface DateRRuleInstanceOptions {
  /**
   * Start reference/date. Required if DTSTART is not provided.
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
  finalRecurrenceEndsAt?: Maybe<Date>;

}

export interface ForeverRecurrenceDateRange extends RecurrenceDateRange {
  forever: true;
  finalRecurrenceEndsAt?: undefined;
}

export class DateRRuleInstance {

  readonly rrule: DateRRule;
  readonly normalInstance: DateTimezoneUtcNormalInstance;

  /**
   * Creates a new DateRRuleInstance from the input.
   */
  static make(params: MakeDateRRuleInstance): DateRRuleInstance {
    if (!(params.rruleLines || params.rruleStringLineSet)) {
      throw new Error('Missing rruleLines or rruleStringLineSet input.');
    }

    const rruleStringLineSet = params.rruleStringLineSet ?? DateRRuleParseUtility.toRRuleStringSet(params.rruleLines!);
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

    const timezone = tzid || options.timezone;

    /**
     * The normal instance for DateRRuleInstance is used backwards in most cases because DateRRule always
     * parses dates as UTC, so we handle all input dates as base dates, an
     */
    this.normalInstance = new DateTimezoneUtcNormalInstance(timezone);

    if (dtstart && tzid) {
      // Date was passed to both. The dtstart is the base UTC date, but correct for RRule.
    } else if (timezone) {
      const startsAt: Maybe<Date> = options.date?.startsAt;

      // If startsAt is provided, need to change it to start from the base UTC date, if any timezone is provided.
      if (startsAt) {
        const baseStartDate: RRuleBaseDateAsUTC = this.normalInstance.baseDateToTargetDate(startsAt);
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

  get timezone(): TimezoneString {
    return this.normalInstance.config.timezone!;
  }

  nextRecurrenceDate(from: Date = new Date()): Maybe<Date> {
    const baseFrom = this.normalInstance.baseDateToTargetDate(from);
    const rawNext = this.rrule.next(baseFrom);
    const next = (rawNext) ? this.normalInstance.targetDateToBaseDate(rawNext) : undefined;
    return next;
  }

  /**
   * Expands the input DateRRuleExpansionOptions to a DateRRuleExpansion.
   * 
   * @param options 
   * @returns 
   */
  expand(options: DateRRuleExpansionOptions): DateRRuleExpansion {
    let between: Maybe<DateRange>;

    if (options.range || options.rangeParams) {
      between = options.range ?? makeDateRange(options.rangeParams!);
      between.start = this.normalInstance.baseDateToTargetDate(between.start);
      between.end = this.normalInstance.baseDateToTargetDate(between.end);
    }

    let startsAtDates: Date[];

    if (between) {
      // This finds all 
      startsAtDates = this.rrule.between(between.start, between.end, true);
    } else if (this.hasForeverRange()) {
      throw new Error('Rule expands infinitely. Specify a range.');
    } else {
      startsAtDates = this.rrule.all();
    }

    const referenceDate: CalendarDate = this.options.date!;
    const allDates = startsAtDates.map(startsAt => ({ ...referenceDate, startsAt })); // Inherit calendar time, etc.
    let dates: CalendarDate[] = allDates;

    // Fix Dates w/ Timezones
    if (this.normalInstance.hasConversion) {
      dates = dates.map((x) => ({ ...x, startsAt: this.normalInstance.targetDateToBaseDate(x.startsAt) }));
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
    const baseStart = this.normalInstance.targetDateToBaseDate(dateRange.start);
    const baseEnd = this.normalInstance.targetDateToBaseDate(dateRange.end);

    return this.rrule.any({ minDate: baseStart, maxDate: baseEnd });
  }

  /**
   * Returns the date range from when the recurrence starts, to the end date.
   */
  getRecurrenceDateRange(): RecurrenceDateRange | ForeverRecurrenceDateRange {
    const options = this.rrule.options;
    const forever = this.hasForeverRange();

    let start: Date = this.rrule.options.dtstart;
    let end: Date;
    let finalRecurrenceEndsAt: Date | undefined;

    if (forever) {
      end = maxFutureDate();
      finalRecurrenceEndsAt = undefined;
    } else {

      if (options.until) {
        end = this.rrule.before(options.until, true);
      } else {
        end = this.rrule.last()!;
      }

      const referenceDate = this.options.date!;
      const finalRecurrenceDateRange = durationSpanToDateRange({
        ...referenceDate,
        startsAt: end
      });

      finalRecurrenceEndsAt = finalRecurrenceDateRange.end;
    }

    // Fix Dates w/ timezone.
    if (this.normalInstance.hasConversion) {
      const [startF, endF] = [start, end].filter(x => Boolean(x)).map(x => this.normalInstance.baseDateToTargetDate(x));
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

    const dateRrule = options.instance ?? DateRRuleInstance.make(options.instanceFrom!);
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
