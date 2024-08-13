import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { dateTimeField, DbxDateTimeFieldTimeMode, DbxDateTimeValueMode, dateRangeField, DbxDateTimePickerConfiguration, dateTimeRangeField, timezoneStringField, fixedDateRangeField } from '@dereekb/dbx-form';
import { addDays, addHours, addMinutes, addMonths, endOfDay, endOfMonth, startOfDay, startOfMonth } from 'date-fns';
import { type Maybe, type TimezoneString } from '@dereekb/util';
import { BehaviorSubject, Observable, delay, interval, map, of } from 'rxjs';
import { DateRangeType, DateCellScheduleDayCode, DateCellScheduleEncodedWeek, dateRange, dateTimezoneUtcNormal, toJsDate, roundDownToMinute, isSameDate, findMaxDate, findMinDate } from '@dereekb/date';

@Component({
  templateUrl: './value.date.component.html'
})
export class DocFormDateValueComponent {
  readonly dateValues$ = of({
    date: startOfDay(new Date()),
    dateAsString: addDays(new Date(), -6),
    dayOnly: addDays(new Date(), 6),
    dayOnlyAsString: addDays(new Date(), 12),
    unixTimeStamp: new Date().getTime(),
    unixTimeStampInNewYork: new Date().getTime(),
    minuteOfDay: 720,
    changingConfiguration: new Date(),
    dateOnlyWithLockedTimezone: dateTimezoneUtcNormal({ timezone: 'Asia/Tokyo' }).systemDateToTargetDate(startOfDay(new Date())),
    timeOnlyWithLockedTimezone: dateTimezoneUtcNormal({ timezone: 'America/New_York' }).systemDateToTargetDate(startOfDay(new Date()))
  });

  private _timezone = new BehaviorSubject<Maybe<TimezoneString>>(undefined);

  readonly timezone$ = this._timezone.asObservable();

  readonly timezoneSelectionField: FormlyFieldConfig[] = [timezoneStringField()];

  readonly onTimezoneChange = (value: { timezone: Maybe<TimezoneString> }) => {
    this._timezone.next(value?.timezone);
  };

