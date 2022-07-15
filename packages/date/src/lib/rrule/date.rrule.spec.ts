import { CalendarDate, CalendarDateUtility, DateRangeParams, DateRangeType, maxFutureDate, targetDateToBaseDate } from '../date';
import { addMinutes, addDays } from 'date-fns';
import { DateRRuleInstance, DateRRuleUtility } from './date.rrule';
import { DateRRuleParseUtility, RRuleStringLineSet } from './date.rrule.parse';
import RRule from 'rrule';
import { TimezoneString } from '@dereekb/util';

describe.skip('DateRRuleUtility', () => {
  describe('DateRRuleInstance', () => {
    describe('expand()', () => {
      describe('timezone shifting', () => {
        describe('(Denver to Los Angeles Time)', () => {
          /**
           * This example is from:
           *
           * https://github.com/jakubroztocil/rrule/tree/286422ddff0700f1beb2e65cebff3421cc698aac#important-use-utc-dates
           *
           * It show's RRule's weirdness when converting to timezones that aren't timezones.
           */
          describe('mo,we,th at 11AM-12PM (1PM-2PM CST) 3 times', () => {
            const rruleStringLineSet = ['DTSTART;TZID=America/Denver:20181101T190000;', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3'];

            const firstBaseDate = new Date(Date.UTC(2018, 10, 1, 19, 0, 0)); // what the parser will return from
            const expectedFirstDate = targetDateToBaseDate(firstBaseDate, 'America/Denver'); // 2018-11-02T01:00:00.000Z

            const expectedExpandResults = [expectedFirstDate, addDays(expectedFirstDate, 4), addDays(expectedFirstDate, 6)];

            it('should build the proper dates', () => {
              const results = DateRRuleUtility.expand({
                instanceFrom: {
                  rruleStringLineSet,
                  options: {}
                }
              });

              expect(results.dates.length).toBe(expectedExpandResults.length);

              for (let i = 0; i < results.dates.length; i += 1) {
                expect(results.dates[i].startsAt).toBeSameSecondAs(expectedExpandResults[i]);
              }
            });

            describe('with range', () => {
              it('it should return only the first date if start and end date equals first date', () => {
                const results = DateRRuleUtility.expand({
                  range: {
                    start: expectedFirstDate,
                    end: expectedFirstDate
                  },
                  instanceFrom: {
                    rruleStringLineSet,
                    options: {}
                  }
                });

                const expectedResults = [expectedFirstDate];

                expect(results.between).toBeDefined();
                expect(results.dates.length).toBe(expectedResults.length);
                expect(results.dates[0].startsAt).toBeSameSecondAs(expectedExpandResults[0]);
              });
            });
          });
        });

        describe('(Los Angeles Time to Central Time)', () => {
          describe('every week at 11AM-12PM in America/Los_Angeles, (1PM-2PM CST)', () => {
            let calendarDate: CalendarDate;
            let rangeParams: DateRangeParams;
            const timezone: string = 'America/Los_Angeles';
            const rruleStringLineSet = ['RRULE:FREQ=WEEKLY', 'EXDATE;TZID=America/Los_Angeles:20210611T110000,20210611T110000'];

            beforeEach(() => {
              calendarDate = CalendarDateUtility.calendarDateForDateDurationSpan({
                startsAt: new Date('2021-02-05T19:00:00.000Z'),
                duration: 60
              });

              // 2 weeks
              rangeParams = {
                type: DateRangeType.DAYS_RANGE,
                date: new Date('2021-06-27T00:00:00.000Z'),
                distance: 7 * 5
              };
            });

            it('should build the proper dates', () => {
              const results = DateRRuleUtility.expand({
                instanceFrom: {
                  rruleStringLineSet,
                  options: {
                    date: calendarDate,
                    timezone
                  }
                },
                rangeParams
              });

              const expectedResults = ['2021-07-02T18:00:00.000Z', '2021-07-09T18:00:00.000Z', '2021-07-16T18:00:00.000Z', '2021-07-23T18:00:00.000Z', '2021-07-30T18:00:00.000Z'].map((x) => new Date(x));

              expect(results.dates.length).toBe(expectedResults.length);

              for (let i = 0; i < results.dates.length; i += 1) {
                expect(results.dates[i].startsAt).toBeSameSecondAs(expectedResults[i]);
              }
            });
          });
        });
      });

      describe('full day', () => {
        describe('every monday', () => {
          let calendarDate: CalendarDate;
          let rangeParams: DateRangeParams;
          const rruleStringLineSet = ['RRULE:FREQ=WEEKLY;BYDAY=MO'];

          const numberOfWeeks = 2;

          beforeEach(() => {
            calendarDate = CalendarDateUtility.calendarDateForDay('2021-07-05');

            // 2 weeks
            rangeParams = {
              type: DateRangeType.WEEKS_RANGE,
              date: calendarDate.startsAt,
              distance: numberOfWeeks
            };
          });

          it('should expand to the new two mondays', () => {
            const results = DateRRuleUtility.expand({
              instanceFrom: {
                rruleStringLineSet,
                options: {
                  date: calendarDate
                }
              },
              rangeParams
            });

            expect(results.dates.length).toBe(numberOfWeeks + 1);
            expect(results.dates[0].startsAt).toBeSameMinuteAs(calendarDate.startsAt);
            expect(results.dates[1].startsAt).toBeSameMinuteAs(addDays(calendarDate.startsAt, 7));
            expect(results.dates[2].startsAt).toBeSameMinuteAs(addDays(calendarDate.startsAt, 14));
          });
        });
      });

      describe('hour event', () => {
        describe('every two days', () => {
          let calendarDate: CalendarDate;
          let rangeParams: DateRangeParams;
          const rruleStringLineSet = ['RRULE:FREQ=DAILY;INTERVAL=2'];

          const daysPeriod = 2;
          const numberOfDays = 8;

          beforeEach(() => {
            calendarDate = CalendarDateUtility.calendarDateForDateDurationSpan({
              startsAt: new Date('2021-07-06T16:00:00.000Z'),
              duration: 60
            });

            // 2 weeks
            rangeParams = {
              type: DateRangeType.DAYS_RANGE,
              date: calendarDate.startsAt,
              distance: numberOfDays
            };
          });

          it(`should expand to the next ${numberOfDays} days`, () => {
            const results = DateRRuleUtility.expand({
              instanceFrom: {
                rruleStringLineSet,
                options: {
                  date: calendarDate
                }
              },
              rangeParams
            });

            const expectedDays = numberOfDays / daysPeriod + 1;

            expect(results.dates.length).toBe(expectedDays);

            for (let i = 0; i < expectedDays; i += 1) {
              expect(results.dates[i].startsAt).toBeSameMinuteAs(addDays(calendarDate.startsAt, i * 2));
            }
          });
        });
      });
    });

    describe('next()', () => {
      describe('mo,we,th at 11AM-12PM (1PM-2PM CST) 3 times', () => {
        const rruleStringLineSet = ['DTSTART;TZID=America/Denver:20181101T190000;', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3'];
        let dateRRule: DateRRuleInstance;

        const firstBaseDate = new Date(Date.UTC(2018, 10, 1, 19, 0, 0)); // what the parser will return from
        const expectedFirstDate = targetDateToBaseDate(firstBaseDate, 'America/Denver'); // 2018-11-02T01:00:00.000Z

        beforeEach(async () => {
          dateRRule = DateRRuleUtility.makeInstance({
            rruleStringLineSet,
            options: {}
          });
        });

        it('should be the date if the next date is now.', () => {
          const currentDate = expectedFirstDate;
          const nextDate = currentDate;

          const next = dateRRule.nextRecurrenceDate(currentDate);
          expect(next).toBeSameSecondAs(nextDate);
        });

        it('should return the next date', () => {
          const currentDate = addMinutes(expectedFirstDate, 5);
          const nextDate = addDays(expectedFirstDate, 4);

          const next = dateRRule.nextRecurrenceDate(currentDate);
          expect(next).toBeSameSecondAs(nextDate);
        });
      });
    });

    describe('getRecurrenceDateRange()', () => {
      let calendarDate: CalendarDate;
      let rruleStringLineSet: RRuleStringLineSet;

      describe('forever', () => {
        describe('every two days', () => {
          beforeEach(() => {
            rruleStringLineSet = ['RRULE:FREQ=DAILY;INTERVAL=2'];
            calendarDate = CalendarDateUtility.calendarDateForDateDurationSpan({
              startsAt: new Date('2021-07-06T16:00:00.000Z'),
              duration: 60
            });
          });

          it(`should return an infinite range.`, () => {
            const dateRRule: DateRRuleInstance = DateRRuleUtility.makeInstance({
              rruleStringLineSet,
              options: {
                date: calendarDate
              }
            });

            const range = dateRRule.getRecurrenceDateRange();
            expect(range.forever).toBe(true);
            expect(range.start).toBeSameSecondAs(calendarDate.startsAt);
            expect(range.end).toBeSameSecondAs(maxFutureDate());
            expect(range.finalRecurrenceEndsAt).not.toBeDefined();
          });
        });
      });

      describe('until', () => {
        describe('first day of every month until April 1st 2022', () => {
          beforeEach(() => {
            rruleStringLineSet = ['FREQ=MONTHLY;BYMONTHDAY=1;INTERVAL=1;UNTIL=20220420T050000Z'];
            calendarDate = CalendarDateUtility.calendarDateForDateDurationSpan({
              startsAt: new Date('2021-01-01T00:00:00.000Z'),
              duration: 60
            });
          });

          it(`should return a finite range.`, () => {
            const dateRRule: DateRRuleInstance = DateRRuleUtility.makeInstance({
              rruleStringLineSet,
              options: {
                date: calendarDate
              }
            });

            const range = dateRRule.getRecurrenceDateRange();
            expect(range.forever).toBe(false);
            expect(range.start).toBeSameSecondAs(calendarDate.startsAt);
            expect(range.end).toBeSameSecondAs(new Date('2022-04-01T00:00:00.000Z'));
            expect(range.finalRecurrenceEndsAt).toBeDefined();
          });
        });
      });

      describe('count', () => {
        describe('second day of january, 10 times', () => {
          beforeEach(() => {
            rruleStringLineSet = ['FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=2;COUNT=10'];
            calendarDate = CalendarDateUtility.calendarDateForDateDurationSpan({
              startsAt: new Date('2021-01-01T00:00:00.000Z'),
              duration: 60
            });
          });

          it(`should return a finite range.`, () => {
            const dateRRule: DateRRuleInstance = DateRRuleUtility.makeInstance({
              rruleStringLineSet,
              options: {
                date: calendarDate
              }
            });

            const range = dateRRule.getRecurrenceDateRange();
            expect(range.forever).toBe(false);
            expect(range.start).toBeSameSecondAs(calendarDate.startsAt);
            expect(range.end).toBeSameSecondAs(new Date('2030-01-02T00:00:00.000Z'));
            expect(range.finalRecurrenceEndsAt).toBeDefined();
          });
        });
      });
    });
  });

  describe('toRRuleOptions', () => {
    describe('examples', () => {
      describe('mo,we,th at 11AM-12PM (1PM-2PM CST) 3 times', () => {
        function describeParseTestForTimezone(tzid: TimezoneString) {
          it('should make the options', () => {
            const rules = `DTSTART;TZID=${tzid}:20181101T190000\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3`;
            const expectedDTStart = new Date(Date.UTC(2018, 10, 1, 19, 0, 0));

            const output = RRule.parseString(rules);

            expect(output.dtstart).toBeDefined();
            expect(output.dtstart).toBeSameSecondAs(expectedDTStart);
            expect(output.tzid).toBe(tzid);

            const rruleStringLineSet = [`DTSTART;TZID=${tzid}:20181101T190000`, 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3'];

            const result = DateRRuleParseUtility.separateRRuleStringSetValues(rruleStringLineSet);
            const lines = DateRRuleParseUtility.toRRuleLines(result.basic);

            expect(lines).toBe(rules);

            const dateRruleOptions = DateRRuleUtility.toRRuleOptions(rruleStringLineSet);
            const options = dateRruleOptions.options;

            expect(options.tzid).toBe(output.tzid);
            expect(options.dtstart as Date).toBeSameSecondAs(output.dtstart as Date);
          });
        }

        describeParseTestForTimezone(`America/Chicago`);
        describeParseTestForTimezone(`America/Los_Angeles`);
      });
    });
  });
});
