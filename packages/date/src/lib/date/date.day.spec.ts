import { Day, UTC_TIMEZONE_STRING } from '@dereekb/util';
import { addMinutes, getDay } from 'date-fns';
import { dateBlockTiming, DateBlockDurationSpan, dateBlocksExpansionFactory } from './date.block';
import { yearMonthDayCodeFactory, yearMonthDayCode, yearMonthDayCodeDateFactory, yearMonthDayCodeGroupFactory, yearMonthDayCodeDay, yearMonthDayCodeMonth, yearMonthDayCodePairFromDate, yearMonthDayCodesForDateRangeFactory } from './date.day';

describe('yearMonthDayCodePairFromDate()', () => {
  it('should create a yearMonthDayCodePair from a date', () => {
    const systemDate = new Date(2022, 0, 2); // first second of the day date with an offset equal to the current.
    const result = yearMonthDayCodePairFromDate(systemDate);
    expect(result.day).toBe(2);
    expect(result.month).toBe(1);
    expect(result.year).toBe(2022);
  });
});

describe('yearMonthDayCodeFactory()', () => {
  describe('_normal', () => {
    it('should apply the expected offset.', () => {
      const systemDate = new Date(2022, 0, 2); // first second of the day date with an offset equal to the current.
      const utcDate = new Date('2022-01-02T00:00:00Z'); // date in utc. Implies there is no offset to consider.

      const systemTimezoneOffset = systemDate.getTimezoneOffset();
      const systemDateAsUtc = addMinutes(systemDate, -systemTimezoneOffset);

      expect(systemDateAsUtc).toBeSameSecondAs(utcDate);

      const factory = yearMonthDayCodeFactory();
      const viaNormal = factory._normal.targetDateToBaseDate(utcDate);

      expect(viaNormal).toBeSameSecondAs(systemDate);
    });
  });

  describe('function', () => {
    describe('number input', () => {
      it('should create the YearMonthDayCode', () => {
        const result = yearMonthDayCode(2022, 1, 1);
        expect(result).toBe(20220101);
      });
    });

    describe('date', () => {
      describe('using system timezone', () => {
        it('should create the YearMonthDayCode', () => {
          const date1 = new Date(2005, 0, 1);
          const resultA = yearMonthDayCode(date1);
          expect(resultA).toBe(20050101);

          const date2 = new Date(2005, 0, 2);
          const resultB = yearMonthDayCode(date2);
          expect(resultB).toBe(20050102);
        });
      });

      describe('with timezone', () => {
        const expected2022YearMonthDayCode1 = yearMonthDayCode(2021, 12, 26);
        const expected2022YearMonthDayCode2 = yearMonthDayCode(2022, 1, 2);

        const utc2022Week1StartDate = new Date('2021-12-26T00:00:00.000Z'); // date in utc.
        const utc2022Week2StartDate = new Date('2022-01-02T00:00:00Z'); // date in utc. Implies there is no offset to consider.

        describe('system', () => {
          const factory = yearMonthDayCodeFactory(); // defaults to the system when no timezone specified

          it('should return the job week', () => {
            const result = factory(utc2022Week2StartDate);
            const day = getDay(utc2022Week2StartDate); // gets the day relative to the current timezone

            if (day === Day.SATURDAY) {
              expect(result).toBe(expected2022YearMonthDayCode2 - 1);
            } else {
              expect(result).toBe(expected2022YearMonthDayCode2);
            }
          });
        });

        describe('UTC', () => {
          const factory = yearMonthDayCodeFactory({ timezone: UTC_TIMEZONE_STRING });

          it('should return job week 1', () => {
            const result = factory(utc2022Week1StartDate);
            expect(result).toBe(expected2022YearMonthDayCode1);
          });

          it('should return job week 2', () => {
            const result = factory(utc2022Week2StartDate);
            expect(result).toBe(expected2022YearMonthDayCode2);
          });

          describe('2017', () => {
            const expected2017YearMonthDayCode1 = yearMonthDayCode(2017, 1, 1);
            const utc2017Week1StartDate = new Date('2017-01-01T00:00:00.000Z'); // date in utc.

            it('should return job week 1', () => {
              const result = factory(utc2017Week1StartDate);
              expect(result).toBe(expected2017YearMonthDayCode1);
            });
          });
        });

        describe('America/Denver', () => {
          const factory = yearMonthDayCodeFactory({ timezone: 'America/Denver' });

          // still Jan 1st in America/Denver on the UTC Week2StartDate
          it('should return job week 1', () => {
            const result = factory(utc2022Week2StartDate); // saturday
            expect(result).toBe(expected2022YearMonthDayCode2 - 1);
          });
        });
      });
    });
  });
});