  readonly dateTimeFields: FormlyFieldConfig[] = [
    dateTimeField({ timezone: this.timezone$, label: 'Date Picker', key: 'datePicker', allDayLabel: 'On', valueMode: DbxDateTimeValueMode.DATE, timeMode: DbxDateTimeFieldTimeMode.NONE }),
    dateTimeField({ timezone: this.timezone$, label: 'Day Only W/ String Value', hideDateHint: true, key: 'dayOnlyAsString', valueMode: DbxDateTimeValueMode.DAY_STRING, description: 'This date field is for picking a day only and as an ISO8601DayString. The calendar picker is hidden and the allDayLabel has been customized to be "On".', hideDatePicker: true }),
    dateTimeField({ timezone: this.timezone$, key: 'date', required: true, description: 'This is the default date field that requires the user pick a date and time.' }),
    dateTimeField({ timezone: this.timezone$, label: 'Date With String Value', key: 'dateAsString', required: true, valueMode: DbxDateTimeValueMode.DATE_STRING, description: 'This date field returns the value as an ISO8601DateString. The date hint is also hidden.', hideDateHint: true }),
    dateTimeField({
      timezone: this.timezone$,
      label: 'Time For Work Day Today (For Timezone)',
      alwaysShowDateInput: false,
      timeDate: new Date(),
      showClearButton: false,
      key: 'timeForWorkDayToday',
      description: 'This date field has a filter that only allows picking a time for todays work day (between 9AM and 5PM).',
      pickerConfig: {
        limits: {
          min: addHours(startOfDay(new Date()), 9),
          max: addHours(startOfDay(new Date()), 9 + 8)
        }
      }
    }),
    dateTimeField({ timezone: this.timezone$, key: 'timeOptional', timeMode: DbxDateTimeFieldTimeMode.OPTIONAL, description: 'This date field is for picking a day, with an optional time.' }),
    dateTimeField({ timezone: this.timezone$, label: 'Day Only', key: 'dayOnly', timeMode: DbxDateTimeFieldTimeMode.NONE, description: 'This date field is for picking a day only.' }),
    dateTimeField({
      timezone: this.timezone$,
      label: 'Time Only',
      key: 'timeOnly',
      timeOnly: true,
      description: 'This date field is for picking a time only. The date and timezone hint is also hidden. It has custom time preset values.',
      hideDateHint: true,
      showTimezone: false,
      presets: [
        { label: '12:00 AM', timeString: '12:00AM' },
        { label: '12:30 PM', timeString: '12:30PM' },
        { label: 'Now', logicalDate: 'now' }
      ]
    }),
    dateTimeField({
      timezone: this.timezone$,
      label: 'Time For Today (For Timezone)',
      alwaysShowDateInput: false,
      timeDate: new Date(),
      showClearButton: false,
      key: 'timeForToday',
      description: 'This date field has a filter that only allows picking a time for today (that is within the last two hours and next two hours). This date field is configured to not show the clear button. This field is also configured to hide the date field when the selectable date is only a single day.',
      pickerConfig: {
        limits: {
          min: findMaxDate([startOfDay(new Date()), addHours(new Date(), -2)]),
          max: findMinDate([endOfDay(new Date()), addHours(new Date(), 2)])
        }
      }
    }),
    dateTimeField({
      label: 'Changing Configuration',
      showClearButton: false,
      key: 'changingConfiguration',
      description: 'This date field has a filter that changes every second to require a minute more in the future for every second that passes.',
      pickerConfig: interval(1000).pipe(
        map((x) => {
          return {
            limits: {
              min: addMinutes(new Date(), x)
            }
          };
        })
      )
    }),
    dateTimeField({ label: 'Unix Timestamp', key: 'unixTimeStamp', valueMode: DbxDateTimeValueMode.UNIX_TIMESTAMP, description: 'This date field picks a unix timestamp for the system timezone.', hideDateHint: true }),
    dateTimeField({ label: 'Unix Timestamp In New York', key: 'unixTimeStampInNewYork', valueMode: DbxDateTimeValueMode.UNIX_TIMESTAMP, timeMode: DbxDateTimeFieldTimeMode.REQUIRED, description: 'This date field picks a unix timestamp for a specific timezone.', hideDateHint: true, timezone: 'America/New_York' }),
    dateTimeField({ label: 'Date Only In Tokyo', key: 'dateOnlyWithLockedTimezone', timeMode: DbxDateTimeFieldTimeMode.NONE, description: 'This date field picks a date and has a locked timezone.', timezone: 'Asia/Tokyo' }),
    dateTimeField({ label: 'Time Only In New York', key: 'timeOnlyWithLockedTimezone', timeOnly: true, description: 'This date field picks a time and has a locked timezone.', hideDateHint: true, timezone: 'America/New_York' }),
    dateTimeField({ label: 'Minute Of Day', key: 'minuteOfDay', valueMode: DbxDateTimeValueMode.MINUTE_OF_DAY, timeMode: DbxDateTimeFieldTimeMode.REQUIRED, timeOnly: true, description: 'This date field picks a minute of day for the system timezone.', hideDateHint: true }),
    dateTimeField({ label: 'Minute Of Day For New York', key: 'minuteOfDayForNewYork', valueMode: DbxDateTimeValueMode.MINUTE_OF_DAY, timeMode: DbxDateTimeFieldTimeMode.REQUIRED, showTimezone: true, timeOnly: true, description: 'This date field picks a minute of day for America/New_York.', hideDateHint: true, timezone: 'America/New_York' }),
    dateTimeField({ label: 'System Minute Of Day For New York', key: 'systemMinuteOfDayForNewYork', valueMode: DbxDateTimeValueMode.SYSTEM_MINUTE_OF_DAY, timeMode: DbxDateTimeFieldTimeMode.REQUIRED, timeOnly: true, description: 'This date field picks a minute of day for the system but shows the timezone as America/New_York.', hideDateHint: true, timezone: 'America/New_York' }),
    dateTimeField({ timezone: this.timezone$, label: 'Timezone Day', key: 'timezoneDay', valueMode: DbxDateTimeValueMode.DATE_STRING }),
    dateTimeField({
      timezone: this.timezone$,
      key: 'dateWithASchedule',
      required: true,
      description: 'This date is limited to specific days specified by a schedule of M/W/F and the next 7 days from today. A minimum of today and a maximum of 14 days from now.',
      pickerConfig: () => {
        const config: DbxDateTimePickerConfiguration = {
          limits: {
            min: startOfDay(new Date()),
            max: addDays(new Date(), 14)
          },
          schedule: {
            w: `${DateCellScheduleDayCode.MONDAY}${DateCellScheduleDayCode.WEDNESDAY}${DateCellScheduleDayCode.FRIDAY}` as any,
            d: [0, 1, 2, 3, 4, 5, 6] // next 7 days
          }
        };

        return of(config);
      }
    })
  ];

