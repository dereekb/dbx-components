import { type Maybe, type ReadableTimeString, type ArrayOrValue, type ISO8601DateString, asArray, filterMaybeArrayValues, type DecisionFunction, type Milliseconds, type TimezoneString, type LogicalDate, type DateOrDayString, isISO8601DayStringStart, type MapFunction, mapIdentityFunction, MinuteOfDay, UnixDateTimeNumber, ISO8601DayString } from '@dereekb/util';
import { dateFromLogicalDate, DateTimeMinuteConfig, DateTimeMinuteInstance, guessCurrentTimezone, readableTimeStringToDate, toLocalReadableTimeString, utcDayForDate, safeToJsDate, findMinDate, findMaxDate, isSameDateHoursAndMinutes, getTimezoneAbbreviation, isSameDateDay, dateTimezoneUtcNormal, DateTimezoneUtcNormalInstance, toJsDayDate, isSameDate, dateTimeMinuteWholeDayDecisionFunction, dateTimeMinuteDecisionFunction } from '@dereekb/date';
import { switchMap, shareReplay, map, startWith, tap, first, distinctUntilChanged, debounceTime, throttleTime, BehaviorSubject, Observable, combineLatest, Subject, merge, interval, of, combineLatestWith, filter, skip } from 'rxjs';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AbstractControl, FormControl, Validators, FormGroup, ValidationErrors, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FieldType } from '@ngx-formly/material';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { addMinutes, startOfDay, addDays } from 'date-fns';
import { asObservableFromGetter, filterMaybe, ObservableOrValueGetter, skipFirstMaybe, SubscriptionObject, switchMapMaybeDefault, switchMapFilterMaybe } from '@dereekb/rxjs';
import { DateTimePreset, DateTimePresetConfiguration, dateTimePreset } from './datetime';
import { DbxDateTimeFieldMenuPresetsService } from './datetime.field.service';
import { DbxDateTimeValueMode, dbxDateTimeInputValueParseFactory, dbxDateTimeIsSameDateTimeFieldValue, dbxDateTimeOutputValueFactory } from './date.value';
import { FormControlPath, streamValueFromControl } from '../../../../form/form.angular.util';
import { toggleDisableFormControl } from '../../../../form/form';
import { ErrorStateMatcher } from '@angular/material/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatError, MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { DateDistancePipe, GetValuePipe, TimeDistancePipe } from '@dereekb/dbx-core';
import { MatDividerModule } from '@angular/material/divider';

export enum DbxDateTimeFieldTimeMode {
  /**
   * Time is required.
   */
  REQUIRED = 'required',
  /**
   * Time is optional.
   */
  OPTIONAL = 'optional',
  /**
   * Time is permenantly off.
   */
  NONE = 'none'
}

export type DbxDateTimePickerConfiguration = Omit<DateTimeMinuteConfig, 'date'>;

export type DbxDateTimeFieldSyncType = 'before' | 'after';

export interface DbxDateTimeFieldSyncField {
  /**
   * Field key/path to sync with/against.
   */
  readonly syncWith: string;
  /**
   * How to sync against the other field.
   */
  readonly syncType: DbxDateTimeFieldSyncType;
}

/**
 * Configuration for the time date field that has a reference and optional map function to map the value.
 */
export interface DbxDateTimeFieldTimeDateConfig<I = unknown> {
  readonly path: FormControlPath;
  readonly mapValue?: MapFunction<I, Maybe<DateOrDayString>>;
}

export function isDbxDateTimeFieldTimeDateConfig(input: unknown): input is DbxDateTimeFieldTimeDateConfig {
  return input != null && typeof input === 'object' && typeof (input as DbxDateTimeFieldTimeDateConfig).path === 'string';
}

export interface DbxDateTimeFieldProps extends FormlyFieldProps {
  /**
   * Custom date label.
   *
   * Defaults to Date
   */
  readonly dateLabel?: string;

  /**
   * Custom time label.
   *
   * Defaults to Time
   */
  readonly timeLabel?: string;

  /**
   * Label to use for the date hint for "All Day". Defaults to "All Day".
   */
  readonly allDayLabel?: string;

  /**
   * Label to use for the date hint for "At". Defaults to "At".
   */
  readonly atTimeLabel?: string;

  /**
   * Value mode.
   *
   * Defaults to DATE
   */
  readonly valueMode?: DbxDateTimeValueMode;

  /**
   * Whether or not the date is hidden, and automatically uses today/input date.
   */
  readonly timeOnly?: boolean;

  /**
   * Only applicable when timeOnly is false.
   *
   * Whether or not to always show the date input even when there is only a single date that can be selected.
   *
   * Defaults to true.
   */
  readonly alwaysShowDateInput?: boolean;

  /**
   * Whether or not to autofill the date when time is picked.
   *
   * Defaults to false.
   */
  readonly autofillDateWhenTimeIsPicked?: boolean;

  /**
   * Whether or not the time can be added/removed optionally.
   *
   * This is ignored if timeOnly is specified.
   */
  readonly timeMode?: DbxDateTimeFieldTimeMode;

