import { ISO8601DateString, ISO8601DayString, LogicalDateStringCode, dateFromLogicalDate, Maybe, ReadableTimeString } from '@dereekb/util';
import { DateTimeMinuteConfig, DateTimeMinuteInstance, formatToDateString, formatToISO8601DayString, guessCurrentTimezone, readableTimeStringToDate, toLocalReadableTimeString, toReadableTimeString, utcDayForDate, formatToISO8601DateString, toJsDate, parseISO8601DayStringToDate } from '@dereekb/date';
import { switchMap, shareReplay, map, startWith, tap, first, distinctUntilChanged, debounceTime, throttleTime, BehaviorSubject, Observable, combineLatest, Subject, merge, interval } from 'rxjs';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormControl, Validators, FormGroup } from '@angular/forms';
import { FieldType } from '@ngx-formly/material';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { addMinutes, isSameDay, isSameMinute, startOfDay } from 'date-fns';
import { filterMaybe, skipFirstMaybe, SubscriptionObject, switchMapMaybeDefault, tapLog } from '@dereekb/rxjs';

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

export enum DbxDateTimeValueMode {
  /**
   * Value is returned/parsed as a Date.
   */
  DATE = 0,
  /**
   * Value is returned/parsed as an ISO8601DateString
   */
  DATE_STRING = 1,
  /**
   * Value is returned/parsed as an ISO8601DayString, relative to the current timezone.
   */
  DAY_STRING = 2
}

export function dbxDateTimeInputValueParseFactory(mode: DbxDateTimeValueMode): (date: Maybe<Date | string>) => Maybe<Date> {
  let factory: (date: Maybe<Date | string>) => Maybe<Date>;

  switch (mode) {
    case DbxDateTimeValueMode.DAY_STRING:
      factory = (x) => (typeof x === 'string' ? parseISO8601DayStringToDate(x) : x);
      break;
    case DbxDateTimeValueMode.DATE_STRING:
    case DbxDateTimeValueMode.DATE:
    default:
      factory = (x) => (x != null ? toJsDate(x) : x);
      break;
  }

  return factory;
}

export function dbxDateTimeOutputValueFactory(mode: DbxDateTimeValueMode): (date: Maybe<Date>) => Maybe<Date | string> {
  let factory: (date: Maybe<Date>) => Maybe<Date | string>;

  switch (mode) {
    case DbxDateTimeValueMode.DATE_STRING:
      factory = (x) => (x != null ? formatToISO8601DateString(x) : x);
      break;
    case DbxDateTimeValueMode.DAY_STRING:
      factory = (x) => (x != null ? formatToISO8601DayString(x) : x);
      break;
    case DbxDateTimeValueMode.DATE:
    default:
      factory = (x) => x;
      break;
  }

  return factory;
}

export type DateTimePickerConfiguration = Omit<DateTimeMinuteConfig, 'date'>;

export interface DbxDateTimeFieldProps extends FormlyFieldProps {
  /**
   * Value mode.
   *
   * Defaults to DATE
   */
  valueMode?: DbxDateTimeValueMode;

  /**
   * Whether or not the date is hidden, and automatically uses today/input date.
   */
  timeOnly?: boolean;

  /**
   * Whether or not the time can be added/removed optionally.
   *
   * This is ignored if timeOnly is specified.
   */
  timeMode?: DbxDateTimeFieldTimeMode;

  /**
   * Other form control for enabling/disabling whether or not it is a full day.
   *
   * This field is only used if time is optional.
   *
   * When time is off, the field is set to true.
   */
  fullDayFieldName?: string;

  /**
   * Whether or not to pass the date value as a UTC date, or a date in the current timezone.
   */
  fullDayInUTC?: boolean;

  /**
   * Whether or not ot hide the date hint info content.
   *
   * False by  default
   */
  hideDateHint?: boolean;

  /**
   * Used for returning the configuration observable.
   */
  getConfigObs?: () => Observable<DateTimePickerConfiguration>;
}

@Component({
  templateUrl: 'datetime.field.component.html'
})
export class DbxDateTimeFieldComponent extends FieldType<FieldTypeConfig<DbxDateTimeFieldProps>> implements OnInit, OnDestroy {
  private _sub = new SubscriptionObject();
  private _valueSub = new SubscriptionObject();

