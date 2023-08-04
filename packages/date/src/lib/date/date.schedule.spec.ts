import { DateBlockIndex, dateBlockTimingInTimezone, timingIsInExpectedTimezone } from './date.block';
import { DateBlock, dateBlockTiming, systemNormalDateToBaseDate, DateScheduleRange, startOfDayInTimezoneDayStringFactory, startOfDayInTimezoneFromISO8601DayString } from '@dereekb/date';
import {
  expandDateScheduleFactory,
  DateSchedule,
  dateScheduleDateBlockTimingFilter,
  DateScheduleDayCode,
  dateScheduleDayCodeFactory,
  dateScheduleEncodedWeek,
  dateScheduleDateFilter,
  DateScheduleDateFilterConfig,
  weekdayDateScheduleDayCodes,
  rawDateScheduleDayCodes,
  expandDateScheduleDayCodes,
  DateScheduleEncodedWeek,
  weekendDateScheduleDayCodes,
  expandDateScheduleDayCodesToDayOfWeekSet,
  expandDateScheduleRange,
  expandDateScheduleRangeToDateBlockRanges,
  isSameDateSchedule,
  dateScheduleDayCodesAreSetsEquivalent,
  dateBlockTimingForExpandDateScheduleRangeInput
} from './date.schedule';
import { addDays, addHours, addMinutes, differenceInDays } from 'date-fns';
import { Day, range, UTC_TIMEZONE_STRING } from '@dereekb/util';

