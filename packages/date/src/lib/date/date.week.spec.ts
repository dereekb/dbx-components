import { Day, UTC_TIMEZONE_STRING } from '@dereekb/util';
import { addMinutes, addWeeks, getDay } from 'date-fns';
import { dateCellTiming, DateCellDurationSpan } from './date.cell';
import { dateCellTimingExpansionFactory } from './date.cell.factory';
import { yearWeekCodeFactory, yearWeekCode, yearWeekCodeForCalendarMonthFactory, yearWeekCodeIndex, yearWeekCodeDateFactory, yearWeekCodeGroupFactory, YearWeekCode, YearWeekCodeString, yearWeekCodeForDateRange } from './date.week';

describe('yearWeekCodeForDateRange()', () => {
  const utc2022Week1StartDate = new Date('2021-12-26T00:00:00.000'); // date in current timezone

  it('should generate the year week codes for the date range.', () => {
    const totalWeeks = 3;
    const range = { start: utc2022Week1StartDate, end: addWeeks(utc2022Week1StartDate, totalWeeks - 1) };
    const result = yearWeekCodeForDateRange(range);
    expect(result.length).toBe(totalWeeks);
    expect(result[0]).toBe(yearWeekCode(2022, 1));
    expect(result[1]).toBe(yearWeekCode(2022, 2));
    expect(result[2]).toBe(yearWeekCode(2022, 3));
  });

  it('should generate the year week codes for a single day date range.', () => {
    const range = { start: utc2022Week1StartDate, end: utc2022Week1StartDate };
    const result = yearWeekCodeForDateRange(range);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(yearWeekCode(2022, 1));
  });
});

describe('yearWeekCodeFactory()', () => {
  describe('_normal', () => {
    it('should apply the expected offset.', () => {
      const systemDate = new Date(2022, 0, 2); // first second of the day date with an offset equal to the current.
      const utcDate = new Date('2022-01-02T00:00:00Z'); // date in utc. Implies there is no offset to consider.

      const systemTimezoneOffset = systemDate.getTimezoneOffset();
      const systemDateAsUtc = addMinutes(systemDate, -systemTimezoneOffset);

      expect(systemDateAsUtc).toBeSameSecondAs(utcDate);

      const factory = yearWeekCodeFactory();
      const viaNormal = factory._normal.targetDateToBaseDate(utcDate);

      expect(viaNormal).toBeSameSecondAs(systemDate);
    });
  });

  describe('function', () => {
    describe('number input', () => {
      it('should create the YearWeekCode', () => {
        const result = yearWeekCode(2022, 1);
        expect(result).toBe(202201);
      });
    });

    describe('date', () => {
      describe('using system timezone', () => {
        it('should create the YearWeekCode', () => {
          const date1 = new Date(2005, 0, 1);
          const resultA = yearWeekCode(date1); // Jan 1st is a Saturday, week 1
          expect(resultA).toBe(200501);

          const date2 = new Date(2005, 0, 2);
          const resultB = yearWeekCode(date2); // Jan 2nd is a Sunday, week 2
          expect(resultB).toBe(200502);
        });
      });

      describe('with timezone', () => {
        const expected2022YearWeekCode1 = yearWeekCode(2022, 1);
        const expected2022YearWeekCode2 = yearWeekCode(2022, 2);

        const utc2022Week1StartDate = new Date('2021-12-26T00:00:00.000Z'); // date in utc.
        const utc2022Week2StartDate = new Date('2022-01-02T00:00:00Z'); // date in utc. Implies there is no offset to consider.

        describe('system', () => {
          const factory = yearWeekCodeFactory(); // defaults to the system when no timezone specified

          it('should return the job week', () => {
            const result = factory(utc2022Week2StartDate);
            const day = getDay(utc2022Week2StartDate); // gets the day relative to the current timezone

            if (day === Day.SATURDAY) {
              expect(result).toBe(expected2022YearWeekCode1);
            } else {
              expect(result).toBe(expected2022YearWeekCode2);
            }
          });
        });

        describe('UTC', () => {
          const factory = yearWeekCodeFactory({ timezone: UTC_TIMEZONE_STRING });

          describe('2017', () => {
            const expected2017YearWeekCode1 = yearWeekCode(2017, 1);
            const utc2017Week1StartDate = new Date('2017-01-01T00:00:00.000Z'); // date in utc.

            it('should return job week 1', () => {
              const result = factory(utc2017Week1StartDate);
              expect(result).toBe(expected2017YearWeekCode1);
            });
          });

          it('should return job week 1', () => {
            const result = factory(utc2022Week1StartDate);
            expect(result).toBe(expected2022YearWeekCode1);
          });

          it('should return job week 2', () => {
            const result = factory(utc2022Week2StartDate);
            expect(result).toBe(expected2022YearWeekCode2);
          });
        });

        describe('America/Denver', () => {
          const factory = yearWeekCodeFactory({ timezone: 'America/Denver' });

          // still Jan 1st in America/Denver on the UTC Week2StartDate
          it('should return job week 1', () => {
            const result = factory(utc2022Week2StartDate);
            expect(result).toBe(expected2022YearWeekCode1);
          });
        });
      });
    });
  });
});

