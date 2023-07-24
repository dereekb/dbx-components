import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import {
  addressField,
  addressListField,
  cityField,
  countryField,
  emailField,
  phoneField,
  nameField,
  phoneAndLabelSectionField,
  wrappedPhoneAndLabelField,
  repeatArrayField,
  stateField,
  textAreaField,
  textField,
  zipCodeField,
  phoneListField,
  dateTimeField,
  DbxDateTimeFieldTimeMode,
  toggleField,
  checkboxField,
  numberField,
  latLngTextField,
  DbxDateTimeValueMode,
  dateRangeField,
  dollarAmountField,
  DbxDateTimePickerConfiguration,
  dateTimeRangeField,
  timezoneStringField,
  fixedDateRangeField,
  numberSliderField
} from '@dereekb/dbx-form';
import { addDays, addHours, addMonths, endOfMonth, startOfDay, startOfMonth } from 'date-fns';
import { Maybe, TimezoneString, addSuffixFunction, randomBoolean } from '@dereekb/util';
import { BehaviorSubject, delay, of } from 'rxjs';
import { DateRangeType, DateScheduleDayCode, dateRange, dateTimezoneUtcNormal } from '@dereekb/date';

@Component({
  templateUrl: './value.component.html'
})
export class DocFormValueComponent {
  readonly dateValues$ = of({
    date: startOfDay(new Date()),
    dateAsString: addDays(new Date(), -6),
    dayOnly: addDays(new Date(), 6),
    dayOnlyAsString: addDays(new Date(), 12),
    dateOnlyWithLockedTimezone: dateTimezoneUtcNormal({ timezone: 'Asia/Tokyo' }).systemDateToTargetDate(startOfDay(new Date())),
    timeOnlyWithLockedTimezone: dateTimezoneUtcNormal({ timezone: 'America/New_York' }).systemDateToTargetDate(startOfDay(new Date()))
  });

  readonly textFields: FormlyFieldConfig[] = [
    //
    textField({ key: 'test', label: 'Text Field', description: 'A required text field.', placeholder: 'Placeholder', required: true, minLength: 4, maxLength: 15 }),
    textField({ key: 'transform', label: 'Transformed Text Field', description: 'Text Field With String Transform Config. Adds _ between each letter as you type.', transform: { trim: true, transform: addSuffixFunction('_') } }),
    nameField(),
    emailField(),
    cityField(),
    stateField(),
    stateField({ label: 'State With Code Input', key: 'stateAsCode', asCode: true }),
    countryField(),
    zipCodeField()
  ];

  readonly numberFields: FormlyFieldConfig[] = [
    //
    numberField({ key: 'test', label: 'Number Field', description: 'A number between 0 and 100.', placeholder: 'Placeholder', min: 0, max: 100 }),
    numberField({ key: 'steptest', label: 'Number Field With Step', description: 'Any number, but increases in steps of 5.', step: 5 }),
    numberField({ key: 'enforcedsteptest', label: 'Number Divisible by 5', description: 'Any number divisible by 5.', step: 5, enforceStep: true }),
    dollarAmountField({ key: 'dollars', label: 'dollarAmountField()', description: 'Dollar amount field.' })
  ];

  readonly numberSliderFields: FormlyFieldConfig[] = [
    //
    numberSliderField({ key: 'test', label: 'numberSliderField()', description: 'A number between 0 and 100 picked with a slider.', placeholder: 'Placeholder', min: 0, max: 100 }),
    numberSliderField({ key: 'steptest', label: 'numberSliderField() with Steps', description: 'A number between 0 and 100 picked with a slider with steps of 5.', placeholder: 'Placeholder', min: 0, max: 100, step: 5, displayWith: (x) => `S${x / 5}` }),
    numberSliderField({ key: 'steptestcustomtickinterval', label: 'numberSliderField() with Steps and Custom Tick Interval', description: 'A number between 0 and 100 picked with a slider with steps of 5 and tick interval of 5.', placeholder: 'Placeholder', min: 0, max: 100, step: 5, tickInterval: 5, invertSelectionColoring: true })
  ];

  readonly textAreaField: FormlyFieldConfig[] = [textAreaField({ key: 'test', label: 'Text Area Field', description: 'A required text area field.', placeholder: 'Placeholder', required: true })];

  readonly latLngTextField: FormlyFieldConfig[] = [latLngTextField()];

  private _timezone = new BehaviorSubject<Maybe<TimezoneString>>(undefined);

  readonly timezone$ = this._timezone.asObservable();

  readonly timezoneSelectionField: FormlyFieldConfig[] = [timezoneStringField()];

  readonly onTimezoneChange = (value: { timezone: Maybe<TimezoneString> }) => {
    this._timezone.next(value?.timezone);
  };

