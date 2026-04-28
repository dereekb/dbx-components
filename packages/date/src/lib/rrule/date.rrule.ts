import { type Maybe, type TimezoneString } from '@dereekb/util';
import { RRule, type Options } from 'rrule';
import { type CalendarDate, type DateSet, type DateRange, type DateRangeParams, dateRange, maxFutureDate, durationSpanToDateRange } from '../date';
import { type BaseDateAsUTC, DateTimezoneUtcNormalInstance } from '../date/date.timezone';
import { DateRRule } from './date.rrule.extension';
import { DateRRuleParseUtility, type RRuleLines, type RRuleStringLineSet, type RRuleStringSetSeparation } from './date.rrule.parse';

/**
 * Alias emphasizing that dates passed to the RRule library must be expressed
 * in UTC, since RRule internally treats all timestamps as UTC.
 */
export type RRuleBaseDateAsUTC = BaseDateAsUTC;

/**
 * Options controlling which portion of a recurrence rule is expanded into
 * concrete dates. Provide either a resolved {@link DateRange} or
 * {@link DateRangeParams} to limit the expansion window.
 */
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

/**
 * Parameters for constructing a {@link DateRRuleInstance}. Exactly one of
 * `rruleLines` or `rruleStringLineSet` must be provided.
 */
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

/**
 * Expansion options accepted by the static {@link DateRRuleUtility.expand}
 * method. Provide either a pre-built instance or parameters to build one.
 */
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

/**
 * Result of expanding a recurrence rule, containing the resolved dates and
 * the optional range that was used to bound the expansion.
 */
export interface DateRRuleExpansion {
  /**
   * Range used for expansion, if applicable.
   */
  between?: Maybe<DateRange>;
  dates: CalendarDate[];
}

/**
 * Configuration supplied when constructing a {@link DateRRuleInstance},
 * including the reference date, optional timezone, and dates to exclude.
 */
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

/**
 * A {@link DateRange} extended with recurrence-specific metadata, indicating
 * whether the recurrence runs indefinitely and when the last occurrence ends.
 */
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

/**
 * Narrowed variant of {@link RecurrenceDateRange} for rules with no end
 * (`forever: true`), guaranteeing `finalRecurrenceEndsAt` is undefined.
 */
export interface ForeverRecurrenceDateRange extends RecurrenceDateRange {
  forever: true;
  finalRecurrenceEndsAt?: undefined;
}

/**
 * Wraps an RRule with timezone-aware date normalization so that recurrence
 * expansion, next-date lookups, and range checks all work correctly across
 * timezones.
 *
 * Use the static {@link DateRRuleInstance.make} factory or
 * {@link DateRRuleUtility.makeInstance} to create instances.
 */
export class DateRRuleInstance {
  readonly rrule: DateRRule;
  readonly normalInstance: DateTimezoneUtcNormalInstance;

  /**
   * Factory that parses the RRule string, merges excluded dates, and builds
   * a fully configured instance.
   *
   * @example
   * ```ts
   * const instance = DateRRuleInstance.make({
   *   rruleLines: 'FREQ=DAILY;COUNT=5',
   *   options: { date: { startsAt: new Date(), duration: 3600000 }, timezone: 'America/Chicago' }
   * });
   * ```
   *
   * @param params - RRule source and instance options.
   * @throws Error if neither `rruleLines` nor `rruleStringLineSet` is provided.
   * @returns A new {@link DateRRuleInstance}.
   */
  static make(params: MakeDateRRuleInstance): DateRRuleInstance {
    if (!(params.rruleLines || params.rruleStringLineSet)) {
      throw new Error('Missing rruleLines or rruleStringLineSet input.');
    }

    const rruleStringLineSet = params.rruleStringLineSet ?? DateRRuleParseUtility.toRRuleStringSet(params.rruleLines as string);
    const rruleOptions = DateRRuleUtility.toRRuleOptions(rruleStringLineSet);
    const exclude = rruleOptions.exdates.addAll(params.options.exclude?.valuesArray());
    const rrule = new DateRRule(rruleOptions.options);
    return new DateRRuleInstance(rrule, {
      ...params.options,
      exclude
    });
  }

  constructor(
    rrule: RRule,
    readonly options: DateRRuleInstanceOptions
  ) {
    const tzid = rrule.origOptions.tzid;
    let dtstart = rrule.origOptions.dtstart;

    const timezone = tzid ?? options.timezone;

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
      tzid: undefined,
      dtstart
    };

    if (!rruleOptions.dtstart) {
      throw new Error('No start time specified. Must by specified in options as or via DTSTART.');
    }