describe('dateScheduleDateFilter()', () => {
  const start = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday

  describe('function', () => {
    describe('included', () => {
      const dayIndexes = [0, 1, 2, 3];
      const schedule: DateScheduleDateFilterConfig = { start, w: '0', d: dayIndexes };
      const firstFourDays = dateScheduleDateFilter(schedule);

      it('should allow the included days (indexes)', () => {
        const maxIndex = 5;
        const dateBlocks: DateBlockIndex[] = range(0, maxIndex);
        const results = dateBlocks.filter(firstFourDays);

        expect(results.length).toBe(dayIndexes.length);
      });
    });

    describe('schedule', () => {
      describe('weekdays and weekends', () => {
        const schedule: DateScheduleDateFilterConfig = { start, w: '89' };
        const weekDaysAndWeekends = dateScheduleDateFilter(schedule);

        it('should allow every day of the week (indexes)', () => {
          const maxIndex = 14;
          const dateBlocks: DateBlockIndex[] = range(0, maxIndex);
          const results = dateBlocks.filter(weekDaysAndWeekends);

          expect(results.length).toBe(maxIndex);
        });

        it('should allow every day of the week (dates)', () => {
          const maxIndex = 14;
          const dateBlocks: Date[] = range(0, maxIndex).map((y) => addDays(start, y));
          const results = dateBlocks.filter(weekDaysAndWeekends);

          expect(results.length).toBe(maxIndex);
        });

        describe('with exclusion', () => {
          const ex = [0, 1, 2];
          const scheduleWithExclusion: DateScheduleDateFilterConfig = { start, ex, w: '89' };
          const weekDaysAndWeekendsWithExclusion = dateScheduleDateFilter(scheduleWithExclusion);

          it('should exclude the configured indexes.', () => {
            const maxIndex = 14;
            const dateBlocks: DateBlockIndex[] = range(0, maxIndex);
            const results = dateBlocks.filter(weekDaysAndWeekendsWithExclusion);

            expect(results.length).toBe(maxIndex - ex.length);
          });
        });
      });

      describe('weekdays', () => {
        const schedule: DateScheduleDateFilterConfig = { start, w: `${DateScheduleDayCode.WEEKDAY}` };
        const weekDays = dateScheduleDateFilter(schedule);

        it('should allow every weekday (indexes)', () => {
          const maxIndex = 14;
          const dateBlocks: DateBlockIndex[] = range(0, maxIndex);
          const results = dateBlocks.filter(weekDays);

          expect(results.length).toBe(maxIndex - 4);
        });

        it('should allow every weekday (dates)', () => {
          const maxIndex = 14;
          const dateBlocks: Date[] = range(0, maxIndex).map((y) => addDays(start, y));
          const results = dateBlocks.filter(weekDays);

          expect(results.length).toBe(maxIndex - 4);
        });
      });

      describe('weekends', () => {
        const schedule: DateScheduleDateFilterConfig = { start, w: `${DateScheduleDayCode.WEEKEND}` };
        const weekends = dateScheduleDateFilter(schedule);

        it('should allow every weekend (indexes)', () => {
          const maxIndex = 14;
          const dateBlocks: DateBlockIndex[] = range(0, maxIndex);
          const results = dateBlocks.filter(weekends);
          expect(results.length).toBe(maxIndex - 10);
        });

        it('should allow every weekend (dates)', () => {
          const maxIndex = 14;
          const dateBlocks: Date[] = range(0, maxIndex).map((y) => addDays(start, y));
          const results = dateBlocks.filter(weekends);
          expect(results.length).toBe(maxIndex - 10);
        });
      });

      describe('days', () => {
        const schedule: DateScheduleDateFilterConfig = { start, w: `23` };
        const mondayAndTuesdays = dateScheduleDateFilter(schedule);

        it('should only allow the specified days of the week (indexes)', () => {
          const maxIndex = 14;
          const dateBlocks: DateBlockIndex[] = range(0, maxIndex);
          const results = dateBlocks.filter(mondayAndTuesdays);

          expect(results.length).toBe(4);

          // week 1
          expect(results[0]).toBe(1);
          expect(results[1]).toBe(2);

          // week 2
          expect(results[2]).toBe(8);
          expect(results[3]).toBe(9);
        });

        it('should only allow the specified days of the week (dates)', () => {
          const maxIndex = 14;
          const dateBlocks: Date[] = range(0, maxIndex).map((y) => addDays(start, y));
          const results = dateBlocks.filter(mondayAndTuesdays);

          expect(results.length).toBe(4);

          // week 1
          expect(results[0]).toBeSameSecondAs(addDays(start, 1));
          expect(results[1]).toBeSameSecondAs(addDays(start, 2));

          // week 2
          expect(results[2]).toBeSameSecondAs(addDays(start, 8));
          expect(results[3]).toBeSameSecondAs(addDays(start, 9));
        });
      });

      describe('scenario', () => {
        it('should filter April 26th, 2023 as included within the filter for that date.', () => {
          const w = '8';
          const d: number[] = [];
          const ex: number[] = [];

          const start = new Date('Wed, 26 Apr 2023 05:00:00 GMT');
          const end = new Date('Wed, 26 Apr 2023 22:00:00 GMT');

          const filter = dateScheduleDateFilter({
            w,
            d,
            ex,
            start,
            end
          });

          const indexZero = 0;

          const result = filter(indexZero);
          expect(result).toBe(true);
        });
      });

      // TODO: Test min/max date range
    });
  });
});

describe('dateScheduleDateBlockTimingFilter()', () => {
  const startsAt = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday
  const weekTiming = dateBlockTiming({ startsAt, duration: 60 }, 7); // Sunday-Saturday

  describe('function', () => {
    describe('schedule', () => {
      describe('weekdays and weekends', () => {
        const schedule: DateSchedule = { w: '89' };
        const weekDaysAndWeekends = dateScheduleDateBlockTimingFilter({ timing: weekTiming, schedule });

        it('should allow every day of the week', () => {
          const maxIndex = 14;
          const dateBlocks: DateBlock[] = range(0, maxIndex).map((i) => ({ i }));
          const results = dateBlocks.filter(weekDaysAndWeekends);

          expect(results.length).toBe(maxIndex);
        });
      });

      describe('weekdays', () => {
        const schedule: DateSchedule = { w: `${DateScheduleDayCode.WEEKDAY}` };
        const weekDays = dateScheduleDateBlockTimingFilter({ timing: weekTiming, schedule });

        it('should allow every weekday', () => {
          const maxIndex = 14;
          const dateBlocks: DateBlock[] = range(0, maxIndex).map((i) => ({ i }));
          const results = dateBlocks.filter(weekDays);

          expect(results.length).toBe(maxIndex - 4);
        });
      });

      describe('weekends', () => {
        const schedule: DateSchedule = { w: `${DateScheduleDayCode.WEEKEND}` };
        const weekends = dateScheduleDateBlockTimingFilter({ timing: weekTiming, schedule });

        it('should allow every weekend', () => {
          const maxIndex = 14;
          const dateBlocks: DateBlock[] = range(0, maxIndex).map((i) => ({ i }));
          const results = dateBlocks.filter(weekends);
          expect(results.length).toBe(maxIndex - 10);
        });
      });

      describe('days', () => {
        const schedule: DateSchedule = { w: `23` };
        const mondayAndTuesdays = dateScheduleDateBlockTimingFilter({ timing: weekTiming, schedule });

        it('should only allow the specified days of the week', () => {
          const maxIndex = 14;
          const dateBlocks: DateBlock[] = range(0, maxIndex).map((i) => ({ i }));
          const results = dateBlocks.filter(mondayAndTuesdays);

          expect(results.length).toBe(4);

          // week 1
          expect(results[0].i).toBe(1);
          expect(results[1].i).toBe(2);

          // week 2
          expect(results[2].i).toBe(8);
          expect(results[3].i).toBe(9);
        });
      });
    });
  });
});

