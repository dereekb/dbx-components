import { ModelRecurrenceInfoUtility } from './date.recurrence';
import { type CalendarDate, CalendarDateType } from '../date';

// ArkType validation tests for modelRecurrenceInfoType have been moved to date.model.spec.ts

describe('ModelRecurrenceInfoUtility', () => {
  describe('expandModelRecurrenceStartToModelRecurrenceInfo()', () => {
    it('should expand a recurrence start into a full ModelRecurrenceInfo', () => {
      const calendarDate: CalendarDate = {
        type: CalendarDateType.TIME,
        startsAt: new Date('2026-01-05T10:00:00Z'),
        duration: 3600000
      };

      const result = ModelRecurrenceInfoUtility.expandModelRecurrenceStartToModelRecurrenceInfo({
        rrule: ['RRULE:FREQ=WEEKLY;COUNT=4'],
        date: calendarDate,
        timezone: 'America/Chicago'
      });

      expect(result.timezone).toBe('America/Chicago');
      expect(result.rrule).toBeDefined();
      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
    });

    it('should set forever to true for rules without COUNT or UNTIL', () => {
      const calendarDate: CalendarDate = {
        type: CalendarDateType.TIME,
        startsAt: new Date('2026-01-05T10:00:00Z'),
        duration: 3600000
      };

      const result = ModelRecurrenceInfoUtility.expandModelRecurrenceStartToModelRecurrenceInfo({
        rrule: ['RRULE:FREQ=DAILY'],
        date: calendarDate
      });

      expect(result.forever).toBe(true);
    });
  });

  describe('makeDateRRuleInstance()', () => {
    it('should create a DateRRuleInstance from stored info', () => {
      const calendarDate: CalendarDate = {
        type: CalendarDateType.TIME,
        startsAt: new Date('2026-01-05T10:00:00Z'),
        duration: 3600000
      };

      const info = ModelRecurrenceInfoUtility.expandModelRecurrenceStartToModelRecurrenceInfo({
        rrule: ['RRULE:FREQ=WEEKLY;COUNT=4'],
        date: calendarDate,
        timezone: 'America/Chicago'
      });

      const instance = ModelRecurrenceInfoUtility.makeDateRRuleInstance(info, calendarDate);
      expect(instance).toBeDefined();
    });
  });
});