describe('yearWeekCodeForMonthFactory()', () => {
  describe('function', () => {
    describe('with timezone', () => {
      const expected2022YearWeekCode1 = yearWeekCode(2022, 1);
      const expected2022YearWeekCode2 = yearWeekCode(2022, 2);
      const expected2022YearWeekCode3 = yearWeekCode(2022, 3);
      const expected2022YearWeekCode4 = yearWeekCode(2022, 4);
      const expected2022YearWeekCode5 = yearWeekCode(2022, 5);

      const utc2022Week1StartDate = new Date('2021-12-26T00:00:00.000Z'); // date in utc.
      const utc2022Week2StartDate = new Date('2022-01-02T00:00:00Z');

      describe('system', () => {
        const factory = yearWeekCodeForCalendarMonthFactory(yearWeekCodeFactory()); // defaults to the system when no timezone specified

        it('should return the job weeks for the month', () => {
          const result = factory(utc2022Week2StartDate);
          expect(result.length).toBe(6);
          expect(result).toContain(expected2022YearWeekCode1);
          expect(result).toContain(expected2022YearWeekCode2);
          expect(result).toContain(expected2022YearWeekCode3);
          expect(result).toContain(expected2022YearWeekCode4);
          expect(result).toContain(expected2022YearWeekCode5);
        });
      });

      describe('UTC', () => {
        const factory = yearWeekCodeForCalendarMonthFactory(yearWeekCodeFactory({ timezone: UTC_TIMEZONE_STRING }));

        it('should return the job weeks for the month when starting from week 1', () => {
          const result = factory(utc2022Week1StartDate);
          expect(result.length).toBe(6);
          expect(result).toContain(expected2022YearWeekCode1);
          expect(result).toContain(expected2022YearWeekCode2);
          expect(result).toContain(expected2022YearWeekCode3);
          expect(result).toContain(expected2022YearWeekCode4);
          expect(result).toContain(expected2022YearWeekCode5);
        });

        it('should return the job weeks for the month', () => {
          const result = factory(utc2022Week2StartDate);
          expect(result.length).toBe(6);
          expect(result).toContain(expected2022YearWeekCode1);
          expect(result).toContain(expected2022YearWeekCode2);
          expect(result).toContain(expected2022YearWeekCode3);
          expect(result).toContain(expected2022YearWeekCode4);
          expect(result).toContain(expected2022YearWeekCode5);
        });
      });

      describe('America/Denver', () => {
        const factory = yearWeekCodeForCalendarMonthFactory(yearWeekCodeFactory({ timezone: 'America/Denver' }));

        it('should return the job weeks for the month', () => {
          const result = factory(utc2022Week2StartDate);
          expect(result.length).toBe(6);
          expect(result).toContain(expected2022YearWeekCode1);
          expect(result).toContain(expected2022YearWeekCode2);
          expect(result).toContain(expected2022YearWeekCode3);
          expect(result).toContain(expected2022YearWeekCode4);
          expect(result).toContain(expected2022YearWeekCode5);
        });
      });
    });
  });
});

describe('yearWeekCodeIndex()', () => {
  it('should return the expected index', () => {
    const weekIndex = 2;
    const input = yearWeekCode(2022, weekIndex);

    const result = yearWeekCodeIndex(input);
    expect(result).toBe(weekIndex);
  });
});