  private _fullDayInputCtrl?: FormControl;
  private _fullDayControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly fullDayControl$ = this._fullDayControlObs.pipe(filterMaybe());

  private _offset = new BehaviorSubject<number>(0);
  private _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  private _updateTime = new Subject<void>();

  readonly value$ = this.formControl$.pipe(
    switchMap((control) => control.valueChanges.pipe(startWith(control.value), map(dbxDateTimeInputValueParseFactory(this.valueMode)))),
    distinctUntilChanged((a, b) => (a != null && b != null ? isSameMinute(a, b) : a === b)),
    shareReplay(1)
  );

  /**
   * Used to trigger/display visual updates (specifically on timeDistance, etc.).
   */
  readonly displayValue$ = interval(10 * 1000).pipe(
    startWith(0),
    map(() => new Date().getMinutes()),
    distinctUntilChanged(),
    tap(() => this.cdRef.markForCheck()),
    switchMap(() => this.value$),
    shareReplay(1)
  );

  readonly timeString$: Observable<ReadableTimeString> = this.value$.pipe(
    filterMaybe(),
    map((x) => {
      const timezone = guessCurrentTimezone();
      const timeString = toReadableTimeString(x, timezone);
      return timeString;
    })
  );

  readonly dateInputCtrl = new FormControl(new Date(), {
    validators: []
  });

  readonly timeInputCtrl = new FormControl('', {
    validators: [Validators.pattern(/^(now)$|^([0-9]|(0[0-9])|(1[0-9])|(2[0-3]))(:)?([0-5][0-9])?(\s)?([apAP][Mm])?(\\s)*$/)]
  });

  private _config = new BehaviorSubject<Maybe<Observable<DateTimePickerConfiguration>>>(undefined);

  get dateOnly(): boolean {
    return this.timeMode === DbxDateTimeFieldTimeMode.NONE;
  }

  get dateTimeField(): DbxDateTimeFieldProps {
    return this.field.props;
  }

  get timeOnly(): Maybe<boolean> {
    return this.dateTimeField.timeOnly;
  }

  get showDateInput(): boolean {
    return !this.timeOnly;
  }

  get timeMode(): DbxDateTimeFieldTimeMode {
    return this.timeOnly ? DbxDateTimeFieldTimeMode.REQUIRED : this.dateTimeField.timeMode ?? DbxDateTimeFieldTimeMode.REQUIRED;
  }

  get valueMode(): DbxDateTimeValueMode {
    return this.field.props.valueMode ?? DbxDateTimeValueMode.DATE;
  }

  get description(): Maybe<string> {
    return this.field.props.description;
  }

  get hideDateHint(): boolean {
    return this.field.props.hideDateHint ?? false;
  }

  readonly fullDay$: Observable<boolean> = this.fullDayControl$.pipe(switchMap((control) => control.valueChanges.pipe(startWith(control.value))));

  readonly showTimeInput$: Observable<boolean> = this.fullDay$.pipe(map((x) => !x && this.timeMode !== DbxDateTimeFieldTimeMode.NONE));

  readonly showAddTime$ = this.showTimeInput$.pipe(
    map((x) => !x && this.timeMode === DbxDateTimeFieldTimeMode.OPTIONAL),
    shareReplay(1)
  );

  readonly date$ = this.dateInputCtrl.valueChanges.pipe(startWith(this.dateInputCtrl.value), filterMaybe(), shareReplay(1));

  readonly dateValue$ = merge(this.date$.pipe(tapLog('date')), this.value$.pipe(skipFirstMaybe())).pipe(
    map((x: Maybe<Date>) => (x ? startOfDay(x) : x)),
    distinctUntilChanged((a, b) => a != null && b != null && isSameDay(a, b)),
    shareReplay(1)
  );

  readonly timeInput$: Observable<ReadableTimeString> = this._updateTime.pipe(
    debounceTime(5),
    map(() => this.timeInputCtrl.value || ''),
    distinctUntilChanged()
  );

  readonly config$ = this._config.pipe(switchMapMaybeDefault(), shareReplay(1));

