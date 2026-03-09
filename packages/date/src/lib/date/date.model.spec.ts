import { type } from 'arktype';
import { dateDurationSpanType, dateRangeType, dateRangeParamsType, dateCellType, dateCellRangeType, dateCellTimingType, calendarDateType, dateCellScheduleType, modelRecurrenceInfoType, validDateCellTimingType, validDateCellRangeType, validDateCellRangeSeriesType, knownTimezoneType } from './date.model';
import { DateRangeType } from './date.range';
import { CalendarDateType } from './date.calendar';
import { dateCellTiming, type DateCellTiming, isValidDateCellTiming } from './date.cell';
import { type DateCellRange } from './date.cell.index';
import { setMinutes, setHours, addSeconds } from 'date-fns';
import { wrapDateTests } from '../../test.spec';

// MARK: knownTimezoneType
describe('knownTimezoneType', () => {
  it('should validate the UTC timezone', () => {
    const result = knownTimezoneType('UTC');
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should validate the America/Denver timezone', () => {
    const result = knownTimezoneType('America/Denver');
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should not validate the NotATimezone timezone', () => {
    const result = knownTimezoneType('NotATimezone');
    expect(result).toBeInstanceOf(type.errors);
  });

  it('should not validate an empty string', () => {
    const result = knownTimezoneType('');
    expect(result).toBeInstanceOf(type.errors);
  });
});

// MARK: dateDurationSpanType
describe('dateDurationSpanType', () => {
  it('should validate a valid DateDurationSpan DTO', () => {
    const result = dateDurationSpanType({ startsAt: new Date().toISOString(), duration: 60 });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should parse the startsAt string into a Date', () => {
    const iso = new Date().toISOString();
    const result = dateDurationSpanType({ startsAt: iso, duration: 60 });
    expect(result).not.toBeInstanceOf(type.errors);
    expect((result as { startsAt: Date }).startsAt).toBeInstanceOf(Date);
  });

  it('should reject a negative duration', () => {
    const result = dateDurationSpanType({ startsAt: new Date().toISOString(), duration: -1 });
    expect(result).toBeInstanceOf(type.errors);
  });

  it('should reject missing startsAt', () => {
    const result = dateDurationSpanType({ duration: 60 });
    expect(result).toBeInstanceOf(type.errors);
  });

  it('should reject a non-date string for startsAt', () => {
    const result = dateDurationSpanType({ startsAt: 'not-a-date', duration: 60 });
    expect(result).toBeInstanceOf(type.errors);
  });
});

// MARK: dateRangeType
describe('dateRangeType', () => {
  it('should validate a valid DateRange DTO', () => {
    const result = dateRangeType({ start: new Date().toISOString(), end: new Date().toISOString() });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should parse start and end strings into Dates', () => {
    const result = dateRangeType({ start: '2024-01-01T00:00:00.000Z', end: '2024-01-31T00:00:00.000Z' });
    expect(result).not.toBeInstanceOf(type.errors);
    expect((result as { start: Date }).start).toBeInstanceOf(Date);
    expect((result as { end: Date }).end).toBeInstanceOf(Date);
  });

  it('should reject missing end', () => {
    const result = dateRangeType({ start: new Date().toISOString() });
    expect(result).toBeInstanceOf(type.errors);
  });

  it('should reject non-date strings', () => {
    const result = dateRangeType({ start: 'bad', end: 'bad' });
    expect(result).toBeInstanceOf(type.errors);
  });
});

// MARK: dateRangeParamsType
describe('dateRangeParamsType', () => {
  it('should validate valid DateRangeParams DTO', () => {
    const result = dateRangeParamsType({ type: DateRangeType.DAY, date: new Date().toISOString() });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should parse the date string into a Date', () => {
    const result = dateRangeParamsType({ type: DateRangeType.DAY, date: '2024-06-15T00:00:00.000Z' });
    expect(result).not.toBeInstanceOf(type.errors);
    expect((result as { date: Date }).date).toBeInstanceOf(Date);
  });

  it('should accept optional distance', () => {
    const result = dateRangeParamsType({ type: DateRangeType.DAYS_RANGE, date: new Date().toISOString(), distance: 5 });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should reject invalid type', () => {
    const result = dateRangeParamsType({ type: 'invalid_type', date: new Date().toISOString() });
    expect(result).toBeInstanceOf(type.errors);
  });
});

// MARK: dateCellType
describe('dateCellType', () => {
  it('should validate a valid DateCell', () => {
    const result = dateCellType({ i: 0 });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should reject a negative index', () => {
    const result = dateCellType({ i: -1 });
    expect(result).toBeInstanceOf(type.errors);
  });

  it('should reject a non-integer index', () => {
    const result = dateCellType({ i: 0.5 });
    expect(result).toBeInstanceOf(type.errors);
  });
});