describe('yearWeekCodeDateFactory()', () => {
  const expected2022YearWeekCode1 = yearWeekCode(2022, 1);
  const expected2022YearWeekCode2 = yearWeekCode(2022, 2);

  describe('function', () => {
    describe('with timezone', () => {
      describe('UTC', () => {
        const utc2022Week1StartDate = new Date('2021-12-26T00:00:00Z');
        const utc2022Week2StartDate = new Date('2022-01-02T00:00:00Z');
        const factory = yearWeekCodeDateFactory({ timezone: UTC_TIMEZONE_STRING });

        it('should return the date for week 1.', () => {
          const result = factory(expected2022YearWeekCode1);
          expect(result).toBeSameSecondAs(utc2022Week1StartDate);
        });

        it('should return the date for week 2.', () => {
          const result = factory(expected2022YearWeekCode2);
          expect(result).toBeSameSecondAs(utc2022Week2StartDate);
        });
      });

      describe('America/Denver', () => {
        const denver2022Week1StartDate = new Date('2021-12-26T07:00:00Z');
        const denver2022Week2StartDate = new Date('2022-01-02T07:00:00Z'); // date in utc. Implies there is no offset to consider.
        const factory = yearWeekCodeDateFactory({ timezone: 'America/Denver' });

        it('should return the date for week 1.', () => {
          const result = factory(expected2022YearWeekCode1);
          expect(result).toBeSameSecondAs(denver2022Week1StartDate);
        });

        it('should return the date for week 2.', () => {
          const result = factory(expected2022YearWeekCode2);
          expect(result).toBeSameSecondAs(denver2022Week2StartDate);
        });
      });

      describe('Europe/Amsterdam', () => {
        const amsterdam2022Week1StartDate = new Date('2021-12-25T23:00:00.000Z');
        const amsterdam2022Week2StartDate = new Date('2022-01-01T23:00:00.000Z'); // date in utc. Implies there is no offset to consider.
        const factory = yearWeekCodeDateFactory({ timezone: 'Europe/Amsterdam' });

        it('should return the date for week 1.', () => {
          const result = factory(expected2022YearWeekCode1);
          expect(result).toBeSameSecondAs(amsterdam2022Week1StartDate);
        });

        it('should return the date for week 2.', () => {
          const result = factory(expected2022YearWeekCode2);
          expect(result).toBeSameSecondAs(amsterdam2022Week2StartDate);
        });
      });
    });
  });
});

describe('yearWeekCodeGroupFactory()', () => {
  const startsAt = new Date('2022-01-02T00:00:00Z'); // Sunday
  const weekTiming = dateCellTiming({ startsAt, duration: 60 }, 30); // Sunday-Saturday

  const weekDaysAndWeekends = dateCellTimingExpansionFactory({
    timing: weekTiming
  });

  describe('function', () => {
    describe('yearWeekCode values', () => {
      const groupFactory = yearWeekCodeGroupFactory<YearWeekCode | YearWeekCodeString>({
        dateReader: (x) => x
      });

      it('should group the input number values by week.', () => {
        const dates = [202202, 202203];
        const groups = groupFactory(dates);

        expect(groups.length).toBe(2);
        expect(groups[0].week).toBe(202202);
        expect(groups[1].week).toBe(202203);
      });

      it('should group the input string values by week.', () => {
        const dates = [202202, 202203].map(String);
        const groups = groupFactory(dates);

        expect(groups.length).toBe(2);
        expect(groups[0].week).toBe(202202);
        expect(groups[1].week).toBe(202203);
      });
    });

    describe('timezone', () => {
      describe('UTC', () => {
        const groupFactory = yearWeekCodeGroupFactory<DateCellDurationSpan>({
          yearWeekCodeFactory: { timezone: 'UTC' },
          dateReader: (x) => x.startsAt
        });

        it('should group the input values by week.', () => {
          const dateCellForRange = {
            i: 0,
            to: 13 // 2 weeks
          };

          const dates = weekDaysAndWeekends([dateCellForRange]);
          const groups = groupFactory(dates);

          expect(groups.length).toBe(2);
          expect(groups[0].week).toBe(202202);
          expect(groups[1].week).toBe(202203);
        });
      });
    });
  });
});
