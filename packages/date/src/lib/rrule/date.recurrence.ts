import { Exclude, Expose, Type } from 'class-transformer';
import { type CalendarDate, type DateRange } from '../date';
import { type DateRRuleInstance, DateRRuleUtility } from './date.rrule';
import { DateRRuleParseUtility, type RRuleLines, type RRuleStringLineSet } from './date.rrule.parse';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { type TimezoneString } from '@dereekb/util';

/**
 * Marks an entity as potentially recurring by carrying optional
 * {@link ModelRecurrenceInfo} and a convenience boolean flag.
 */
export interface RecurrenceModel {
  /** Detailed recurrence metadata; undefined when the model does not recur. */
  recur?: ModelRecurrenceInfo;
  /** Quick check for whether this model has active recurrence rules. */
  recurs: boolean;
}

/**
 * Serializable recurrence metadata stored alongside a model, containing the
 * RRule string, the computed start/end of the recurrence window, and a
 * "forever" flag. Implements {@link DateRange} for easy integration with
 * date-range utilities.
 *
 * Decorated with `class-transformer` / `class-validator` for automatic
 * serialization and validation.
 */
@Exclude()
export class ModelRecurrenceInfo implements DateRange {
  /**
   * Timezone the rule is a part of.
   *
   * Required for RRules that have timezone-sensitive implementations.
   */
  @Expose()
  @IsOptional()
  @IsString()
  timezone?: TimezoneString;

  /**
   * RRules for this recurrence.
   */
  @Expose()
  @IsString()
  rrule!: RRuleLines;

  /**
   * First instance of the recurrence.
   */
  @Expose()
  @Type(() => Date)
  start!: Date;

  /**
   * Final instance of the recurrence.
   */
  @Expose()
  @Type(() => Date)
  end!: Date;

  /**
   * True if the recurrence has no end.
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  forever?: boolean;

  constructor(template?: ModelRecurrenceInfo) {
    if (template != null) {
      this.timezone = template.timezone;
      this.rrule = template.rrule;
      this.start = template.start;
      this.end = template.end;
      this.forever = template.forever;
    }
  }
}

/**
 * Input used to create or update recurrence on a model, before it is
 * expanded into a full {@link ModelRecurrenceInfo}.
 */
export interface ModelRecurrenceStart {
  /**
   * Lines/set of rules to follow.
   */
  rrule: RRuleStringLineSet;

  /**
   * Date information for the recurrence.
   */
  date: CalendarDate;

  /**
   * Timezone the recurrence should follow.
   */
  timezone?: TimezoneString;
}

/**
 * Stateless utility for converting between recurrence input
 * ({@link ModelRecurrenceStart}) and the indexed storage form
 * ({@link ModelRecurrenceInfo}).
 */
export class ModelRecurrenceInfoUtility {
  /**
   * Expands a {@link ModelRecurrenceStart} into a fully resolved
   * {@link ModelRecurrenceInfo} by parsing the RRule, computing the
   * recurrence date range, and populating the `forever` flag.
   *
   * @example
   * ```ts
   * const info = ModelRecurrenceInfoUtility.expandModelRecurrenceStartToModelRecurrenceInfo({
   *   rrule: ['FREQ=WEEKLY;COUNT=10'],
   *   date: { startsAt: new Date(), duration: 3600000 },
   *   timezone: 'America/Chicago'
   * });
   * ```
   *
   * @param update - The recurrence start input to expand.
   * @returns A new {@link ModelRecurrenceInfo} with computed start, end, and forever fields.
   */
  static expandModelRecurrenceStartToModelRecurrenceInfo(update: ModelRecurrenceStart): ModelRecurrenceInfo {
    const { date, rrule, timezone } = update;

    const dateRRule = DateRRuleUtility.makeInstance({
      rruleStringLineSet: rrule,
      options: {
        date
      }
    });

    const dates = dateRRule.getRecurrenceDateRange();
    const rruleSetString: RRuleLines = DateRRuleParseUtility.toRRuleLines(rrule);

    const recurrenceInfo = {
      timezone,
      rrule: rruleSetString,
      start: dates.start,
      end: dates.finalRecurrenceEndsAt ?? dates.end,
      forever: dates.forever
    };

    return new ModelRecurrenceInfo(recurrenceInfo);
  }

  /**
   * Creates a {@link DateRRuleInstance} from stored {@link ModelRecurrenceInfo}
   * and a reference {@link CalendarDate}, allowing further expansion or
   * recurrence queries.
   *
   * @example
   * ```ts
   * const instance = ModelRecurrenceInfoUtility.makeDateRRuleInstance(
   *   model.recur,
   *   { startsAt: new Date(), duration: 3600000 }
   * );
   * const nextDate = instance.nextRecurrenceDate();
   * ```
   *
   * @param info - Stored recurrence metadata.
   * @param date - Reference calendar date providing startsAt and duration.
   * @returns A new {@link DateRRuleInstance} ready for expansion.
   */
  static makeDateRRuleInstance(info: ModelRecurrenceInfo, date: CalendarDate): DateRRuleInstance {
    const { rrule, timezone } = info;

    return DateRRuleUtility.makeInstance({
      rruleLines: rrule,
      options: {
        date,
        timezone
      }
    });
  }
}