// MARK: dateCellRangeType
describe('dateCellRangeType', () => {
  it('should validate a valid DateCellRange', () => {
    const result = dateCellRangeType({ i: 0, to: 5 });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should validate a DateCellRange without to', () => {
    const result = dateCellRangeType({ i: 0 });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should reject a negative index', () => {
    const result = dateCellRangeType({ i: -1 });
    expect(result).toBeInstanceOf(type.errors);
  });
});

// MARK: dateCellTimingType
wrapDateTests(() => {
  describe('dateCellTimingType', () => {
    it('should validate a valid DateCellTiming DTO', () => {
      const result = dateCellTimingType({
        startsAt: '2024-01-01T12:00:00.000Z',
        duration: 60,
        end: '2024-01-10T13:00:00.000Z',
        timezone: 'America/Denver'
      });
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it('should parse date strings into Date objects', () => {
      const result = dateCellTimingType({
        startsAt: '2024-01-01T12:00:00.000Z',
        duration: 60,
        end: '2024-01-10T13:00:00.000Z',
        timezone: 'America/Denver'
      });
      expect(result).not.toBeInstanceOf(type.errors);

      const parsed = result as { startsAt: Date; end: Date };
      expect(parsed.startsAt).toBeInstanceOf(Date);
      expect(parsed.end).toBeInstanceOf(Date);
    });

    it('should reject a non-date string for startsAt', () => {
      const result = dateCellTimingType({ startsAt: 'not-a-date', duration: 60, end: '2024-01-10T13:00:00.000Z', timezone: 'UTC' });
      expect(result).toBeInstanceOf(type.errors);
    });

    it('should reject an invalid timezone', () => {
      const result = dateCellTimingType({ startsAt: '2024-01-01T12:00:00.000Z', duration: 60, end: '2024-01-10T13:00:00.000Z', timezone: 'Not/ATimezone' });
      expect(result).toBeInstanceOf(type.errors);
    });
  });
});

// MARK: calendarDateType
describe('calendarDateType', () => {
  it('should validate a valid CalendarDate DTO', () => {
    const result = calendarDateType({
      startsAt: '2024-01-15T00:00:00.000Z',
      duration: 1440,
      type: CalendarDateType.DAYS
    });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should parse the startsAt string into a Date', () => {
    const result = calendarDateType({
      startsAt: '2024-01-15T00:00:00.000Z',
      duration: 60,
      type: CalendarDateType.TIME
    });
    expect(result).not.toBeInstanceOf(type.errors);
    expect((result as { startsAt: Date }).startsAt).toBeInstanceOf(Date);
  });

  it('should reject an invalid type', () => {
    const result = calendarDateType({
      startsAt: '2024-01-15T00:00:00.000Z',
      duration: 60,
      type: 'invalid'
    });
    expect(result).toBeInstanceOf(type.errors);
  });
});

// MARK: dateCellScheduleType
describe('dateCellScheduleType', () => {
  it('should validate a valid DateCellSchedule', () => {
    const result = dateCellScheduleType({ w: '1234567' });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should validate a schedule with optional d and ex arrays', () => {
    const result = dateCellScheduleType({ w: '1234567', d: [0, 1, 2], ex: [3, 4] });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should reject an invalid week string', () => {
    const result = dateCellScheduleType({ w: 'not-valid-week' });
    expect(result).toBeInstanceOf(type.errors);
  });
});

// MARK: modelRecurrenceInfoType
describe('modelRecurrenceInfoType', () => {
  it('should validate a valid ModelRecurrenceInfo DTO', () => {
    const result = modelRecurrenceInfoType({
      timezone: 'America/Chicago',
      rrule: 'RRULE:FREQ=WEEKLY;COUNT=3',
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-15T00:00:00.000Z',
      forever: false
    });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should parse start and end strings into Dates', () => {
    const result = modelRecurrenceInfoType({
      rrule: 'RRULE:FREQ=WEEKLY;COUNT=3',
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-15T00:00:00.000Z'
    });
    expect(result).not.toBeInstanceOf(type.errors);

    const parsed = result as { start: Date; end: Date };
    expect(parsed.start).toBeInstanceOf(Date);
    expect(parsed.end).toBeInstanceOf(Date);
  });

  it('should validate without optional fields', () => {
    const result = modelRecurrenceInfoType({
      rrule: 'RRULE:FREQ=WEEKLY;COUNT=3',
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-15T00:00:00.000Z'
    });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should reject missing required fields', () => {
    const result = modelRecurrenceInfoType({ rrule: 'test' });
    expect(result).toBeInstanceOf(type.errors);
  });
});

// MARK: validDateCellTimingType
wrapDateTests(() => {
  describe('validDateCellTimingType', () => {
    const startsAt = setMinutes(setHours(new Date(), 12), 0);
    const validTiming = dateCellTiming({ startsAt, duration: 60 }, 1);

    it('should pass valid timings.', () => {
      const dto = {
        startsAt: validTiming.startsAt.toISOString(),
        duration: validTiming.duration,
        end: validTiming.end.toISOString(),
        timezone: validTiming.timezone
      };

      const result = validDateCellTimingType(dto);
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it('should fail on invalid timings', () => {
      const invalidTiming: DateCellTiming = { ...validTiming, startsAt: addSeconds(validTiming.startsAt, 10) };
      const dto = {
        startsAt: invalidTiming.startsAt.toISOString(),
        duration: invalidTiming.duration,
        end: invalidTiming.end.toISOString(),
        timezone: invalidTiming.timezone
      };

      const result = validDateCellTimingType(dto);
      expect(result).toBeInstanceOf(type.errors);
    });

    describe('scenario', () => {
      const timezone = 'America/Chicago';

      it('should validate a valid timing object', () => {
        const timing: DateCellTiming = {
          timezone,
          end: new Date('2023-12-21T22:30:00.000Z'),
          startsAt: new Date('2023-08-15T13:30:00.000Z'),
          duration: 480
        };

        const isValid = isValidDateCellTiming(timing);
        expect(isValid).toBe(true);

        const dto = {
          timezone: timing.timezone,
          end: timing.end.toISOString(),
          startsAt: timing.startsAt.toISOString(),
          duration: timing.duration
        };

        const result = validDateCellTimingType(dto);
        expect(result).not.toBeInstanceOf(type.errors);
      });
    });
  });

  describe('validDateCellTimingType used in merge', () => {
    const testType = type({
      timing: validDateCellTimingType,
      name: 'string'
    });

    it('should validate an object with a valid timing property.', () => {
      const startsAt = setMinutes(setHours(new Date(), 12), 0);
      const validTiming = dateCellTiming({ startsAt, duration: 60 }, 1);
      const dto = {
        timing: {
          startsAt: validTiming.startsAt.toISOString(),
          duration: validTiming.duration,
          end: validTiming.end.toISOString(),
          timezone: validTiming.timezone
        },
        name: 'test'
      };

      const result = testType(dto);
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it('should fail when the timing property is invalid.', () => {
      const result = testType({
        timing: {
          startsAt: new Date().toISOString(),
          duration: -1,
          end: new Date().toISOString(),
          timezone: 'America/Chicago'
        },
        name: 'test'
      });
      expect(result).toBeInstanceOf(type.errors);
    });
  });
});

// MARK: validDateCellRangeType
describe('validDateCellRangeType', () => {
  it('should pass valid ranges.', () => {
    const result = validDateCellRangeType({ i: 0 });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should fail on invalid ranges', () => {
    const invalidRange: DateCellRange = { i: -1 };
    const result = validDateCellRangeType(invalidRange);
    expect(result).toBeInstanceOf(type.errors);
  });
});

describe('validDateCellRangeType used in merge', () => {
  const testType = type({
    range: validDateCellRangeType,
    name: 'string'
  });

  it('should validate an object with a valid range property.', () => {
    const result = testType({ range: { i: 0, to: 5 }, name: 'test' });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should fail when the range property is invalid.', () => {
    const result = testType({ range: { i: 5, to: 0 }, name: 'test' });
    expect(result).toBeInstanceOf(type.errors);
  });
});

// MARK: validDateCellRangeSeriesType
describe('validDateCellRangeSeriesType', () => {
  it('should pass a valid range series.', () => {
    const result = validDateCellRangeSeriesType([{ i: 0 }]);
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should fail on invalid ranges', () => {
    const invalidRange: DateCellRange[] = [{ i: 0, to: 0 }, { i: 0 }];
    const result = validDateCellRangeSeriesType(invalidRange);
    expect(result).toBeInstanceOf(type.errors);
  });
});

describe('validDateCellRangeSeriesType used in merge', () => {
  const testType = type({
    ranges: validDateCellRangeSeriesType,
    name: 'string'
  });

  it('should validate an object with a valid range series property.', () => {
    const result = testType({ ranges: [{ i: 0 }, { i: 1 }], name: 'test' });
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should fail when the range series property is invalid.', () => {
    const result = testType({ ranges: [{ i: 0, to: 0 }, { i: 0 }], name: 'test' });
    expect(result).toBeInstanceOf(type.errors);
  });
});