  /**
   * Other form control for enabling/disabling whether or not it is a full day.
   *
   * This field is only used if time is optional.
   *
   * When time is off, the field is set to true.
   */
  readonly fullDayFieldName?: string;

  /**
   * Whether or not to pass the date value as a UTC date, or a date in the current timezone.
   */
  readonly fullDayInUTC?: boolean;

  /**
   * Whether or not ot hide the date hint info content.
   *
   * False by default
   */
  readonly hideDateHint?: boolean;

  /**
   * Whether or not to hide the date/calendar picker.
   */
  readonly hideDatePicker?: boolean;

  /**
   * Custom picker configuration
   */
  readonly pickerConfig?: ObservableOrValueGetter<DbxDateTimePickerConfiguration>;

  /**
   * Used for syncing with one or more fields with a Date value.
   */
  readonly getSyncFieldsObs?: () => Observable<ArrayOrValue<DbxDateTimeFieldSyncField>>;

  /**
   * (Optional) The input timezone to default to.
   *
   * Ignored if fullDayInUTC is true.
   */
  readonly timezone?: Maybe<ObservableOrValueGetter<Maybe<TimezoneString>>>;

  /**
   * (Optional) The date to apply the time to.
   *
   * The timezone abbrviation will also use this date when using the time-only mode.
   */
  readonly timeDate?: Maybe<ObservableOrValueGetter<Maybe<DbxDateTimeFieldTimeDateConfig | FormControlPath | DateOrDayString>>>;

  /**
   * Whether or not to display the timezone. True by default.
   */
  readonly showTimezone?: Maybe<boolean>;

  /**
   * Custom presets to show in the dropdown.
   */
  readonly presets?: ObservableOrValueGetter<DateTimePresetConfiguration[]>;

  /**
   * The time in ms to prevent output from going out when the input value changes.
   */
  readonly inputOutputDebounceTime?: Milliseconds;

  /**
   * Whether or not to display the clear date button. True by default.
   */
  readonly showClearButton?: Maybe<boolean>;

  /**
   * The number of minutes to add/subtract when using the arrow keys.
   */
  readonly minuteStep?: Maybe<number>;
}

export interface DbxDateTimeFieldSyncParsedField extends Pick<DbxDateTimeFieldSyncField, 'syncType'> {
  readonly control: AbstractControl<Maybe<Date | ISO8601DateString>>;
}