describe('expandDateScheduleFactory()', () => {
  const startsAt = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday - Offset to reverse
  const weekTiming = dateBlockTiming({ startsAt, duration: 60 }, 7); // Sunday-Saturday

  describe('function', () => {
    describe('schedule', () => {
      describe('weekdays and weekends', () => {
        const schedule: DateSchedule = { w: '89' };
        const weekDaysAndWeekends = expandDateScheduleFactory({ timing: weekTiming, schedule });

        it('should allow every day of the week', () => {
          const dateBlockForRange = {
            i: 0,
            to: 6
          };

          const results = weekDaysAndWeekends([dateBlockForRange]);
          expect(results.length).toBe(dateBlockForRange.to + 1);

          expect(results[0].startsAt).toBeSameSecondAs(startsAt);
          expect(results[0].duration).toBe(weekTiming.duration);
          expect(results[0].i).toBe(0);

          expect(results[1].startsAt).toBeSameSecondAs(addDays(startsAt, 1));
        });

        describe('with exclusion in schedule', () => {
          const ex = [0, 1, 2];
          const scheduleWithExclusion: DateSchedule = { ...schedule, ex }; // Sunday/Monday/Tuesday out
          const weekDaysAndWeekendsWithExclusion = expandDateScheduleFactory({ timing: weekTiming, schedule: scheduleWithExclusion });

          it('should exclude the specified days in the schedule', () => {
            const dateBlockForRange = {
              i: 0,
              to: 6
            };

            const results = weekDaysAndWeekendsWithExclusion([dateBlockForRange]);
            expect(results.length).toBe(dateBlockForRange.to + 1 - ex.length);

            expect(results[0].i).toBe(3);
            expect(results[0].duration).toBe(weekTiming.duration);
            expect(results[0].startsAt).toBeSameSecondAs(addDays(startsAt, ex.length));
          });
        });
      });

      describe('weekdays', () => {
        const schedule: DateSchedule = { w: `${DateScheduleDayCode.WEEKDAY}` };
        const weekDays = expandDateScheduleFactory({ now: startsAt, timing: weekTiming, schedule });

        it('should allow every weekday', () => {
          const dateBlockForRange = {
            i: 0,
            to: 6
          };

          const results = weekDays([dateBlockForRange]);
          expect(results.length).toBe(5);
        });
      });

      describe('weekends', () => {
        const schedule: DateSchedule = { w: `${DateScheduleDayCode.WEEKEND}` };
        const weekends = expandDateScheduleFactory({ now: startsAt, timing: weekTiming, schedule });

        it('should allow every weekend day', () => {
          const dateBlockForRange = {
            i: 0,
            to: 6
          };

          const results = weekends([dateBlockForRange]);
          expect(results.length).toBe(2);
        });

        describe('onlyBlocksNotYetStarted=true', () => {
          const weekends = expandDateScheduleFactory({ now: startsAt, timing: weekTiming, schedule, onlyBlocksNotYetStarted: true });

          it('should return every future weekend day', () => {
            const dateBlockForRange = {
              i: 0,
              to: 6
            };

            const results = weekends([dateBlockForRange]);

            expect(results.length).toBe(1);
            expect(results[0].i).toBe(6);
          });
        });
      });

      describe('days', () => {
        const schedule: DateSchedule = { w: `12` };
        const mondayAndTuesdays = expandDateScheduleFactory({ now: startsAt, timing: weekTiming, schedule });

        it('should only allow the specified days of the week', () => {
          const dateBlockForRange = {
            i: 0,
            to: 6
          };

          const results = mondayAndTuesdays([dateBlockForRange]);
          expect(results.length).toBe(2);
        });
      });
    });
  });
});