describe('yearMonthDayCodesForDateRangeFactory()', () => {
  describe('function', () => {
    describe('with timezone', () => {
      const expected2022YearMonthDayCode1 = yearMonthDayCode(2021, 12, 26);
      const expected2022YearMonthDayCode2 = yearMonthDayCode(2021, 12, 27);
      const expected2022YearMonthDayCode3 = yearMonthDayCode(2021, 12, 28);
      const expected2022YearMonthDayCode4 = yearMonthDayCode(2021, 12, 29);
      const expected2022YearMonthDayCode5 = yearMonthDayCode(2021, 12, 30);
      const expected2022YearMonthDayCode6 = yearMonthDayCode(2021, 12, 31);
      const expected2022YearMonthDayCode7 = yearMonthDayCode(2022, 1, 1);
      const expected2022YearMonthDayCode8 = yearMonthDayCode(2022, 1, 2);

      const utc2022Week1StartDate = new Date('2021-12-26T00:00:00.000Z'); // date in utc.
      const utc2022Week2StartDate = new Date('2022-01-02T00:00:00Z');
      const dateRange = { start: utc2022Week1StartDate, end: utc2022Week2StartDate };

      describe('system', () => {
        const dayForSystem = getDay(utc2022Week1StartDate); // gets the day relative to the current timezone
        const factory = yearMonthDayCodesForDateRangeFactory(yearMonthDayCodeFactory()); // defaults to the system when no timezone specified

        it('should return the day in an array', () => {
          const result = factory(utc2022Week1StartDate);
          expect(result.length).toBe(1);

          if (dayForSystem === Day.SATURDAY) {
            expect(result).toContain(expected2022YearMonthDayCode1 - 1);
          } else {
            expect(result).toContain(expected2022YearMonthDayCode1);
          }
        });

        it('should return the days for the date range', () => {
          const result = factory(dateRange);
          expect(result.length).toBe(8);
          expect(result).toContain(expected2022YearMonthDayCode1);
          expect(result).toContain(expected2022YearMonthDayCode2);
          expect(result).toContain(expected2022YearMonthDayCode3);
          expect(result).toContain(expected2022YearMonthDayCode4);
          expect(result).toContain(expected2022YearMonthDayCode5);
          expect(result).toContain(expected2022YearMonthDayCode6);
          expect(result).toContain(expected2022YearMonthDayCode7);

          if (dayForSystem === Day.SATURDAY) {
            expect(result).toContain(expected2022YearMonthDayCode1 - 1);
          } else {
            expect(result).toContain(expected2022YearMonthDayCode8);
          }
        });
      });

      describe('UTC', () => {
        const factory = yearMonthDayCodesForDateRangeFactory(yearMonthDayCodeFactory({ timezone: UTC_TIMEZONE_STRING }));

        it('should return the days for the month when starting from week 1', () => {
          const result = factory(dateRange);
          expect(result.length).toBe(8);
          expect(result).toContain(expected2022YearMonthDayCode1);
          expect(result).toContain(expected2022YearMonthDayCode2);
          expect(result).toContain(expected2022YearMonthDayCode3);
          expect(result).toContain(expected2022YearMonthDayCode4);
          expect(result).toContain(expected2022YearMonthDayCode5);
          expect(result).toContain(expected2022YearMonthDayCode6);
          expect(result).toContain(expected2022YearMonthDayCode7);
          expect(result).toContain(expected2022YearMonthDayCode8);
        });
      });

      describe('America/Denver', () => {
        const factory = yearMonthDayCodesForDateRangeFactory(yearMonthDayCodeFactory({ timezone: 'America/Denver' }));

        it('should return the days for the month', () => {
          const result = factory(dateRange);
          expect(result.length).toBe(8);
          expect(result).toContain(expected2022YearMonthDayCode1 - 1);
          expect(result).toContain(expected2022YearMonthDayCode1);
          expect(result).toContain(expected2022YearMonthDayCode2);
          expect(result).toContain(expected2022YearMonthDayCode3);
          expect(result).toContain(expected2022YearMonthDayCode4);
          expect(result).toContain(expected2022YearMonthDayCode5);
          expect(result).toContain(expected2022YearMonthDayCode6);
          expect(result).toContain(expected2022YearMonthDayCode7);
        });
      });
    });
  });
});

describe('yearMonthDayCodeDay()', () => {
  it('should return the expected index', () => {
    const dayIndex = 2;
    const input = yearMonthDayCode(2022, 1, dayIndex);

    const result = yearMonthDayCodeDay(input);
    expect(result).toBe(dayIndex);
  });
});