  readonly dateTimeRangeValues$ = of({
    sat: addHours(startOfDay(new Date()), 8),
    eat: addHours(startOfDay(new Date()), 16),
    satcdt: new Date('2023-11-08T06:00:00.000Z'),
    eatcdt: new Date('2023-11-08T19:00:00.000Z'),
    satcst: new Date('2024-03-21T05:00:00.000Z'),
    eatcst: new Date('2024-03-21T18:00:00.000Z'),
    sat2: new Date('2023-11-08T06:00:00.000Z'),
    eat2: new Date('2024-03-21T18:00:00.000Z'),
    timezoneDay: new Date('2023-11-01T06:00:00.000Z')
  }).pipe(delay(200)); // simulate a slight loading delay

  readonly dateTimeRangeFields: FormlyFieldConfig[] = [
    dateTimeRangeField({
      timezone: this.timezone$,
      start: {
        key: 'sat'
      },
      end: {
        key: 'eat'
      }
    }),
    dateTimeRangeField({
      timezone: 'America/Chicago',
      timeDate: '2023-11-08',
      start: {
        label: 'Start Time on 2023-11-08 (CDT)',
        key: 'satcdt'
      },
      end: {
        key: 'eatcdt'
      }
    }),
    dateTimeRangeField({
      timezone: 'America/Chicago',
      timeDate: '2024-03-21',
      start: {
        label: 'Start Time on 2024-03-21 (CST)',
        key: 'satcst'
      },
      end: {
        key: 'eatcst'
      }
    }),
    dateTimeRangeField({
      timezone: 'America/Chicago',
      timeDate: '2023-11-08',
      start: {
        label: 'Start Time on 2023-11-08 (CDT)',
        // timeDate: '2023-11-08',  // uses the default specified above
        key: 'sat2'
      },
      end: {
        label: 'End Time on 2024-03-21 (CST)',
        timeDate: '2024-03-21',
        key: 'eat2'
      }
    }),
    dateTimeRangeField({
      timezone: this.timezone$,
      valueMode: DbxDateTimeValueMode.MINUTE_OF_DAY,
      start: {
        label: 'Start Minute Of Day',
        key: 'satm2'
      },
      end: {
        label: 'End Minute Of Day',
        key: 'eatm2'
      }
    }),
    dateTimeRangeField({
      timezone: 'America/Chicago',
      timeDate: {
        path: 'timezoneDay', // use the date from timezoneDay as the output date
        mapValue: (x) => {
          return x ? addDays(toJsDate(x as string), 1) : undefined;
        }
      },
      start: {
        label: 'Start Time (On Timezone Day + 1)',
        key: 'sat3'
      },
      end: {
        label: 'End Time (On Timezone Day + 3)',
        timeDate: {
          path: 'timezoneDay',
          mapValue: (x) => {
            return x ? addDays(toJsDate(x as string), 3) : undefined;
          }
        },
        key: 'eat3'
      }
    })
  ];

  /*


export function schoolInfoJobSettingsTimeFields() {
  return flexLayoutWrapper([schoolInfoJobSettingsStartTimeField(), schoolInfoJobSettingsEndTimeField()], {
    relative: true
  });
}

export function schoolInfoJobSettingsStartTimeField() {
  return dateTimeField({
    key: 'sat',
    label: 'Default Start Time',
    required: false,
    timeOnly: true,
    hideDateHint: true
  });
}

export function schoolInfoJobSettingsEndTimeField() {
  return dateTimeField({
    key: 'eat',
    label: 'Default End Time',
    required: false,
    timeOnly: true,
    hideDateHint: true
  });
}
  */

  readonly fixedDateRangeValue$ = of({
    tenDayFixedDateRange: dateRange({ date: addDays(new Date(), 4), type: DateRangeType.WEEK }),
    oneMonthFixedDateRange: dateRange({ date: new Date(), type: DateRangeType.WEEK, distance: 2 })
  });