export function syncConfigValueObs(parseConfigsObs: Observable<DbxDateTimeFieldSyncParsedField[]>, type: DbxDateTimeFieldSyncType): Observable<Date | null> {
  return parseConfigsObs.pipe(
    switchMap((x) => {
      const config = x.find((y) => y.syncType === type);
      let result: Observable<Date | null>;

      if (config) {
        const { control } = config;
        result = control.valueChanges.pipe(
          startWith(control.value),
          map((x) => safeToJsDate(x) ?? null)
        );
      } else {
        result = of(null);
      }

      return result;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );
}

const TIME_OUTPUT_THROTTLE_TIME: Milliseconds = 10;

/**
 * Error code used when the selected date is not in the schedule.
 */
export const DBX_DATE_TIME_FIELD_DATE_NOT_IN_SCHEDULE_ERROR = 'dateTimeFieldDateNotInSchedule';

/**
 * Error code used when the selected time/time input is not in the limited range.
 */
export const DBX_DATE_TIME_FIELD_TIME_NOT_IN_RANGE_ERROR = 'dateTimeFieldTimeNotInRange';

@Component({
  templateUrl: 'datetime.field.component.html',
  imports: [FlexLayoutModule, NgTemplateOutlet, MatButtonModule, NgClass, MatError, MatFormFieldModule, MatDatepickerModule, MatInputModule, FormsModule, ReactiveFormsModule, MatIconModule, MatMenuModule, MatFormFieldModule, GetValuePipe, DatePipe, DateDistancePipe, TimeDistancePipe, MatDividerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxDateTimeFieldComponent extends FieldType<FieldTypeConfig<DbxDateTimeFieldProps>> implements OnInit, OnDestroy {
  private readonly dbxDateTimeFieldConfigService = inject(DbxDateTimeFieldMenuPresetsService);

  private readonly _sub = new SubscriptionObject();
  private readonly _valueSub = new SubscriptionObject();
  private readonly _autoFillDateSync = new SubscriptionObject();

  private readonly _config = new BehaviorSubject<Maybe<Observable<DbxDateTimePickerConfiguration>>>(undefined);
  readonly latestConfig$ = this._config.pipe(switchMapMaybeDefault(), distinctUntilChanged(), shareReplay(1));

  private readonly _syncConfigObs = new BehaviorSubject<Maybe<Observable<ArrayOrValue<DbxDateTimeFieldSyncField>>>>(undefined);

  private readonly _defaultTimezone = new BehaviorSubject<Maybe<Observable<Maybe<TimezoneString>>>>(undefined);
  private readonly _timeDate = new BehaviorSubject<Maybe<Observable<Maybe<DbxDateTimeFieldTimeDateConfig | FormControlPath | DateOrDayString>>>>(undefined);
  private readonly _presets = new BehaviorSubject<Observable<DateTimePresetConfiguration[]>>(of([]));

  /**
   * Alternative/backup full day control if not defined in the Formly form.
   */
  private readonly _fullDayInputCtrl = new FormControl(false);
  private readonly _fullDayControlObs = new BehaviorSubject<Maybe<AbstractControl<boolean>>>(undefined);
  readonly fullDayControl$ = this._fullDayControlObs.pipe(filterMaybe());

  private readonly _offset = new BehaviorSubject<number>(0);
  private readonly _formControlObs = new BehaviorSubject<Maybe<AbstractControl<Maybe<Date>>>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  private readonly _cleared = new Subject<void>();
  private readonly _updateTime = new Subject<void>();

  private readonly _resyncTimeInputSub = new SubscriptionObject();
  private readonly _resyncTimeInput = new Subject<void>();

  readonly timeErrorStateMatcher: ErrorStateMatcher = {
    isErrorState: (control: AbstractControl | null, form) => {
      if (control) {
        return (control.invalid && (control.dirty || control.touched)) || this.errorStateMatcher.isErrorState(this.formControl, form);
      } else {
        return false;
      }
    }
  };

  readonly resyncTimeInput$ = this._resyncTimeInput.pipe(debounceTime(200), shareReplay(1));

  private readonly _configUpdateTimeSync = new SubscriptionObject(
    this.latestConfig$.pipe(skip(1)).subscribe((x) => {
      this._updateTime.next();
    })
  );

  readonly timezone$: Observable<Maybe<TimezoneString>> = this._defaultTimezone.pipe(switchMapMaybeDefault(), distinctUntilChanged()).pipe(
    map((defaultTimezone) => {
      return defaultTimezone ?? guessCurrentTimezone();
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly timezoneInstance$: Observable<Maybe<DateTimezoneUtcNormalInstance>> = this.timezone$.pipe(
    map((timezone) => (timezone ? dateTimezoneUtcNormal({ timezone }) : undefined)),
    shareReplay(1)
  );

  readonly timeDate$: Observable<Maybe<Date>> = this._timeDate.pipe(
    switchMapMaybeDefault(),
    switchMap((x) => {
      let obs: Observable<Maybe<Date>>;

      if (x) {
        // if the string is not a date string, then treat it as a path
        if ((typeof x === 'string' && !isISO8601DayStringStart(x)) || isDbxDateTimeFieldTimeDateConfig(x)) {
          const { path, mapValue }: DbxDateTimeFieldTimeDateConfig = typeof x === 'string' ? { path: x } : x;
          obs =
            streamValueFromControl<DateOrDayString>(this.form, path)?.pipe(
              map(mapValue ?? mapIdentityFunction()),
              map((x) => (x ? toJsDayDate(x) : undefined))
            ) ?? of(undefined);
        } else {
          obs = of(toJsDayDate(x));
        }
      } else {
        obs = of(undefined);
      }

      return obs;
    }),
    distinctUntilChanged(isSameDateDay),
    shareReplay(1)
  );

  readonly valueInSystemTimezone$: Observable<Maybe<Date>> = this.formControl$.pipe(
    map((control) => control.valueChanges.pipe(startWith<Maybe<Date | ISO8601DayString | MinuteOfDay | UnixDateTimeNumber>>(control.value), shareReplay(1))),
    combineLatestWith(this.timezoneInstance$),
    switchMap(([x, timezoneInstance]) => {
      return x.pipe(map(dbxDateTimeInputValueParseFactory(this.valueMode, timezoneInstance)));
    }),
    throttleTime(20, undefined, { leading: true, trailing: true }), // throttle incoming values and timezone changes
    distinctUntilChanged(isSameDateHoursAndMinutes),
    shareReplay(1)
  );

  readonly refreshInteral$ = interval(10 * 1000);

  /**
   * Used to trigger/display visual updates (specifically on timeDistance, etc.).
   */
  readonly displayValue$ = this.refreshInteral$.pipe(
    // every 10 seconds, refresh w/interval
    startWith(0),
    map(() => new Date().getMinutes()),
    distinctUntilChanged(),
    switchMap(() => this.valueInSystemTimezone$),
    shareReplay(1)
  );

  readonly timeString$: Observable<ReadableTimeString | ''> = this.valueInSystemTimezone$.pipe(
    map((x) => (x ? toLocalReadableTimeString(x) : '')),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly dateInputCtrl = new FormControl<Maybe<Date>>(null, {
    validators: []
  });

  readonly timeInputCtrl = new FormControl<Maybe<ReadableTimeString>>(null, {
    validators: [Validators.pattern(/^(now)$|^([0-9]|(0[0-9])|(1[0-9])|(2[0-3]))(:)?([0-5][0-9])?(\s)?([apAP][Mm])?(\\s)*$/)]
  });

  get dateLabel(): string {
    return this.props.dateLabel ?? 'Date';
  }

  get timeLabel(): string {
    return this.props.timeLabel ?? 'Time';
  }

  get allDayLabel(): string {
    return this.props.allDayLabel ?? 'All Day';
  }

  get atTimeLabel(): string {
    return this.props.atTimeLabel ?? 'At';
  }

  get dateOnly(): boolean {
    return this.timeMode === DbxDateTimeFieldTimeMode.NONE;
  }

  get dateTimeField(): DbxDateTimeFieldProps {
    return this.field.props;
  }

  get timeOnly(): Maybe<boolean> {
    const timeValuesOnly = this.valueMode === DbxDateTimeValueMode.MINUTE_OF_DAY;

    if (timeValuesOnly) {
      return true;
    } else {
      return this.dateTimeField.timeOnly;
    }
  }

  get alwaysShowDateInput(): boolean {
    return this.props.alwaysShowDateInput ?? true;
  }

  get autofillDateWhenTimeIsPicked(): boolean {
    return this.props.autofillDateWhenTimeIsPicked ?? this.alwaysShowDateInput === false;
  }

  get showDateInput(): boolean {
    return !this.timeOnly;
  }

  get valueMode(): DbxDateTimeValueMode {
    return this.field.props.valueMode ?? DbxDateTimeValueMode.DATE;
  }

  get timeMode(): DbxDateTimeFieldTimeMode {
    const dateValuesOnly = this.valueMode === DbxDateTimeValueMode.DAY_STRING;

    if (dateValuesOnly) {
      return DbxDateTimeFieldTimeMode.NONE;
    } else {
      return this.timeOnly ? DbxDateTimeFieldTimeMode.REQUIRED : (this.dateTimeField.timeMode ?? DbxDateTimeFieldTimeMode.REQUIRED);
    }
  }

  get isDateRequired(): boolean {
    return this.props.required ?? false;
  }

  get isTimeRequired(): boolean {
    return this.isDateRequired && this.timeMode === DbxDateTimeFieldTimeMode.REQUIRED;
  }

  get description(): Maybe<string> {
    return this.field.props.description;
  }

  get hideDateHint(): boolean {
    return this.field.props.hideDateHint ?? false;
  }

  get hideDatePicker(): boolean {
    return this.field.props.hideDatePicker ?? false;
  }

  get timezone() {
    return this.field.props.timezone;
  }

  get timeDate() {
    return this.field.props.timeDate;
  }

  get showTimezone() {
    return this.field.props.showTimezone ?? true;
  }

  get presets() {
    return this.field.props.presets;
  }

  get showClearButton() {
    return this.field.props.showClearButton;
  }

  get minuteStep() {
    return this.field.props.minuteStep ?? this.field.props.step ?? 5;
  }

  readonly fullDay$: Observable<boolean> = this.fullDayControl$.pipe(
    switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly showTimeInput$: Observable<boolean> = this.fullDay$.pipe(map((x) => !x && this.timeMode !== DbxDateTimeFieldTimeMode.NONE));

  readonly showAddTime$ = this.showTimeInput$.pipe(
    map((x) => !x && this.timeMode === DbxDateTimeFieldTimeMode.OPTIONAL),
    shareReplay(1)
  );

  readonly currentDate$ = this.dateInputCtrl.valueChanges.pipe(startWith(this.dateInputCtrl.value), shareReplay(1));
  readonly date$ = this.currentDate$.pipe(filterMaybe(), shareReplay(1));

  readonly timezoneAbbreviation$ = combineLatest([this.currentDate$, this.timezone$, this.timeDate$]).pipe(
    map(([date, timezone, timeDate]) => getTimezoneAbbreviation(timezone, timeDate ?? date ?? new Date())),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly dateValue$: Observable<Maybe<Date>> = merge(this.date$, this.valueInSystemTimezone$.pipe(skipFirstMaybe())).pipe(
    map((x: Maybe<Date>) => (x ? startOfDay(x) : null)),
    distinctUntilChanged<Maybe<Date>>(isSameDateDay),
    shareReplay(1)
  );

  readonly timeInput$: Observable<ReadableTimeString> = this._updateTime.pipe(
    debounceTime(5),
    map(() => this.timeInputCtrl.value || ''),
    distinctUntilChanged()
  );

  readonly syncConfigObs$ = this._syncConfigObs.pipe(switchMapMaybeDefault(), shareReplay(1));

  readonly parsedSyncConfigs$: Observable<DbxDateTimeFieldSyncParsedField[]> = this.syncConfigObs$.pipe(
    map((x) => {
      let parsed: DbxDateTimeFieldSyncParsedField[];

      if (x) {
        parsed = filterMaybeArrayValues(
          asArray(x).map((y) => {
            const control = this.form.get(y.syncWith);

            if (control) {
              return {
                control,
                ...y
              };
            } else {
              return undefined;
            }
          })
        );
      } else {
        parsed = [];
      }

      return parsed;
    }),
    shareReplay(1)
  );

  readonly syncConfigBeforeValue$: Observable<Date | null> = syncConfigValueObs(this.parsedSyncConfigs$, 'before');
  readonly syncConfigAfterValue$: Observable<Date | null> = syncConfigValueObs(this.parsedSyncConfigs$, 'after');

  readonly isTimeCleared$ = combineLatest([this.currentDate$, this._timeDate.pipe(startWith(null))]).pipe(
    switchMap(([date, time]) => {
      const isTimeCleared = Boolean(!date && !time);
      return this._cleared.pipe(
        map(() => true),
        startWith(isTimeCleared)
      );
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  protected readonly _rawDateTimeDateValue$: Observable<Maybe<Date>> = this._config.pipe(
    first(),
    switchMap(() => (this.timeOnly ? of(null) : this.dateValue$))
  );
  protected readonly _rawDateTimeTimeValue$: Observable<Maybe<ReadableTimeString>> = this.timeInput$.pipe(startWith(null));

  readonly rawDateTime$: Observable<Maybe<Date>> = combineLatest([this._rawDateTimeDateValue$, this._rawDateTimeTimeValue$, this.fullDay$, this.timeDate$, this.isTimeCleared$]).pipe(
    map(([date, timeString, fullDay, timeDate, isTimeCleared]) => {
      let result: Maybe<Date>;

      if (!isTimeCleared) {
        if (!date || this.timeOnly) {
          date = timeDate ?? new Date(); // use the time date, or default to the current day
        }

        if (date) {
          if (fullDay) {
            if (this.dateTimeField.fullDayInUTC) {
              result = utcDayForDate(date);
            } else {
              result = startOfDay(date);
            }
          } else if (timeString) {
            result =
              readableTimeStringToDate(timeString, {
                date,
                useSystemTimezone: true
              }) ?? date;
          } else if (!this.timeOnly) {
            if (this.timeMode !== DbxDateTimeFieldTimeMode.REQUIRED) {
              // only autofill the date if the time is marked as required (and the time string is empty)
              result = date;
            }
          }
        }
      }

      return result;
    }),
    distinctUntilChanged(isSameDateHoursAndMinutes),
    shareReplay(1)
  );

  readonly dateTimePickerConfig$: Observable<Maybe<DbxDateTimePickerConfiguration>> = combineLatest([this._config.pipe(switchMapFilterMaybe()), this.syncConfigBeforeValue$, this.syncConfigAfterValue$]).pipe(
    map(([x, dateInputMin, dateInputMax]) => {
      let result: Maybe<DbxDateTimePickerConfiguration> = x;

      if (dateInputMin != null || dateInputMax != null) {
        const { min: limitMin, max: limitMax } = x?.limits ?? {};
        const min = findMinDate([dateInputMin, dateFromLogicalDate(limitMin)]);
        const max = findMaxDate([dateInputMax, dateFromLogicalDate(limitMax)]);

        result = {
          ...x,
          limits: {
            ...x?.limits,
            min,
            max
          }
        };
      }

      return result;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly dateInputMin$: Observable<Date | null> = this.dateTimePickerConfig$.pipe(
    map((x) => (x?.limits?.min ?? null) as Date | null),
    distinctUntilChanged<Date | null>(isSameDate),
    shareReplay(1)
  );

  readonly dateInputMax$: Observable<Date | null> = this.dateTimePickerConfig$.pipe(
    map((x) => (x?.limits?.max ?? null) as Date | null),
    distinctUntilChanged<Date | null>(isSameDate),
    shareReplay(1)
  );

  /**
   * Whether or not there is a limited min/max date range applied/available.
   */
  readonly hasRestrictedDateRange$: Observable<boolean> = combineLatest([this.dateInputMin$, this.dateInputMax$]).pipe(
    map(([a, b]) => Boolean(a || b)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly dateMinAndMaxIsSameDay$: Observable<boolean> = combineLatest([this.dateInputMin$, this.dateInputMax$]).pipe(
    map(([a, b]) => Boolean(a && b) && isSameDateDay(a, b)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly pickerFilter$: Observable<DecisionFunction<Date | null>> = this.dateTimePickerConfig$.pipe(
    distinctUntilChanged(),
    map((x) => {
      if (x) {
        const filter = dateTimeMinuteWholeDayDecisionFunction(x, false);
        return (x: Date | null) => (x != null ? filter(x) : true);
      } else {
        return () => true;
      }
    }),
    shareReplay(1)
  );

  readonly defaultPickerFilter: DecisionFunction<Date | null> = () => true;

  readonly timeOutput$: Observable<Maybe<Date>> = combineLatest([this.rawDateTime$, this._offset, this.dateTimePickerConfig$]).pipe(
    throttleTime(TIME_OUTPUT_THROTTLE_TIME, undefined, { leading: false, trailing: true }),
    distinctUntilChanged((current, next) => current[0] === next[0] && next[1] === 0 && current[2] === next[2]),
    tap(([, stepsOffset]) => (stepsOffset ? this._offset.next(0) : 0)),
    map(([date, stepsOffset, config]) => {
      if (date != null) {
        const instance = new DateTimeMinuteInstance({
          date,
          ...config,
          roundDownToMinute: true
        });

        // only clamp when the steps offset is set
        if (stepsOffset) {
          date = instance.clamp(date);

          const minutes = stepsOffset * this.minuteStep;

          if (minutes != 0) {
            date = addMinutes(date, minutes);
            date = instance.clamp(date); // clamp the date again
          }
        }
      }

      return date;
    }),
    distinctUntilChanged(isSameDateHoursAndMinutes),
    shareReplay(1)
  );

  readonly dateTimePickerInstance$ = this.dateTimePickerConfig$.pipe(
    map((config) => {
      return new DateTimeMinuteInstance({
        ...config,
        roundDownToMinute: true
      });
    }),
    shareReplay(1)
  );

  readonly hasEmptyDisplayValue$ = this.displayValue$.pipe(
    map((x) => !x),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly allPresets$: Observable<DateTimePreset[]> = this._presets.pipe(
    switchMapFilterMaybe(),
    map((x: DateTimePresetConfiguration[]) => x.map(dateTimePreset)),
    shareReplay(1)
  );

  readonly _presetsPickerFilter$ = this.dateTimePickerConfig$.pipe(
    map((config) => {
      if (config) {
        const filter = dateTimeMinuteDecisionFunction(config); // filter that the date must be in the given range
        return (x: Date | null) => (x != null ? filter(x) : true);
      } else {
        return () => true;
      }
    })
  );

  readonly presets$: Observable<DateTimePreset[]> = combineLatest([this.allPresets$, this.fullDay$]).pipe(
    switchMap(([x, fullDay]) => {
      let result: Observable<DateTimePreset[]>;

      if (this.timeOnly) {
        result = of(x); // do not filter based on the date
      } else if (fullDay) {
        result = of([]);
      } else {
        result = combineLatest([this._rawDateTimeDateValue$.pipe(throttleTime(1000, undefined, { leading: true, trailing: true })), this._presetsPickerFilter$]).pipe(
          map(([selectedDate, isAllowedDate]) => {
            const allowedPresets: DateTimePreset[] = [];

            if (selectedDate) {
              // iterate each preset and check if it is allowed
              x.forEach((preset) => {
                const value = preset.value();
                let presetDate: Maybe<Date>;

                if (value.logicalDate) {
                  presetDate = dateFromLogicalDate(value.logicalDate);
                } else if (value.timeString) {
                  presetDate = readableTimeStringToDate(value.timeString, {
                    date: selectedDate,
                    useSystemTimezone: true
                  });
                }

                // the computed date should be within the allowed range
                if (presetDate && isAllowedDate(presetDate)) {
                  allowedPresets.push(preset);
                }
              });
            }

            return allowedPresets;
          })
        );
      }

      return result;
    }),
    shareReplay(1)
  );

  readonly showClearButton$: Observable<boolean> = this.hasEmptyDisplayValue$.pipe(
    map((x) => Boolean(this.showClearButton && !x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly canAutofillDateWithOnlyAvailableDate$: Observable<boolean> = this.dateMinAndMaxIsSameDay$;

  readonly showDateInput$: Observable<boolean> = this.dateMinAndMaxIsSameDay$.pipe(
    map((dateMinAndMaxIsSameDay) => {
      return this.showDateInput && (this.alwaysShowDateInput || !dateMinAndMaxIsSameDay);
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentErrorMessage$ = this.formControl$.pipe(
    switchMap((formControl) =>
      formControl.statusChanges.pipe(
        filter((x) => x === 'INVALID' || x === 'VALID'),
        map((x) => {
          let currentErrorMessage: string | undefined;

          if (x === 'INVALID') {
            if (this.formControl.hasError('required')) {
              currentErrorMessage = 'Date is required';
            } else if (this.formControl.hasError(DBX_DATE_TIME_FIELD_DATE_NOT_IN_SCHEDULE_ERROR)) {
              currentErrorMessage = 'Date does not fall on an available dates in schedule.';
            } else if (this.formControl.hasError(DBX_DATE_TIME_FIELD_TIME_NOT_IN_RANGE_ERROR)) {
              currentErrorMessage = 'Time is not valid for the given date.';
            } else {
              currentErrorMessage = 'The given date and time is invalid.';
            }
          }

          return currentErrorMessage;
        })
      )
    ),
    startWith(undefined),
    shareReplay(1)
  );

  readonly hasError$ = this.currentErrorMessage$.pipe(
    map((x) => Boolean(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly dateValueSignal = toSignal(this.dateValue$);
  readonly displayValueSignal = toSignal(this.displayValue$);
  readonly pickerFilterSignal = toSignal(this.pickerFilter$, { initialValue: this.defaultPickerFilter });
  readonly dateInputMinSignal = toSignal(this.dateInputMin$, { initialValue: null });
  readonly dateInputMaxSignal = toSignal(this.dateInputMax$, { initialValue: null });
  readonly showDateInputSignal = toSignal(this.showDateInput$);
  readonly showTimeInputSignal = toSignal(this.showTimeInput$);
  readonly showAddTimeSignal = toSignal(this.showAddTime$);
  readonly fullDaySignal = toSignal(this.fullDay$);
  readonly timezoneAbbreviationSignal = toSignal(this.timezoneAbbreviation$);
  readonly hasEmptyDisplayValueSignal = toSignal(this.hasEmptyDisplayValue$);
  readonly currentErrorMessageSignal = toSignal(this.currentErrorMessage$);
  readonly showClearButtonSignal = toSignal(this.showClearButton$);
  readonly presetsSignal = toSignal(this.presets$);
  readonly hasErrorSignal = toSignal(this.hasError$);

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);

    const inputPickerConfig = this.dateTimeField.pickerConfig;
    this._config.next(inputPickerConfig ? asObservableFromGetter(inputPickerConfig) : of({}));
    this._syncConfigObs.next(this.dateTimeField.getSyncFieldsObs?.());

    this._sub.subscription = this.valueInSystemTimezone$
      .pipe(
        combineLatestWith(this.timezoneInstance$.pipe(map((timezoneInstance) => dbxDateTimeOutputValueFactory(this.valueMode, timezoneInstance)))),
        throttleTime(TIME_OUTPUT_THROTTLE_TIME, undefined, { leading: false, trailing: true }),
        switchMap(([currentValue, valueFactory]) => {
          return this.timeOutput$.pipe(
            throttleTime(TIME_OUTPUT_THROTTLE_TIME * 2, undefined, { leading: false, trailing: true }),
            skipFirstMaybe(),
            distinctUntilChanged(isSameDateHoursAndMinutes),
            map((x) => valueFactory(x)),
            filter((x) => !dbxDateTimeIsSameDateTimeFieldValue(x, currentValue))
          );
        })
      )
      .subscribe((value) => {
        this.formControl.setValue(value);
        this.formControl.markAsDirty();
        this.formControl.markAsTouched();
      });

    let hasSetMidnightFromInput = false;

    /*
    this._valueSub.subscription = this.timeString$.subscribe((x) => {
      this.setTime(x);
    });
    */

    if (this.autofillDateWhenTimeIsPicked) {
      this._autoFillDateSync.subscription = this.canAutofillDateWithOnlyAvailableDate$
        .pipe(
          switchMap((canAutofill) => {
            if (canAutofill) {
              // when the time updates the first time, set the current min date
              return this._updateTime.pipe(
                debounceTime(200),
                switchMap((x) => this.dateInputMin$),
                filterMaybe()
              );
            } else {
              return of(null); // don't show anything
            }
          })
        )
        .subscribe((autoDate) => {
          if (autoDate != null) {
            this.dateInputCtrl.setValue(autoDate);
          }
        });
    }

    this._valueSub.subscription = this.valueInSystemTimezone$
      .pipe(
        map((x) => (x ? isSameDate(x, startOfDay(x)) : false)),
        distinctUntilChanged(),
        switchMap((isInputValueAtMidnight) => {
          hasSetMidnightFromInput = false;
          return this.timeString$.pipe(
            // skip(1),
            map((timeString) => [timeString, isInputValueAtMidnight] as [string, boolean])
          );
        })
      )
      .subscribe(([x, isInputValueAtMidnight]) => {
        // Skip events where the timeInput value is cleared, unless the input value is at midnight and we've already processed it being at midnight
        if (!this.timeInputCtrl.value && x === '12:00AM' && (!isInputValueAtMidnight || (isInputValueAtMidnight && hasSetMidnightFromInput))) {
          return;
        }

        // update the has set flag
        if (x === '12:00AM' && isInputValueAtMidnight) {
          hasSetMidnightFromInput = true;
        }

        this.setTime(x);
      });

    // Set default timezone if provided.
    if (this.timezone && !this.dateTimeField.fullDayInUTC) {
      this._defaultTimezone.next(asObservableFromGetter(this.timezone));
    }

    this._timeDate.next(asObservableFromGetter(this.timeDate));

    // Watch for disabled changes so we can propogate them properly.
    this.formControl.registerOnDisabledChange((isDisabled) => {
      toggleDisableFormControl(this.dateInputCtrl, isDisabled);
      toggleDisableFormControl(this.timeInputCtrl, isDisabled);
    });

    const isFullDayField = this.dateTimeField.fullDayFieldName;
    let fullDayFieldCtrl: Maybe<AbstractControl>;

    if (isFullDayField) {
      fullDayFieldCtrl = this.form.get(isFullDayField);
    }

    if (!fullDayFieldCtrl) {
      const isFullDay = this.timeMode === DbxDateTimeFieldTimeMode.NONE;
      this._fullDayInputCtrl.setValue(isFullDay);

      // Set the control in the form too if the name is defined.
      if (isFullDayField) {
        (this.form as FormGroup).addControl(isFullDayField, this._fullDayInputCtrl);
      }

      fullDayFieldCtrl = this._fullDayInputCtrl;
    }

    this._fullDayControlObs.next(fullDayFieldCtrl);

    switch (this.timeMode) {
      case DbxDateTimeFieldTimeMode.OPTIONAL:
        break;
      case DbxDateTimeFieldTimeMode.NONE:
        this.removeTime();
        break;
      case DbxDateTimeFieldTimeMode.REQUIRED:
        this.addTime();
        break;
    }

    if (this.presets != null) {
      this._presets.next(asObservableFromGetter(this.presets));
    } else {
      this._presets.next(this.dbxDateTimeFieldConfigService.configurations$);
    }

    this._resyncTimeInputSub.subscription = this.resyncTimeInput$.pipe(switchMap((x) => combineLatest([this.currentDate$, this.timeString$]).pipe(first()))).subscribe(([currentDate, timeString]) => {
      // only resync when the current date is set, otherwise do not change the time string.
      // This helps in cases where the user picks a time first and we don't want it to be cleared.
      if (currentDate != null) {
        this.timeInputCtrl.setValue(timeString, { emitEvent: false });
      }
    });

    // add validators/errors for the form
    this.formControl.addAsyncValidators([
      (x) => {
        const formValue = x.value as Maybe<Date>;
        let obs: Observable<ValidationErrors>;

        if (formValue != null) {
          obs = combineLatest([this.timezoneInstance$, this.dateTimePickerInstance$]).pipe(
            map(([timezoneInstance, x]) => {
              // the form value is going to be in the output form, so we need to parse it back to the "input" date before evaluating it
              const formValueInSystemTimezone = dbxDateTimeInputValueParseFactory(this.valueMode, timezoneInstance)(formValue);

              let errors: ValidationErrors = {
                ...this.timeInputCtrl.errors
              };

              if (formValueInSystemTimezone) {
                if (x.dateIsInSchedule(formValueInSystemTimezone)) {
                  if (!x.isInValidRange(formValueInSystemTimezone)) {
                    errors = {
                      [DBX_DATE_TIME_FIELD_TIME_NOT_IN_RANGE_ERROR]: true
                    };
                  }
                } else {
                  errors = {
                    [DBX_DATE_TIME_FIELD_DATE_NOT_IN_SCHEDULE_ERROR]: true
                  };
                }
              }

              return errors;
            }),
            first()
          );
        } else {
          obs = of({});
        }

        return obs;
      }
    ]);
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._sub.destroy();
    this._valueSub.destroy();
    this._config.complete();
    this._configUpdateTimeSync.destroy();
    this._defaultTimezone.complete();
    this._resyncTimeInputSub.destroy();
    this._autoFillDateSync.destroy();
    this._timeDate.complete();
    this._presets.complete();
    this._fullDayControlObs.complete();
    this._offset.complete();
    this._formControlObs.complete();
    this._updateTime.complete();
    this._cleared.complete();
    this._resyncTimeInput.complete();
    this._syncConfigObs.complete();
  }

  selectPreset(preset: DateTimePreset): void {
    const value = preset.value();

    if (value.logicalDate) {
      this.setLogicalTime(value.logicalDate);
    } else if (value.timeString) {
      this.setTime(value.timeString);
    }
  }

  datePicked(event: MatDatepickerInputEvent<Date>): void {
    const date = event.value;

    if (date) {
      this.setDateInputValue(date);
    }
  }

  setLogicalTime(time: LogicalDate): void {
    const date = dateFromLogicalDate(time);

    if (date) {
      this.setTimeFromDate(date);
    }
  }

  setDateInputValue(date: Date) {
    this.dateInputCtrl.setValue(date);
    this._updateTime.next();
  }

  setTimeFromDate(timeDate: Date): void {
    const timeString = toLocalReadableTimeString(timeDate);
    this.setTime(timeString);
  }

  setTime(time: ReadableTimeString): void {
    if (this.timeInputCtrl.value !== time) {
      this.timeInputCtrl.setValue(time);
      this._offset.next(0);
      this._updateTime.next();
    }
  }

  keydownOnDateInput(event: KeyboardEvent): void {
    let direction = 0;

    switch (event.key?.toLowerCase()) {
      case 'arrowup':
        direction = 1;
        break;
      case 'arrowdown':
        direction = -1;
        break;
    }

    let offset = 1;

    if (event.ctrlKey && event.shiftKey) {
      offset = 365;
    } else if (event.ctrlKey) {
      offset = 30;
    } else if (event.shiftKey) {
      offset = 7;
    }

    if (direction !== 0) {
      combineLatest([this.date$, this.dateTimePickerConfig$])
        .pipe(first())
        .subscribe(([date, config]) => {
          const newDate = startOfDay(addDays(date, offset * direction));
          const instance = new DateTimeMinuteInstance({
            date: newDate,
            ...config
          });

          const nextDate = instance.isInSchedule(newDate) ? newDate : instance.findNextAvailableDayInSchedule(newDate, direction === 1 ? 'future' : 'past');

          if (nextDate != null) {
            this.setDateInputValue(instance.clampToLimit(nextDate));
          }
        });
    }
  }

  keydownOnTimeInput(event: KeyboardEvent): void {
    let direction = 0;

    switch (event.key?.toLowerCase()) {
      case 'arrowup':
        direction = 1;
        break;
      case 'arrowdown':
        direction = -1;
        break;
    }

    let offset = 1;

    if (event.altKey && event.shiftKey) {
      offset = 300;
    } else if (event.altKey) {
      offset = 60;
    } else if (event.shiftKey) {
      offset = 5;
    }

    if (direction !== 0) {
      this._offset.next(this._offset.value + offset * direction);
      this._updateTime.next();
    }
  }

  focusTime(): void {
    // do nothing
  }

  focusOutTime(): void {
    // only refresh when there is not a pattern error
    if (!this.timeInputCtrl.hasError('pattern')) {
      this._updateTime.next();
      this._resyncTimeInput.next();
    }
  }

  addTime(): void {
    this.setFullDay(false);
  }

  removeTime(): void {
    this.setFullDay(true);
  }

  setFullDay(fullDay: boolean): void {
    this.fullDayControl$.pipe(first()).subscribe((x) => {
      x.setValue(fullDay);
    });
  }

  clearValue(): void {
    this._cleared.next();
  }
}
