import { CalendarDate, calendarDateFactory, calendarDateForDateDurationSpan, DateRangeParams, DateRangeType, maxFutureDate, targetDateToBaseDate } from '../date';
import { addMinutes, addDays, addHours } from 'date-fns';
import { DateRRuleInstance, DateRRuleUtility } from './date.rrule';
import { RRuleStringLineSet } from './date.rrule.parse';

describe('DateRRuleUtility', () => {
  describe('DateRRuleInstance', () => {
    describe('expand()', () => {
      describe('timezone shifting', () => {
        describe('(Denver to Current Timezone)', () => {
          /**
           * This example is from:
           *
           * https://github.com/jakubroztocil/rrule/tree/286422ddff0700f1beb2e65cebff3421cc698aac#important-use-utc-dates
           *
           * It show's RRule's weirdness when converting to timezones that aren't timezones.
           */
          describe('mo at 7PM MDT we,th at 8PM MST 3 times', () => {
            /**
             * the DateRRuleUtility will:
             * - first capture the UTC Date: new Date(Date.UTC(2018, 10, 1, 19, 0, 0)), which is a "target" date, since it has a specific timezone.
             * This date should be treated as 7PM in Denver, despite being read as 7PM in UTC. To use it it is automatically converted to UTC.
             * - capture the timezone (TZID=America/Denver) that is required for the above conversion
             * - convert that date, 7PM in Denver, to 7PM in UTC. This will add the Denver offset on that day.
             *
             * NOTES:
             * - After the MST timezone shift the original "target" date is still valid, so the event still occurs at 19:00 MST
             */
            const rruleStringLineSet = ['DTSTART;TZID=America/Denver:20181101T190000;', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3'];

            const firstBaseDate = new Date(Date.UTC(2018, 10, 1, 19, 0, 0)); // 2018-11-01T19:00:00.000Z, what the parser should return
            const secondBaseDate = new Date(Date.UTC(2018, 10, 5, 19, 0, 0)); // 2018-11-05T19:00:00.000Z the 19:00 remains the same, since this still implies 7PM in Denver on this date.
            const thirdBaseDate = new Date(Date.UTC(2018, 10, 7, 19, 0, 0));

            // const wrongSecondBaseDate = addDays(firstBaseDate, 4); // NOTE: Do not use addDays, as it considers timezone changes, and would return 20:00 in Denver instead.

            const mdtTimezoneOffset = -6;
            const mstTimezoneOffset = -7;

            const expectedFirstUtcDate = addHours(firstBaseDate, -mdtTimezoneOffset);
            const expectedSecondUtcDate = addHours(secondBaseDate, -mstTimezoneOffset);
            const expectedThirdUtcDate = addHours(thirdBaseDate, -mstTimezoneOffset);

            const expectedFirstDate = targetDateToBaseDate(firstBaseDate, 'America/Denver'); // 2018-11-02T01:00:00.000Z, which is 2018-11-01T19:00:00.000Z - -6 hours for denver's offset
            const expectedSecondDate = targetDateToBaseDate(secondBaseDate, 'America/Denver'); // 2018-11-06T02:00:00.000Z
            const expectedThirdDate = targetDateToBaseDate(thirdBaseDate, 'America/Denver'); // 2018-11-08T02:00:00.000Z

            const expectedExpandResults = [expectedFirstDate, expectedSecondDate, expectedThirdDate];

            it('should build the proper dates denver', () => {
              expect(expectedFirstDate).toBeSameSecondAs(expectedFirstUtcDate);
              expect(expectedSecondDate).toBeSameSecondAs(expectedSecondUtcDate); // timezone changes to MST
              expect(expectedThirdDate).toBeSameSecondAs(expectedThirdUtcDate);

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
              calendarDate = calendarDateForDateDurationSpan({
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
        describe('every monday in the denver timezone', () => {
          let calendarDate: CalendarDate;
          let rangeParams: DateRangeParams;
          const rruleStringLineSet = ['RRULE:FREQ=WEEKLY;BYDAY=MO'];

          const numberOfWeeks = 2;

          beforeEach(() => {
            calendarDate = calendarDateFactory({ timezone: 'America/Denver' })('2021-07-05');

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
                  date: calendarDate,
                  timezone: 'America/Denver'
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
            calendarDate = calendarDateForDateDurationSpan({
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
        let dateRRule: DateRRuleInstance;

        const rruleStringLineSet = ['DTSTART;TZID=America/Denver:20181101T190000;', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3'];

        const firstBaseDate = new Date(Date.UTC(2018, 10, 1, 19, 0, 0)); // 2018-11-01T19:00:00.000Z, what the parser should return
        const secondBaseDate = new Date(Date.UTC(2018, 10, 5, 19, 0, 0)); // 2018-11-05T19:00:00.000Z the 19:00 remains the same, since this still implies 7PM in Denver on this date.

        const expectedFirstDate = targetDateToBaseDate(firstBaseDate, 'America/Denver'); // 2018-11-02T01:00:00.000Z, which is 2018-11-01T19:00:00.000Z - -6 hours for denver's offset
        const expectedSecondDate = targetDateToBaseDate(secondBaseDate, 'America/Denver'); // 2018-11-06T02:00:00.000Z

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
          const nextDate = expectedSecondDate;

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
            calendarDate = calendarDateForDateDurationSpan({
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
            calendarDate = calendarDateForDateDurationSpan({
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
            calendarDate = calendarDateForDateDurationSpan({
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

  // TODO: Can add test back once "import { parseString } from 'rrule/dist/esm/parsestring';" works in jest.
  /*
  describe('toRRuleOptions', () => {
    describe('examples', () => {
      describe('mo,we,th at 11AM-12PM (1PM-2PM CST) 3 times', () => {
        function describeParseTestForTimezone(tzid: TimezoneString) {
          it('should make the options', () => {
            const rules = `DTSTART;TZID=${tzid}:20181101T190000\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,TH;INTERVAL=1;COUNT=3`;
            const expectedDTStart = new Date(Date.UTC(2018, 10, 1, 19, 0, 0));

            const output = parseString(rules);

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
  */
});
