import { ModelRecurrenceInfo, ModelRecurrenceInfoUtility } from './date.recurrence';
import { type CalendarDate } from '../date';

describe('ModelRecurrenceInfo', () => {
  it('should create an instance from a template', () => {
    const template = {
      timezone: 'America/Chicago',
      rrule: 'RRULE:FREQ=WEEKLY;COUNT=3',
      start: new Date('2026-01-01'),
      end: new Date('2026-01-15'),
      forever: false
    } as ModelRecurrenceInfo;

    const info = new ModelRecurrenceInfo(template);

    expect(info.timezone).toBe('America/Chicago');
    expect(info.rrule).toBe('RRULE:FREQ=WEEKLY;COUNT=3');
    expect(info.start).toEqual(new Date('2026-01-01'));
    expect(info.end).toEqual(new Date('2026-01-15'));
    expect(info.forever).toBe(false);
  });

  it('should create an empty instance without a template', () => {
    const info = new ModelRecurrenceInfo();
    expect(info.timezone).toBeUndefined();
    expect(info.rrule).toBeUndefined();
  });
});

describe('ModelRecurrenceInfoUtility', () => {
  describe('expandModelRecurrenceStartToModelRecurrenceInfo()', () => {
    it('should expand a recurrence start into a full ModelRecurrenceInfo', () => {
      const calendarDate: CalendarDate = {
        startsAt: new Date('2026-01-05T10:00:00Z'),
        duration: 3600000
      };

      const result = ModelRecurrenceInfoUtility.expandModelRecurrenceStartToModelRecurrenceInfo({
        rrule: ['RRULE:FREQ=WEEKLY;COUNT=4'],
        date: calendarDate,
        timezone: 'America/Chicago'
      });

      expect(result).toBeInstanceOf(ModelRecurrenceInfo);
      expect(result.timezone).toBe('America/Chicago');
      expect(result.rrule).toBeDefined();
      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
    });

    it('should set forever to true for rules without COUNT or UNTIL', () => {
      const calendarDate: CalendarDate = {
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
