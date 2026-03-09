import { wrapDateTests } from '../../test.spec';
import { calendarDate, calendarDateFactory, calendarDateForDateDurationSpan, CalendarDateType } from './date.calendar';
import { daysToMinutes } from './date';
import { type DateDurationSpan } from './date.duration';

wrapDateTests(() => {
  describe('calendarDateFactory()', () => {
    it('should create a factory that produces all-day calendar events', () => {
      const factory = calendarDateFactory({ timezone: false });
      const event = factory('2024-01-15', 3);
      expect(event.type).toBe(CalendarDateType.DAYS);
      expect(event.duration).toBe(daysToMinutes(3));
      expect(event.startsAt).toBeInstanceOf(Date);
    });

    it('should use system timezone by default', () => {
      const factory = calendarDateFactory();
      const event = factory('2024-01-15', 1);
      expect(event.type).toBe(CalendarDateType.DAYS);
      expect(event.startsAt).toBeInstanceOf(Date);
    });
  });

  describe('calendarDate()', () => {
    it('should create a single calendar date event', () => {
      const event = calendarDate('2024-01-15', 1, false);
      expect(event.type).toBe(CalendarDateType.DAYS);
      expect(event.duration).toBe(daysToMinutes(1));
    });
  });

  describe('calendarDateForDateDurationSpan()', () => {
    it('should wrap a DateDurationSpan as a TIME calendar date', () => {
      const span: DateDurationSpan = { startsAt: new Date(), duration: 60 };
      const event = calendarDateForDateDurationSpan(span);
      expect(event.type).toBe(CalendarDateType.TIME);
      expect(event.startsAt).toBe(span.startsAt);
      expect(event.duration).toBe(60);
    });
  });
});
