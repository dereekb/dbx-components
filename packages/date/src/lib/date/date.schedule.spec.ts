import { DateBlockIndex } from './date.block';
import { DateBlock, dateBlockTiming, systemNormalDateToBaseDate } from '@dereekb/date';
import { expandDateScheduleFactory, DateSchedule, dateScheduleDateBlockTimingFilter, DateScheduleDayCode, dateScheduleDayCodeFactory, dateScheduleEncodedWeek, dateScheduleDateFilter, DateScheduleDateFilterConfig } from './date.schedule';
import { addDays } from 'date-fns';
import { range, UTC_TIMEZONE_STRING } from '@dereekb/util';

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

      // TODO: Test max date range
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

describe('dateScheduleEncodedWeek()', () => {
  it('should return an empty string if only NONE is provided.', () => {
    const codes = [DateScheduleDayCode.NONE];
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
