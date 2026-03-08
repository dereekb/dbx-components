import { type } from 'arktype';
import { type ModelRecurrenceInfo, modelRecurrenceInfoType, ModelRecurrenceInfoUtility } from './date.recurrence';
import { type CalendarDate, CalendarDateType } from '../date';

describe('modelRecurrenceInfoType', () => {
  it('should validate a valid ModelRecurrenceInfo', () => {
    const info: ModelRecurrenceInfo = {
      timezone: 'America/Chicago',
      rrule: 'RRULE:FREQ=WEEKLY;COUNT=3',
      start: new Date('2026-01-01'),
      end: new Date('2026-01-15'),
      forever: false
    };

    const result = modelRecurrenceInfoType(info);
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should validate without optional fields', () => {
    const info = {
      rrule: 'RRULE:FREQ=WEEKLY;COUNT=3',
      start: new Date('2026-01-01'),
      end: new Date('2026-01-15')
    };

    const result = modelRecurrenceInfoType(info);
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should reject missing required fields', () => {
    const result = modelRecurrenceInfoType({ rrule: 'test' });
    expect(result).toBeInstanceOf(type.errors);
  });
});

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