describe('expandDateScheduleDayCodesToDayOfWeekSet()', () => {
  it('should convert the input to DayOfWeek values', () => {
    const code = DateScheduleDayCode.SUNDAY;
    const result = expandDateScheduleDayCodesToDayOfWeekSet(code);

    expect(result).toContain(Day.SUNDAY);
  });

  it('should expand the weekend token into the individual weekend days', () => {
    const code = DateScheduleDayCode.WEEKEND;
    const result = expandDateScheduleDayCodesToDayOfWeekSet(code);

    expect(result).toContain(Day.SUNDAY);
    expect(result).toContain(Day.SATURDAY);
  });
});

describe('expandDateScheduleDayCodes()', () => {
  describe('days', () => {
    it('should filter none from the results.', () => {
      const code = DateScheduleDayCode.NONE;
      const result = expandDateScheduleDayCodes(code);
      expect(result.length).toBe(0);
    });

    it('should return an array from a single day code', () => {
      const code = DateScheduleDayCode.SUNDAY;
      const result = expandDateScheduleDayCodes(code);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(code);
    });

    it('should expand the weekday token into the individual weekdays.', () => {
      const code = DateScheduleDayCode.WEEKDAY;
      const result = expandDateScheduleDayCodes(code);

      const expectedDays = weekdayDateScheduleDayCodes();
      expect(result.length).toBe(expectedDays.length);

      expectedDays.forEach((day) => {
        expect(result).toContain(day);
      });
    });

    it('should expand the weekend token into the individual weekends.', () => {
      const code = DateScheduleDayCode.WEEKEND;
      const result = expandDateScheduleDayCodes(code);

      const expectedDays = weekendDateScheduleDayCodes();
      expect(result.length).toBe(expectedDays.length);

      expectedDays.forEach((day) => {
        expect(result).toContain(day);
      });
    });
  });

  describe('days array', () => {
    it('should filter none from the results.', () => {
      const code = DateScheduleDayCode.NONE;
      const result = expandDateScheduleDayCodes([code]);
      expect(result.length).toBe(0);
    });

    it('should return an array containing the day', () => {
      const code = DateScheduleDayCode.SUNDAY;
      const result = expandDateScheduleDayCodes([code]);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(code);
    });
  });

  describe('days set', () => {
    it('should filter none from the results.', () => {
      const code = DateScheduleDayCode.NONE;
      const result = expandDateScheduleDayCodes(new Set([code]));
      expect(result.length).toBe(0);
    });

    it('should return an array containing the day', () => {
      const code = DateScheduleDayCode.SUNDAY;
      const result = expandDateScheduleDayCodes(new Set([code]));

      expect(result.length).toBe(1);
      expect(result[0]).toBe(code);
    });
  });
});

describe('rawDateScheduleDayCodes()', () => {
  describe('days', () => {
    it('should filter none from the results.', () => {
      const code = DateScheduleDayCode.NONE;
      const result = rawDateScheduleDayCodes(code);
      expect(result.length).toBe(0);
    });

    it('should return an array from a single day code', () => {
      const code = DateScheduleDayCode.SUNDAY;
      const result = rawDateScheduleDayCodes(code);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(code);
    });
  });

  describe('days string', () => {
    it('should filter none from the results.', () => {
      const code = DateScheduleDayCode.NONE;
      const result = rawDateScheduleDayCodes(code.toString() as DateScheduleEncodedWeek);
      expect(result.length).toBe(0);
    });

    it('should return an array from a single day code string', () => {
      const code = DateScheduleDayCode.SUNDAY;
      const result = rawDateScheduleDayCodes(code.toString() as DateScheduleEncodedWeek);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(code);
    });

    it('should return the weekend token', () => {
      const code = DateScheduleDayCode.WEEKEND;
      const result = rawDateScheduleDayCodes(code.toString() as DateScheduleEncodedWeek);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(code);
    });
  });
});

