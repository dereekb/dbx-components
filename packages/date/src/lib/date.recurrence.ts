import { Exclude, Expose } from 'class-transformer';
import { DateRange, TimezoneString } from './date';
import { DateRRuleInstance, DateRRuleParseUtility, DateRRuleUtility, RRuleLines, RRuleStringLineSet } from './date.rrule';
import { CalendarDate } from './date.calendar';

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
  timezone?: TimezoneString;

  /**
   * RRules for this recurrence.
   */
  @Expose()
  rrule: RRuleLines;

  /**
   * First instance of the recurrence.
   */
  @Expose()
  start: Date;

  /**
   * Final instance of the recurrence.
   */
  @Expose()
  end: Date;

  /**
   * True if the recurrence has no end.
   */
  @Expose()
  forever?: boolean;

  constructor(template?: ModelRecurrenceInfo) {
    if (template) {
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

    const dateRange = dateRRule.getRecurrenceDateRange();
    const rruleSetString: RRuleLines = DateRRuleParseUtility.toRRuleLines(rrule);

    const recurrenceInfo = {
      timezone,
      rrule: rruleSetString,
      start: dateRange.start,
      end: dateRange.finalRecurrenceEndsAt ?? dateRange.end,
      forever: dateRange.forever
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