describe('yearMonthDayCodeMonth()', () => {
  it('should return the expected index', () => {
    const monthIndex = 2;
    const input = yearMonthDayCode(2022, monthIndex, 1);

    const result = yearMonthDayCodeMonth(input);
    expect(result).toBe(monthIndex);
  });
});

describe('yearMonthDayCodeDateFactory()', () => {
  const expected2022YearMonthDayCode1 = yearMonthDayCode(2021, 12, 26);
  const expected2022YearMonthDayCode2 = yearMonthDayCode(2022, 1, 2);

  describe('function', () => {
    describe('with timezone', () => {
      describe('system', () => {
        const denver2022Week1StartDate = new Date('2021-12-26T00:00:00');
        const denver2022Week2StartDate = new Date('2022-01-02T00:00:00'); // date in system time.
        const factory = yearMonthDayCodeDateFactory();

        it('should return the date for week 1 day 1.', () => {
          const result = factory(expected2022YearMonthDayCode1);
          expect(result).toBeSameSecondAs(denver2022Week1StartDate);
        });

        it('should return the date for week 2 day 1.', () => {
          const result = factory(expected2022YearMonthDayCode2);
          expect(result).toBeSameSecondAs(denver2022Week2StartDate);
        });
      });

      describe('UTC', () => {
        const utc2022Week1StartDate = new Date('2021-12-26T00:00:00Z');
        const utc2022Week2StartDate = new Date('2022-01-02T00:00:00Z');
        const factory = yearMonthDayCodeDateFactory({ timezone: UTC_TIMEZONE_STRING });

        it('should return the date for week 1 day 1.', () => {
          const result = factory(expected2022YearMonthDayCode1);
          expect(result).toBeSameSecondAs(utc2022Week1StartDate);
        });

        it('should return the date for week 2 day 1.', () => {
          const result = factory(expected2022YearMonthDayCode2);
          expect(result).toBeSameSecondAs(utc2022Week2StartDate);
        });
      });

      describe('America/Denver', () => {
        const denver2022Week1StartDate = new Date('2021-12-26T07:00:00Z');
        const denver2022Week2StartDate = new Date('2022-01-02T07:00:00Z'); // date in utc. Implies there is no offset to consider.
        const factory = yearMonthDayCodeDateFactory({ timezone: 'America/Denver' });

        it('should return the date for week 1 day 1.', () => {
          const result = factory(expected2022YearMonthDayCode1);
          expect(result).toBeSameSecondAs(denver2022Week1StartDate);
        });

        it('should return the date for week 2 day 1.', () => {
          const result = factory(expected2022YearMonthDayCode2);
          expect(result).toBeSameSecondAs(denver2022Week2StartDate);
        });
      });

      describe('Europe/Amsterdam', () => {
        const amsterdam2022Week1StartDate = new Date('2021-12-25T23:00:00.000Z');
        const amsterdam2022Week2StartDate = new Date('2022-01-01T23:00:00.000Z'); // date in utc. Implies there is no offset to consider.
        const factory = yearMonthDayCodeDateFactory({ timezone: 'Europe/Amsterdam' });

        it('should return the date for week 1 day 1.', () => {
          const result = factory(expected2022YearMonthDayCode1);
          expect(result).toBeSameSecondAs(amsterdam2022Week1StartDate);
        });

        it('should return the date for week 2 day 1.', () => {
          const result = factory(expected2022YearMonthDayCode2);
          expect(result).toBeSameSecondAs(amsterdam2022Week2StartDate);
        });
      });
    });
  });
});

describe('yearMonthDayCodeGroupFactory()', () => {
  const startsAt = new Date('2022-01-02T00:00:00Z'); // Sunday
  const weekTiming = dateBlockTiming({ startsAt, duration: 60 }, 30); // Sunday-Saturday

  const weekDaysAndWeekends = dateBlocksExpansionFactory({
    timing: weekTiming
  });

  describe('function', () => {
    describe('timezone', () => {
      describe('UTC', () => {
        const groupFactory = yearMonthDayCodeGroupFactory<DateBlockDurationSpan>({
          yearMonthDayCodeFactory: { timezone: 'UTC' },
          dateReader: (x) => x.startsAt
        });

        it('should group the input values by week.', () => {
          const dateBlockForRange = {
            i: 0,
            to: 13 // 2 weeks
          };

          const dates = weekDaysAndWeekends([dateBlockForRange, { i: 0, to: 0 }]); // two ranges to blocks, first day should have two items grouped.
          const groups = groupFactory(dates);

          expect(groups.length).toBe(14);
          expect(groups[0].dayCode).toBe(20220102);
          expect(groups[0].items.length).toBe(2);
          expect(groups[1].dayCode).toBe(20220103);
          expect(groups[1].items.length).toBe(1);
        });
      });
    });
  });
});