describe('dateScheduleEncodedWeek()', () => {
  it('should return an empty string if only NONE is provided.', () => {
    const codes = [DateScheduleDayCode.NONE];
    const result = dateScheduleEncodedWeek(codes);
    expect(result).toBe('');
  });

  it('should return an empty string if an empty array is provided.', () => {
    const codes: DateScheduleDayCode[] = [];
    const result = dateScheduleEncodedWeek(codes);
    expect(result).toBe('');
  });

  it('should return the weekdays that are is provided.', () => {
    const codes = range(DateScheduleDayCode.MONDAY, DateScheduleDayCode.THURSDAY + 1);
    const result = dateScheduleEncodedWeek(codes);
    expect(result).toBe('2345');
  });

  it('should return sunday only.', () => {
    const codes = [DateScheduleDayCode.SUNDAY];
    const result = dateScheduleEncodedWeek(codes);
    expect(result).toBe('1');
  });

  it('should return saturday only.', () => {
    const codes = [DateScheduleDayCode.SATURDAY];
    const result = dateScheduleEncodedWeek(codes);
    expect(result).toBe('7');
  });

  it('should return the weekday and weekend code if the entire week is provided.', () => {
    const codes = range(DateScheduleDayCode.NONE, DateScheduleDayCode.SATURDAY + 1);
    const result = dateScheduleEncodedWeek(codes);
    expect(result).toBe('89');
  });

  it('should return the weekday code if all weekdays are provided.', () => {
    const codes = range(DateScheduleDayCode.MONDAY, DateScheduleDayCode.SATURDAY);
    const result = dateScheduleEncodedWeek(codes);
    expect(result).toBe('8');
  });

  it('should return the weekend code if all weekenddays are provided.', () => {
    const codes = [DateScheduleDayCode.SATURDAY, DateScheduleDayCode.SUNDAY];
    const result = dateScheduleEncodedWeek(codes);
    expect(result).toBe('9');
  });
});

describe('dateScheduleDayCodeFactory()', () => {
  describe('function', () => {
    const utc2022Week2StartDate = new Date('2022-01-02T00:00:00Z');
    const utc2022Week2MondayDate = new Date('2022-01-03T00:00:00Z');

    describe('with timezone', () => {
      describe('UTC', () => {
        const factory = dateScheduleDayCodeFactory({ timezone: UTC_TIMEZONE_STRING });

        it('should return Sunday.', () => {
          const result = factory(utc2022Week2StartDate);
          expect(result).toBe(DateScheduleDayCode.SUNDAY);
        });

        it('should return Monday.', () => {
          const result = factory(utc2022Week2MondayDate);
          expect(result).toBe(DateScheduleDayCode.MONDAY);
        });
      });

      describe('America/Denver', () => {
        const factory = dateScheduleDayCodeFactory({ timezone: 'America/Denver' });

        it('should return Saturday.', () => {
          const result = factory(utc2022Week2StartDate);
          expect(result).toBe(DateScheduleDayCode.SATURDAY);
        });

        it('should return Sunday.', () => {
          const result = factory(utc2022Week2MondayDate);
          expect(result).toBe(DateScheduleDayCode.SUNDAY);
        });
      });

      describe('Europe/Amsterdam', () => {
        const factory = dateScheduleDayCodeFactory({ timezone: 'Europe/Amsterdam' });

        it('should return Sunday.', () => {
          const result = factory(utc2022Week2StartDate);
          expect(result).toBe(DateScheduleDayCode.SUNDAY);
        });

        it('should return Monday.', () => {
          const result = factory(utc2022Week2MondayDate);
          expect(result).toBe(DateScheduleDayCode.MONDAY);
        });
      });
    });
  });
});

