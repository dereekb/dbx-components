import { wrapDateTests } from '../../test.spec';
import { type ICalendarUtcDateTime } from './icalendar.model';
import { iCalendarRecurrenceForRRuleLines } from './icalendar.recurrence';

wrapDateTests(() => {
  describe('iCalendarRecurrenceForRRuleLines()', () => {
    it('should strip the RRULE: prefix and keep only the value part.', () => {
      const recurrence = iCalendarRecurrenceForRRuleLines('RRULE:FREQ=WEEKLY;BYDAY=MO');

      expect(recurrence.rules).toEqual(['FREQ=WEEKLY;BYDAY=MO']);
      expect(recurrence.exceptionDates).toBeUndefined();
      expect(recurrence.additionalDates).toBeUndefined();
    });

    it('should pass a bare value part through untouched.', () => {
      expect(iCalendarRecurrenceForRRuleLines('FREQ=DAILY;COUNT=3').rules).toEqual(['FREQ=DAILY;COUNT=3']);
    });

    it('should route EXDATE lines to exceptionDates rather than rules.', () => {
      const recurrence = iCalendarRecurrenceForRRuleLines('RRULE:FREQ=DAILY\nEXDATE:20260316T140000Z');

      expect(recurrence.rules).toEqual(['FREQ=DAILY']);
      expect(recurrence.exceptionDates?.length).toBe(1);
      expect((recurrence.exceptionDates![0] as ICalendarUtcDateTime).at.toISOString()).toBe('2026-03-16T14:00:00.000Z');
    });

    it('should route RDATE lines to additionalDates rather than rules.', () => {
      const recurrence = iCalendarRecurrenceForRRuleLines('RRULE:FREQ=DAILY\nRDATE:20260317T140000Z');

      expect(recurrence.rules).toEqual(['FREQ=DAILY']);
      expect(recurrence.additionalDates?.length).toBe(1);
      expect((recurrence.additionalDates![0] as ICalendarUtcDateTime).at.toISOString()).toBe('2026-03-17T14:00:00.000Z');
    });

    it('should emit exception dates in ascending order regardless of input order.', () => {
      const recurrence = iCalendarRecurrenceForRRuleLines('RRULE:FREQ=DAILY\nEXDATE:20260318T140000Z\nEXDATE:20260316T140000Z');
      const values = recurrence.exceptionDates?.map((x) => (x as ICalendarUtcDateTime).at.toISOString());

      expect(values).toEqual(['2026-03-16T14:00:00.000Z', '2026-03-18T14:00:00.000Z']);
    });

    it('should keep multiple RRULE lines in their input order.', () => {
      expect(iCalendarRecurrenceForRRuleLines('RRULE:FREQ=WEEKLY;BYDAY=MO\nRRULE:FREQ=WEEKLY;BYDAY=WE').rules).toEqual(['FREQ=WEEKLY;BYDAY=MO', 'FREQ=WEEKLY;BYDAY=WE']);
    });

    it('should drop a DTSTART line, since the event carries its own start.', () => {
      const recurrence = iCalendarRecurrenceForRRuleLines('DTSTART:20260315T140000Z\nRRULE:FREQ=DAILY');

      expect(recurrence.rules).toEqual(['FREQ=DAILY']);
    });

    it('should ignore blank lines.', () => {
      expect(iCalendarRecurrenceForRRuleLines('RRULE:FREQ=DAILY\n\n').rules).toEqual(['FREQ=DAILY']);
    });

    it('should be stable across repeated conversions of the same input.', () => {
      const input = 'RRULE:FREQ=DAILY\nEXDATE:20260318T140000Z\nEXDATE:20260316T140000Z';
      expect(JSON.stringify(iCalendarRecurrenceForRRuleLines(input))).toBe(JSON.stringify(iCalendarRecurrenceForRRuleLines(input)));
    });
  });
});