  readonly dateTimeFields: FormlyFieldConfig[] = [
    dateTimeField({ timezone: this.timezone$, label: 'Day Only W/ String Value', key: 'dayOnlyAsString', allDayLabel: 'On', valueMode: DbxDateTimeValueMode.DAY_STRING, description: 'This date field is for picking a day only and as an ISO8601DayString. The calendar picker is hidden and the allDayLabel has been customized to be "On".', hideDatePicker: true }),
    dateTimeField({ timezone: this.timezone$, key: 'date', required: true, description: 'This is the default date field that requires the user pick a date and time.' }),
    dateTimeField({ timezone: this.timezone$, label: 'Date With String Value', key: 'dateAsString', required: true, valueMode: DbxDateTimeValueMode.DATE_STRING, description: 'This date field returns the value as an ISO8601DateString. The date hint is also hidden.', hideDateHint: true }),
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
    dateTimeField({ label: 'Date Only In Tokyo', key: 'dateOnlyWithLockedTimezone', timeMode: DbxDateTimeFieldTimeMode.NONE, description: 'This date field picks a date and has a locked timezone.', timezone: 'Asia/Tokyo' }),
    dateTimeField({ label: 'Time Only In New York', key: 'timeOnlyWithLockedTimezone', timeOnly: true, description: 'This date field picks a time and has a locked timezone.', hideDateHint: true, timezone: 'America/New_York' }),
    dateTimeField({
      timezone: this.timezone$,
      key: 'dateWithASchedule',
      required: true,
      description: 'This date is limited to specific days specified by a schedule of M/W/F and the next 7 days from today. A minimum of today and a maximum of 14 days from now.',
      getConfigObs: () => {
        const config: DbxDateTimePickerConfiguration = {
          limits: {
            min: startOfDay(new Date()),
            max: addDays(new Date(), 14)
          },
          schedule: {
            w: `${DateScheduleDayCode.MONDAY}${DateScheduleDayCode.WEDNESDAY}${DateScheduleDayCode.FRIDAY}`,
            d: [0, 1, 2, 3, 4, 5, 6] // next 7 days
          }
        };

        return of(config);
      }
    })
  ];

  readonly dateTimeRangeValues$ = of({
    sat: addHours(startOfDay(new Date()), 8),
    eat: addHours(startOfDay(new Date()), 16)
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
    })
  ];

  readonly dateRangeFields: FormlyFieldConfig[] = [
    dateRangeField({}),
    dateRangeField({
      start: {
        key: 'startLimited',
        description: 'Must start on a M/T and no later than 14 days ago',
        getConfigObs: () => {
          const config: DbxDateTimePickerConfiguration = {
            limits: {
              min: addDays(startOfDay(new Date()), -14)
            },
            schedule: {
              w: `${DateScheduleDayCode.MONDAY}${DateScheduleDayCode.TUESDAY}`
            }
          };

          return of(config);
        }
      },
      end: {
        key: 'endLimited',
        description: 'Must end on a W/T/F',
        getConfigObs: () => {
          const config: DbxDateTimePickerConfiguration = {
            schedule: {
              w: `${DateScheduleDayCode.WEDNESDAY}${DateScheduleDayCode.THURSDAY}${DateScheduleDayCode.FRIDAY}`
            }
          };

          return of(config);
        }
      }
    })
  ];

  readonly addressFields: FormlyFieldConfig[] = [
    //
    addressField(),
    addressField({ key: 'slim', hint: 'Line 1 and country are omitted.', stateField: { asCode: true }, includeLine2: false, includeCountry: false }),
    addressListField()
  ];

  readonly toggleField: FormlyFieldConfig[] = [
    toggleField({
      key: 'toggle',
      label: 'Toggle Me',
      description: 'this is a toggle field'
    })
  ];

  readonly checkboxField: FormlyFieldConfig[] = [
    checkboxField({
      key: 'checkbox',
      label: 'Check Me',
      description: 'this is a checkbox field'
    })
  ];

  readonly repeatArrayValue = {
    test2: [
      {
        name: 'hello',
        disable: false
      },
      {
        name: 'start with disable=true',
        disable: true
      }
    ]
  };

  readonly repeatArrayFields: FormlyFieldConfig[] = [
    repeatArrayField({
      key: 'test',
      label: 'Test Field',
      description: 'This is a generic repeat field. It is configured with custom add/remove text, and a max of 2 items.',
      addText: 'Add Test Field',
      removeText: 'Remove Test Field',
      repeatFieldGroup: [nameField(), emailField(), phoneAndLabelSectionField(), addressListField()],
      maxLength: 2
    }),
    repeatArrayField<{ name: string; disable: boolean }>({
      key: 'test2',
      label: 'Field With Add and Remove Diabled Via Field',
      description: 'Shows the remove button being disabled when a value is a certain value, and shows the duplicate button.',
      duplicateText: 'Make Copy',
      repeatFieldGroup: [
        nameField(),
        toggleField({
          key: 'disable',
          label: 'Disable Remove'
        })
      ],
      addTemplate: (i) => ({ name: `New Item ${i}`, disable: randomBoolean() }),
      disableRearrange: true,
      allowAdd: true,
      allowDuplicate: true,
      allowRemove: ({ i, value }) => !(value as { disable: boolean })?.disable,
      labelForField: ({ value }) => (value as { name: string })?.name,
      addDuplicateToEnd: true
    })
  ];

  readonly phoneFields: FormlyFieldConfig[] = [
    phoneField(),
    wrappedPhoneAndLabelField({
      phoneField: {
        key: 'labeledPhoneKey'
      }
    }),
    phoneAndLabelSectionField({
      key: 'section'
    })
  ];

  readonly phoneListField: FormlyFieldConfig[] = [phoneListField()];
}