  readonly rawDateTime$: Observable<Maybe<Date>> = combineLatest([this.dateValue$, this.timeInput$.pipe(startWith(null)), this.fullDay$]).pipe(
    map(([date, timeString, fullDay]) => {
      let result: Maybe<Date>;

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
        } else {
          result = date;
        }
      }

      return result;
    }),
    distinctUntilChanged<Maybe<Date>>((a, b) => a != null && b != null && isSameMinute(a, b)),
    shareReplay(1)
  );

  readonly timeOutput$: Observable<Maybe<Date>> = combineLatest([this.rawDateTime$, this._offset, this.config$.pipe(distinctUntilChanged())]).pipe(
    throttleTime(40, undefined, { leading: false, trailing: true }),
    distinctUntilChanged((current, next) => current[0] === next[0] && next[1] === 0),
    tap(([, stepsOffset]) => (stepsOffset ? this._offset.next(0) : 0)),
    map(([date, stepsOffset, config]) => {
      if (date != null) {
        const instance = new DateTimeMinuteInstance({
          date,
          ...config,
          roundDownToMinute: true
        });

        date = instance.limit(date);

        const minutes = stepsOffset * 5;
        date = addMinutes(date, minutes);
      }

      return date;
    }),
    distinctUntilChanged((a, b) => a != null && b != null && isSameMinute(a, b)),
    shareReplay(1)
  );

  constructor(private readonly cdRef: ChangeDetectorRef) {
    super();
  }

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);
    this._config.next(this.dateTimeField.getConfigObs?.());

    const valueFactory = dbxDateTimeOutputValueFactory(this.valueMode);

    this._sub.subscription = this.timeOutput$.pipe(skipFirstMaybe()).subscribe((dateValue) => {
      const value = valueFactory(dateValue);

      this.formControl.setValue(value);
      this.formControl.markAsDirty();
      this.formControl.markAsTouched();
    });

    this._valueSub.subscription = this.timeString$.subscribe((x) => {
      // Skip events where the timeInput value is cleared.
      if (!this.timeInputCtrl.value && x === '12:00AM') {
        return;
      }

      this.setTime(x);
    });

    // Watch for disabled changes so we can propogate them properly.
    this.formControl.registerOnDisabledChange((disabled) => {
      if (disabled) {
        this.dateInputCtrl.disable({ emitEvent: false });
        this.timeInputCtrl.disable({ emitEvent: false });
      } else {
        this.dateInputCtrl.enable({ emitEvent: false });
        this.timeInputCtrl.enable({ emitEvent: false });
      }
    });

    const isFullDayField = this.dateTimeField.fullDayFieldName;
    let fullDayFieldCtrl: Maybe<AbstractControl>;

    if (isFullDayField) {
      fullDayFieldCtrl = this.form.get(isFullDayField);
    }

    if (!fullDayFieldCtrl) {
      this._fullDayInputCtrl = new FormControl(true);

      // Set the control in the form too if the name is defined.
      if (isFullDayField) {
        (this.form as FormGroup).addControl(isFullDayField, this._fullDayInputCtrl);
      }

      fullDayFieldCtrl = this._fullDayInputCtrl;
    }

    this._fullDayControlObs.next(fullDayFieldCtrl);

    switch (this.dateTimeField.timeMode) {
      case DbxDateTimeFieldTimeMode.OPTIONAL:
        break;
      case DbxDateTimeFieldTimeMode.NONE:
        this.removeTime();
        break;
      case DbxDateTimeFieldTimeMode.REQUIRED:
        this.addTime();
        break;
    }
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._fullDayControlObs.complete();
    this._offset.complete();
    this._formControlObs.complete();
    this._config.complete();
    this._updateTime.complete();
    this._sub.destroy();
    this._valueSub.destroy();
  }

  datePicked(event: MatDatepickerInputEvent<Date>): void {
    const date = event.value;

    console.log('date picked?', event);

    if (date) {
      this.dateInputCtrl.setValue(date);
      this._updateTime.next();
    }
  }

  setLogicalTime(time: LogicalDateStringCode): void {
    const date = dateFromLogicalDate(time);

    if (date) {
      const timeString = toLocalReadableTimeString(date);
      this.setTime(timeString);
    }
  }

  setTime(time: ReadableTimeString): void {
    this.timeInputCtrl.setValue(time);
    this._offset.next(0);
    this._updateTime.next();
  }

  keydownOnInput(event: KeyboardEvent): void {
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
    this._updateTime.next();
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
}
