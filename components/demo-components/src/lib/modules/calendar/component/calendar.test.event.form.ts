import { DbxDateTimeFieldTimeMode, dbxForgeDateTimeField, dbxForgeNumberField, dbxForgeTextField } from '@dereekb/dbx-form';

/**
 * Example rule shown in the recurrence rule field's description.
 */
export const DEMO_CALENDAR_TEST_EVENT_EXAMPLE_RECURRENCE_RULE = 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=8';

/**
 * Returns all form fields for a test calendar event: name, startsAt, durationMinutes, and recurrenceRule.
 *
 * @returns Array of forge field configurations for creating a test calendar event.
 */
export function demoCalendarTestEventFields() {
  return [demoCalendarTestEventNameField(), demoCalendarTestEventStartsAtField(), demoCalendarTestEventDurationMinutesField(), demoCalendarTestEventRecurrenceRuleField()];
}

/**
 * Creates a text field for the test event's display name.
 *
 * @returns A forge text field configuration for the event name.
 */
export function demoCalendarTestEventNameField() {
  return dbxForgeTextField({ key: 'name', label: 'Name', description: 'Leave empty to let the server generate a name.' });
}

/**
 * Creates a date-time field for the instant the recurrence is anchored to.
 *
 * The anchor carries the time of day every occurrence inherits, so time is required here.
 *
 * @returns A forge date-time field configuration for the event start.
 */
export function demoCalendarTestEventStartsAtField() {
  return dbxForgeDateTimeField({ key: 'startsAt', label: 'Starts At', required: true, props: { timeMode: DbxDateTimeFieldTimeMode.REQUIRED }, description: 'The first occurrence of the series. Its time of day is inherited by every later occurrence.' });
}

/**
 * Creates a number field for the test event's duration.
 *
 * @returns A forge number field configuration for the event duration in minutes.
 */
export function demoCalendarTestEventDurationMinutesField() {
  return dbxForgeNumberField({ key: 'durationMinutes', label: 'Duration (Minutes)', min: 1, description: 'Leave empty to use the server default of 60 minutes.' });
}

/**
 * Creates a text field for the RFC 5545 recurrence rule driving the series.
 *
 * There is no dedicated RRULE field in `@dereekb/dbx-form`, so the rule is entered as raw text — which is
 * also the point of this form: typing a rule and seeing exactly where its occurrences land.
 *
 * @returns A forge text field configuration for the recurrence rule.
 */
export function demoCalendarTestEventRecurrenceRuleField() {
  // the server always writes a recurring test event as `rfe: true` (never ends), so a series is bounded
  // from inside the rule with COUNT= / UNTIL= rather than by a separate end date
  return dbxForgeTextField({ key: 'recurrenceRule', label: 'Recurrence Rule', required: true, description: `I.E. "${DEMO_CALENDAR_TEST_EVENT_EXAMPLE_RECURRENCE_RULE}". Bound the series with COUNT= or UNTIL=, as the test event is always written as a never-ending recurrence.` });
}
