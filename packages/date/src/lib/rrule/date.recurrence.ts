import { Exclude, Expose, Type } from 'class-transformer';
import { type CalendarDate, type DateRange } from '../date';
import { type DateRRuleInstance, DateRRuleUtility } from './date.rrule';
import { DateRRuleParseUtility, type RRuleLines, type RRuleStringLineSet } from './date.rrule.parse';
import { type TimezoneString as UtilTimezoneString } from '@dereekb/util';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export type TimezoneString = UtilTimezoneString; // TEMPORARY: weird issue with importing primative types with jest.

export interface RecurrenceModel {
  recur?: ModelRecurrenceInfo;
  recurs: boolean;
}

/**
 * Indexed recurrence information for a model with recurrence information.
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
 * Used for expanding a ModelRecurrenceUpdate into ModelRecurrenceInfo.
 */
export class ModelRecurrenceInfoUtility {
  /**
   * Creates a ModelRecurrenceInfo instance from the input ModelRecurrenceStart.
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