    this.rrule = new DateRRule(rruleOptions, true);
  }

  get timezone(): TimezoneString {
    return this.normalInstance.config.timezone as string;
  }

  /**
   * Returns the next recurrence date on or after the given reference date,
   * or `undefined` if the recurrence has ended.
   *
   * @example
   * ```ts
   * const next = instance.nextRecurrenceDate(new Date());
   * ```
   *
   * @param from - Reference point; defaults to now.
   * @returns The next occurrence date, or `undefined`.
   */
  nextRecurrenceDate(from: Date = new Date()): Maybe<Date> {
    const baseFrom = this.normalInstance.baseDateToTargetDate(from);
    const rawNext = this.rrule.next(baseFrom);
    return rawNext ? this.normalInstance.targetDateToBaseDate(rawNext) : undefined;
  }

  /**
   * Expands the recurrence rule into concrete {@link CalendarDate} instances,
   * optionally bounded by a date range.
   *
   * @example
   * ```ts
   * const expansion = instance.expand({
   *   range: { start: new Date('2026-01-01'), end: new Date('2026-12-31') }
   * });
   * console.log(expansion.dates.length);
   * ```
   *
   * @param options - Range constraints for the expansion.
   * @throws Error when the rule expands infinitely and no range is provided.
   * @returns The expanded dates and the resolved range used.
   */
  expand(options: DateRRuleExpansionOptions): DateRRuleExpansion {
    let between: Maybe<DateRange>;

    if (options.range || options.rangeParams) {
      if (options.range) {
        between = options.range;
      } else {
        const rangeParams: DateRangeParams = options.rangeParams as DateRangeParams;
        between = dateRange(rangeParams);
      }

      between.start = this.normalInstance.baseDateToTargetDate(between.start);
      between.end = this.normalInstance.baseDateToTargetDate(between.end);
    }

    let startsAtDates: Date[];

    if (between) {
      startsAtDates = this.rrule.between(between.start, between.end, true);
    } else if (this.hasForeverRange()) {
      throw new Error('Rule expands infinitely. Specify a range.');
    } else {
      startsAtDates = this.rrule.all();
    }

    const referenceDate: CalendarDate = this.options.date as CalendarDate;
    const allDates = startsAtDates.map((startsAt) => ({ ...referenceDate, startsAt })); // Inherit calendar time, etc.
    let dates: CalendarDate[] = allDates;

    // Fix Dates w/ Timezones
    if (this.normalInstance.hasConversion) {
      dates = dates.map((x) => ({ ...x, startsAt: this.normalInstance.targetDateToBaseDate(x.startsAt) }));
    }

    // Exclude dates
    const exclude = this.options.exclude;

    if (exclude) {
      dates = dates.filter((x) => !exclude.has(x.startsAt));
    }

    return {
      between,
      dates
    };
  }

  /**
   * Checks whether at least one recurrence falls within the given date range.
   *
   * @param dateRange - The range to test against.
   * @returns `true` if any occurrence exists within the range.
   */
  haveRecurrenceInDateRange(dateRange: DateRange): boolean {
    const baseStart = this.normalInstance.targetDateToBaseDate(dateRange.start);
    const baseEnd = this.normalInstance.targetDateToBaseDate(dateRange.end);

    return this.rrule.any({ minDate: baseStart, maxDate: baseEnd });
  }

  /**
   * Computes the full date range spanned by this recurrence, from its first
   * occurrence to the end of its last occurrence (accounting for event
   * duration). Returns a {@link ForeverRecurrenceDateRange} when the rule
   * has no count or until constraint.
   *
   * @returns The recurrence date range with `forever` flag and optional `finalRecurrenceEndsAt`.
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
        end = this.rrule.last() as Date;
      }

      const referenceDate = this.options.date as CalendarDate;
      const finalRecurrenceDateRange = durationSpanToDateRange({
        ...referenceDate,
        startsAt: end
      });

      finalRecurrenceEndsAt = finalRecurrenceDateRange.end;
    }

    // Fix Dates w/ timezone.
    if (this.normalInstance.hasConversion) {
      const [startF, endF] = [start, end].filter(Boolean).map((x) => this.normalInstance.baseDateToTargetDate(x));
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

  /**
   * Returns `true` when the underlying RRule has neither a `count` nor an
   * `until` constraint, meaning it recurs indefinitely.
   *
   * @returns `true` if the rule recurs indefinitely.
   */
  hasForeverRange(): boolean {
    const options = this.rrule.options;
    return !options.count && !options.until;
  }
}

/**
 * Parsed RRule options combining the separated string components with the
 * native `rrule` library's partial {@link Options}.
 */
export interface RRuleOptions extends RRuleStringSetSeparation {
  /**
   * Options for an RRule instance
   */
  options: Partial<Options>;
}

/**
 * Stateless utility providing convenience factory and expansion methods for
 * {@link DateRRuleInstance}. Prefer these static methods over constructing
 * instances manually.
 */
export class DateRRuleUtility {
  /**
   * Expands a recurrence rule into concrete dates using either a pre-built
   * instance or parameters to build one on-the-fly.
   *
   * @example
   * ```ts
   * const result = DateRRuleUtility.expand({
   *   instanceFrom: {
   *     rruleLines: 'FREQ=WEEKLY;COUNT=4',
   *     options: { date: { startsAt: new Date(), duration: 3600000 } }
   *   },
   *   range: { start: new Date('2026-01-01'), end: new Date('2026-03-01') }
   * });
   * ```
   *
   * @param options - Instance (or parameters to create one) and optional range.
   * @throws Error if neither `instance` nor `instanceFrom` is provided.
   * @returns The expansion result containing resolved dates.
   */
  static expand(options: DateRRuleStaticExpansionOptions): DateRRuleExpansion {
    if (!options.instance && !options.instanceFrom) {
      throw new Error('Rrules be defined for expansion.');
    }

    const dateRrule = options.instance ?? DateRRuleInstance.make(options.instanceFrom as MakeDateRRuleInstance);
    return dateRrule.expand(options);
  }

  /**
   * Convenience alias for {@link DateRRuleInstance.make}.
   *
   * @param params - RRule source and instance options.
   * @returns A new {@link DateRRuleInstance}.
   */
  static makeInstance(params: MakeDateRRuleInstance): DateRRuleInstance {
    return DateRRuleInstance.make(params);
  }

  // MARK: RRule
  /**
   * Parses an {@link RRuleStringLineSet} into native {@link RRuleOptions}
   * that can be fed into the `rrule` library.
   *
   * @param rruleStringLineSet - The raw RRule string set to parse.
   * @returns Parsed options including separated EXDATE and basic rule components.
   */
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