  readonly fixedDateRangeFields: FormlyFieldConfig[] = [
    fixedDateRangeField({
      required: true,
      key: 'tenDayFixedDateRange',
      label: 'Fixed Date Range',
      description: 'Required. Picks a 10-day date range. Returns the date as an ISO8601DateString.',
      valueMode: DbxDateTimeValueMode.DATE_STRING,
      dateRangeInput: { type: DateRangeType.WEEKS_RANGE, distance: 1 },
      timezone: this.timezone$,
      pickerConfig: {
        limits: {
          min: 'today_start',
          max: addMonths(endOfMonth(new Date()), 1)
        }
      }
    }),
    fixedDateRangeField({
      key: 'oneMonthFixedDateRange',
      label: 'One Month Arbitrary Date Range',
      selectionMode: 'arbitrary_quick',
      description: 'Arbitrary end date up to 21 days. Limited to the first 18 days of the month. Not required. Picks all the days in the current month. Returns the date as an ISO8601DayString.',
      valueMode: DbxDateTimeValueMode.DAY_STRING,
      dateRangeInput: { type: DateRangeType.DAYS_RANGE, distance: 21 },
      timezone: this.timezone$,
      pickerConfig: {
        limits: {
          min: startOfMonth(new Date()),
          max: addDays(startOfMonth(new Date()), 18)
        }
      }
    }),
    fixedDateRangeField({
      key: 'thisMonthNormalDateRange',
      label: 'One Month Normal Date Range',
      selectionMode: 'normal',
      description: 'Normal selection. Limited to the first 18 days of the month. Not required. Returns the date as an ISO8601DayString.',
      valueMode: DbxDateTimeValueMode.DAY_STRING,
      timezone: this.timezone$,
      pickerConfig: {
        limits: {
          min: startOfMonth(new Date()),
          max: addDays(startOfMonth(new Date()), 18)
        }
      }
    }),
    fixedDateRangeField({
      key: 'maxAnyMonthNormalDateRange',
      label: 'Max Any Calendar Month Long',
      selectionMode: 'normal',
      description: 'Normal selection. Limited date range. Selection range of 1 calendar month. Not required. Returns the date as an ISO8601DayString.',
      valueMode: DbxDateTimeValueMode.DAY_STRING,
      dateRangeInput: { type: DateRangeType.CALENDAR_MONTH, distance: 1 },
      timezone: this.timezone$,
      pickerConfig: {
        limits: {
          min: addMonths(startOfMonth(new Date()), -2),
          max: addDays(startOfMonth(new Date()), 60)
        }
      }
    })
  ];

  readonly dateRangeFields: FormlyFieldConfig[] = [
    dateRangeField({}),
    dateRangeField({
      start: {
        key: 'startLimited',
        description: 'Must start on a M/T and no later than 14 days ago',
        pickerConfig: () => {
          const config: DbxDateTimePickerConfiguration = {
            limits: {
              min: addDays(startOfDay(new Date()), -14)
            },
            schedule: {
              w: `${DateCellScheduleDayCode.MONDAY}${DateCellScheduleDayCode.TUESDAY}` as DateCellScheduleEncodedWeek
            }
          };

          return of(config);
        }
      },
      end: {
        key: 'endLimited',
        description: 'Must end on a W/T/F',
        pickerConfig: () => {
          const config: DbxDateTimePickerConfiguration = {
            schedule: {
              w: `${DateCellScheduleDayCode.WEDNESDAY}${DateCellScheduleDayCode.THURSDAY}${DateCellScheduleDayCode.FRIDAY}` as DateCellScheduleEncodedWeek
            }
          };

          return of(config);
        }
      }
    })
  ];

  private _newDateValue = new BehaviorSubject<Maybe<Date>>(undefined);
  private baseDate$ = of(new Date()).pipe(delay(100));

  onAsyncDateValueChange(value: Maybe<{ date: Maybe<Date> }>): void {
    if (value?.date && !isSameDate(this._newDateValue.value, value.date)) {
      this._newDateValue.next(value.date);
    }
  }

  readonly asyncTimeFormConfig$: Observable<FormlyFieldConfig[]> = of([
    dateTimeField({
      label: 'Async Configured Date',
      key: 'date',
      timezone: this.timezone$,
      timeDate: this.baseDate$,
      pickerConfig: this.baseDate$.pipe(
        map((x) => {
          const config: DbxDateTimePickerConfiguration = {
            limits: {
              min: addHours(x, -24),
              max: addHours(x, 24)
            }
          };

          return config;
        })
      )
    })
  ]).pipe(delay(1000)); // add an artificial delay

  readonly asyncTimeFormTemplate$ = this._newDateValue.pipe(
    map((date) => {
      date = roundDownToMinute(date ?? new Date());

      if (date) {
        return { date };
      } else {
        return { date: new Date() };
      }
    })
  );

  ngOnDestroy(): void {
    this._timezone.complete();
    this._newDateValue.complete();
  }
}