describe('dateScheduleDayCodesAreSetsEquivalent()', () => {
  it('should be true when the sets are set equivalent', () => {
    const result = dateScheduleDayCodesAreSetsEquivalent(weekendDateScheduleDayCodes(), [DateScheduleDayCode.WEEKEND]);
    expect(result).toBe(true);
  });

  it('should be false when the sets are not set equivalent', () => {
    const result = dateScheduleDayCodesAreSetsEquivalent(weekendDateScheduleDayCodes(), [DateScheduleDayCode.WEEKDAY]);
    expect(result).toBe(false);
  });
});

describe('isSameDateSchedule()', () => {
  it('should return true for the same date schedule.', () => {
    const schedule: DateSchedule = { w: '89', ex: [0, 1], d: [2] };
    expect(isSameDateSchedule(schedule, schedule)).toBe(true);
  });

  it('should return false for a date schedule with different ex days.', () => {
    const schedule: DateSchedule = { w: '89', ex: [0, 1], d: [2] };
    const scheduleB: DateSchedule = { ...schedule, ex: [] };
    expect(isSameDateSchedule(schedule, scheduleB)).toBe(false);
  });

  it('should return false for a date schedule with different d days.', () => {
    const schedule: DateSchedule = { w: '89', ex: [0, 1], d: [2] };
    const scheduleB: DateSchedule = { ...schedule, d: [] };
    expect(isSameDateSchedule(schedule, scheduleB)).toBe(false);
  });
});

describe('dateBlockTimingForExpandDateScheduleRangeInput()', () => {
  const schedule: DateSchedule = { w: '89', ex: [0, 1], d: [2] };

  describe('timing with timezone', () => {
    describe('UTC', () => {
      const days = 7;
      const duration = 60;
      const utc2022Week2StartDate = new Date('2022-01-02T00:00:00Z'); // sunday
      const timing = dateBlockTimingInTimezone({ startsAt: utc2022Week2StartDate, duration }, days, 'UTC');

      it('it should generate the expected dateBlockTiming.', () => {
        const result = dateBlockTimingForExpandDateScheduleRangeInput({
          dateScheduleRange: {
            ...schedule,
            ...timing
          },
          startsAtTime: timing.startsAt,
          duration
        });

        expect(result.start).toBeSameSecondAs(timing.start);
        expect(result.end).toBeSameSecondAs(timing.end);

        const daysCount = differenceInDays(result.end, result.start);
        expect(daysCount).toBe(days);
      });
    });

    describe('America/New_York', () => {
      const timezone = 'America/New_York';
      const startOfDay = startOfDayInTimezoneFromISO8601DayString('2022-01-02', timezone);
      const startsAt = addHours(startOfDay, 12); // Noon on 2022-01-02 in America/New_York
      const timing = dateBlockTimingInTimezone({ startsAt, duration: 30 }, 1, timezone);

      it('should generate a valid DateBlockTiming() with the new duration.', () => {
        expect(timingIsInExpectedTimezone(timing, { timezone })).toBe(true);

        const newDuration = 60;

        const result = dateBlockTimingForExpandDateScheduleRangeInput({
          dateScheduleRange: {
            ...schedule,
            ...timing
          },
          startsAtTime: timing.startsAt,
          duration: newDuration
        });

        expect(result.start).toBeSameSecondAs(timing.start);
        expect(result.duration).toBe(newDuration);
        expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

        const durationDifference = newDuration - timing.duration;
        expect(result.end).toBeSameSecondAs(addMinutes(timing.end, durationDifference)); // 30 minutes later
      });

      it('should generate a valid DateBlockTiming() with the same event startsAt time.', () => {
        const newStartsAt = addDays(timing.startsAt, 1); // same event schedule

        const result = dateBlockTimingForExpandDateScheduleRangeInput({
          dateScheduleRange: {
            ...schedule,
            ...timing
          },
          duration: timing.duration,
          startsAtTime: newStartsAt
        });

        expect(result.duration).toBe(timing.duration);
        expect(result.start).toBeSameSecondAs(timing.start);
        expect(result.startsAt).toBeSameSecondAs(timing.startsAt);
        expect(result.end).toBeSameSecondAs(timing.end);
      });

      it('should generate a valid DateBlockTiming() with the new duration and start at time.', () => {
        const newDuration = 45;
        const hoursDifference = 1;
        const expectedStartsAt = addHours(timing.startsAt, hoursDifference);
        const newStartsAt = addDays(expectedStartsAt, 1); // starts 1 hour earlier, and event is 1 day later

        const result = dateBlockTimingForExpandDateScheduleRangeInput({
          dateScheduleRange: {
            ...schedule,
            ...timing
          },
          duration: newDuration,
          startsAtTime: newStartsAt
        });

        expect(result.start).toBeSameSecondAs(timing.start);
        expect(result.duration).toBe(newDuration);
        expect(result.startsAt).toBeSameSecondAs(expectedStartsAt);

        const durationDifference = newDuration - timing.duration;
        expect(result.end).toBeSameSecondAs(addMinutes(timing.end, durationDifference + hoursDifference * 60)); // hour and 15 minutes later
      });
    });
  });
});

