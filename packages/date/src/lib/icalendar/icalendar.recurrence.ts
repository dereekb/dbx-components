import { sortByNumberFunction } from '@dereekb/util';
import { DateRRuleParseUtility, type RRuleLineString, type RRuleLines, RRULE_STRING_SPLITTER } from '../rrule/date.rrule.parse';
import { type ICalendarDateTimeValue, type ICalendarRecurrence } from './icalendar.model';

/**
 * The RRule property types this bridge understands. Anything else in the input is dropped.
 *
 * DTSTART in particular is dropped on purpose: an {@link ICalendarEvent} carries its start as a typed
 * {@link ICalendarDateTimeValue}, so a DTSTART smuggled in through the recurrence would be a second,
 * conflicting source of truth for the same fact.
 */
export const ICALENDAR_RECURRENCE_RRULE_PROPERTY_TYPE = 'RRULE';
export const ICALENDAR_RECURRENCE_RDATE_PROPERTY_TYPE = 'RDATE';

/**
 * Converts the workspace's stored recurrence form into an {@link ICalendarRecurrence}.
 *
 * THE TRAP THIS EXISTS TO CLOSE: {@link ICalendarRecurrence.rules} holds the VALUE PART only
 * ("FREQ=WEEKLY;BYDAY=MO"), because the serializer emits `RRULE:${rule}`. The stored form —
 * {@link RRuleLines}, as carried by ModelRecurrenceInfo.rrule — is a newline-joined blob that KEEPS the
 * "RRULE:" prefix and may also carry EXDATE/RDATE lines. Passing one straight into the other emits
 * "RRULE:RRULE:FREQ=..." and every client silently drops the rule.
 *
 * The expansion path needs none of this: DateRRuleInstance feeds the same string to RRule.parseString(),
 * which handles the prefix natively. The mismatch bites in exactly one place, which is here.
 *
 * @param lines - The stored recurrence lines.
 * @returns The recurrence, with EXDATE lines routed to exceptionDates and RDATE lines to additionalDates.
 *
 * @example
 * ```ts
 * iCalendarRecurrenceForRRuleLines('RRULE:FREQ=WEEKLY;BYDAY=MO'); // { rules: ['FREQ=WEEKLY;BYDAY=MO'] }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarRecurrenceForRRuleLines(lines: RRuleLines): ICalendarRecurrence {
  const lineSet = DateRRuleParseUtility.toRRuleStringSet(lines)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

  const { basic, exdates } = DateRRuleParseUtility.separateRRuleStringSetValues(lineSet);

  const rules: RRuleLineString[] = [];
  const additionalDates: ICalendarDateTimeValue[] = [];

  basic.forEach((line) => {
    if (line.includes(RRULE_STRING_SPLITTER)) {
      const property = DateRRuleParseUtility.parseProperty(line);

      switch (property.type) {
        case ICALENDAR_RECURRENCE_RRULE_PROPERTY_TYPE:
          rules.push(property.values);
          break;
        case ICALENDAR_RECURRENCE_RDATE_PROPERTY_TYPE:
          DateRRuleParseUtility.parseExdateAttributeFromProperty(property).dates.forEach((at) => additionalDates.push({ type: 'utc', at }));
          break;
      }
    } else {
      // already a bare value part. I.E. "FREQ=WEEKLY;BYDAY=MO"
      rules.push(line);
    }
  });

  // sorted so identical input yields byte-identical output, which a Set's iteration order does not promise
  const exceptionDates: ICalendarDateTimeValue[] = exdates
    .valuesArray()
    .sort(sortByNumberFunction<Date>((x) => x.getTime()))
    .map((at) => ({ type: 'utc' as const, at }));

  const result: ICalendarRecurrence = {
    rules,
    ...(exceptionDates.length ? { exceptionDates } : undefined),
    ...(additionalDates.length ? { additionalDates } : undefined)
  };

  return result;
}