describe('expandDateScheduleRange()', () => {
  const duration = 60;

  const days = 7;
  const utc2022Week2StartDate = new Date('2022-01-02T00:00:00Z'); // sunday
  const timing = dateBlockTimingInTimezone({ startsAt: utc2022Week2StartDate, duration }, days, 'UTC');
  const end = timing.end;

  it('should expand the dateScheduleRange week.', () => {
    const dateScheduleRange: DateScheduleRange = {
      w: '89',
      start: utc2022Week2StartDate,
      end
    };

    const expansion = expandDateScheduleRange({ dateScheduleRange, duration });
    expect(expansion.length).toBe(7);

    expect(expansion[0].startsAt).toBeSameSecondAs(dateScheduleRange.start);
  });

  it('should expand a week with excluded days.', () => {
    const dateScheduleRange: DateScheduleRange = {
      w: '89',
      start: utc2022Week2StartDate,
      end,
      ex: [0, 2, 4, 6]
    };

    const expansion = expandDateScheduleRange({ dateScheduleRange, duration });
    expect(expansion.length).toBe(3);

    expect(expansion[0].startsAt).toBeSameSecondAs(addDays(dateScheduleRange.start, 1));

    const indexes = expansion.map((x) => x.i);
    expect(indexes).toContain(1);
    expect(indexes).toContain(3);
    expect(indexes).toContain(5);
  });

  it('should expand a week with included days.', () => {
    const dateScheduleRange: DateScheduleRange = {
      w: '8',
      start: utc2022Week2StartDate,
      end,
      d: [0]
    };

    const expansion = expandDateScheduleRange({ dateScheduleRange, duration });
    expect(expansion.length).toBe(6);

    expect(expansion[0].startsAt).toBeSameSecondAs(dateScheduleRange.start);
  });

  it('should expand a week with only weekdays.', () => {
    const dateScheduleRange: DateScheduleRange = {
      w: '8',
      start: utc2022Week2StartDate,
      end
    };

    const expansion = expandDateScheduleRange({ dateScheduleRange, duration });
    expect(expansion.length).toBe(5);

    expect(expansion[0].startsAt).toBeSameSecondAs(addDays(dateScheduleRange.start, 1));
  });

  it('should expand a week with only weekends.', () => {
    const dateScheduleRange: DateScheduleRange = {
      w: '9',
      start: utc2022Week2StartDate,
      end
    };

    const expansion = expandDateScheduleRange({ dateScheduleRange, duration });
    expect(expansion.length).toBe(2);

    expect(expansion[0].startsAt).toBeSameSecondAs(dateScheduleRange.start);
  });
});

describe('expandDateScheduleRangeToDateBlockRanges()', () => {
  const duration = 60;
  const days = 7;
  const utc2022Week2StartDate = new Date('2022-01-02T00:00:00Z'); // sunday
  const timing = dateBlockTimingInTimezone({ startsAt: utc2022Week2StartDate, duration }, days, 'UTC');
  const end = timing.end;

  it('should expand a week.', () => {
    const dateScheduleRange: DateScheduleRange = {
      w: '89',
      start: utc2022Week2StartDate,
      end
    };

    const expansion = expandDateScheduleRangeToDateBlockRanges({ dateScheduleRange, duration });
    expect(expansion.length).toBe(1);

    expect(expansion[0].i).toBe(0);
    expect(expansion[0].to).toBe(6);
  });
});
