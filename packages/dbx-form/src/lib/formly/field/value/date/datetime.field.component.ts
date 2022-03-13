import { LogicalDateStringCode, dateFromLogicalDate, Maybe, ReadableTimeString } from '@dereekb/util';
import { DateTimeMinuteConfig, DateTimeMinuteInstance, guessCurrentTimezone, readableTimeStringToDate, toLocalReadableTimeString, toReadableTimeString, utcDayForDate } from '@dereekb/date';
import { switchMap, shareReplay, map, startWith, tap, first, distinctUntilChanged, debounceTime, throttleTime } from 'rxjs/operators';
import {
  ChangeDetectorRef,
  Component, OnDestroy, OnInit
} from '@angular/core';
import { AbstractControl, FormControl, Validators, FormGroup } from '@angular/forms';
import { FieldType } from '@ngx-formly/material';
import { FieldTypeConfig, FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject, Observable, combineLatest, Subject, merge, interval } from 'rxjs';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { addMinutes, isSameDay, isSameMinute, startOfDay } from 'date-fns';
import { filterMaybe, skipFirstMaybe, SubscriptionObject, switchMapMaybeDefault } from '@dereekb/rxjs';

export enum DateTimeFieldTimeMode {
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

export interface DateTimePickerConfiguration extends Omit<DateTimeMinuteConfig, 'date'> { }

export interface DbxDateTimeFieldConfig {

  /**
   * Whether or not the date is hidden, and automatically uses today/input date.
   */
  timeOnly?: boolean;

  /**
   * Whether or not the time can be added/removed optionally.
   * 
   * This is ignored if timeOnly is specified.
   */
  timeMode?: DateTimeFieldTimeMode;

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
   * Used for returning the configuration observable.
   */
  getConfigObs?: () => Observable<DateTimePickerConfiguration>;

}

export interface DateTimeFormlyFieldConfig extends FormlyFieldConfig {
  dateTimeField: DbxDateTimeFieldConfig;
}

@Component({
  templateUrl: 'datetime.field.component.html'
})
export class DbxDateTimeFieldComponent extends FieldType<DateTimeFormlyFieldConfig & FieldTypeConfig> implements OnInit, OnDestroy {

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
    switchMap(control => control.valueChanges.pipe(startWith(control.value))),
    distinctUntilChanged((a, b) => isSameMinute(a, b)),
    shareReplay(1)
  );

  /**
   * Used to trigger/display visual updates (specifically on timeDistance, etc.).
   */
  readonly displayValue$ = interval(10 * 1000).pipe(
    startWith(0),
    map(_ => new Date().getMinutes()),
    distinctUntilChanged(),
    tap((_) => this.cdRef.markForCheck()),
    switchMap(_ => this.value$),
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
    validators: [
      Validators.pattern(/^(now)$|^([0-9]|(0[0-9])|(1[0-9])|(2[0-3]))(:)?([0-5][0-9])?(\s)?([apAP][Mm])?(\\s)*$/)
    ]
  });

  private _config = new BehaviorSubject<Maybe<Observable<DateTimePickerConfiguration>>>(undefined);

  get dateOnly(): boolean {
    return this.timeMode === DateTimeFieldTimeMode.NONE;
  }

  get dateTimeField() {
    return this.field.dateTimeField;
  }

  get timeOnly(): Maybe<boolean> {
    return this.dateTimeField.timeOnly;
  }

  get showDateInput(): boolean {
    return !this.timeOnly;
  }

  get timeMode(): DateTimeFieldTimeMode {
    return (this.timeOnly) ? DateTimeFieldTimeMode.REQUIRED : (this.dateTimeField.timeMode ?? DateTimeFieldTimeMode.REQUIRED);
  }

  get description(): Maybe<string> {
    return this.field.templateOptions?.description;
  }

  readonly fullDay$: Observable<boolean> = this.fullDayControl$.pipe(
    switchMap(control => control.valueChanges.pipe(startWith(control.value)))
  );

  readonly showTimeInput$: Observable<boolean> = this.fullDay$.pipe(
    map(x => !x && this.timeMode !== DateTimeFieldTimeMode.NONE)
  );

  readonly showAddTime$ = this.showTimeInput$.pipe(
    map(x => !x && this.timeMode === DateTimeFieldTimeMode.OPTIONAL),
    shareReplay(1)
  );

  readonly date$ = this.dateInputCtrl.valueChanges.pipe(filterMaybe(), shareReplay(1));

  readonly dateValue$ = merge(
    this.date$,
    this.value$.pipe(skipFirstMaybe())
  ).pipe(
    map((x: Maybe<Date>) => (x) ? startOfDay(x) : x),
    distinctUntilChanged((a, b) => Boolean(a && b) && isSameDay(a!, b!)),
    shareReplay(1)
  );

  readonly timeInput$: Observable<ReadableTimeString> = this._updateTime.pipe(
    debounceTime(5),
    map(_ => this.timeInputCtrl.value),
    distinctUntilChanged()
  );

  readonly config$ = this._config.pipe(switchMapMaybeDefault(), shareReplay(1));

  readonly rawDateTime$: Observable<Maybe<Date>> = combineLatest([
    this.dateValue$,
    this.timeInput$.pipe(startWith(null as any)),
    this.fullDay$
  ]).pipe(
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
          result = readableTimeStringToDate(timeString, {
            date,
            useSystemTimezone: true
          }) ?? date;
        } else {
          result = date;
        }
      }

      return result;
    }),
    distinctUntilChanged<Maybe<Date>>((a, b) => Boolean(a && b) && isSameMinute(a!, b!)),
    shareReplay(1)
  );

  readonly timeOutput$: Observable<Maybe<Date>> = combineLatest([
    this.rawDateTime$,
    this._offset,
    this.config$.pipe(distinctUntilChanged()),
  ]).pipe(
    throttleTime(40, undefined, { leading: false, trailing: true }),
    distinctUntilChanged((current, next) => current[0] === next[0] && next[1] === 0),
    tap(([_, stepsOffset]) => (stepsOffset) ? this._offset.next(0) : 0),
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
    distinctUntilChanged((a, b) => Boolean(a && b) && isSameMinute(a!, b!)),
    shareReplay(1)
  );

  constructor(private readonly cdRef: ChangeDetectorRef) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this._formControlObs.next(this.formControl);
    this._config.next(this.dateTimeField.getConfigObs?.());

    this._sub.subscription = this.timeOutput$.pipe(skipFirstMaybe()).subscribe((value) => {
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
      case DateTimeFieldTimeMode.OPTIONAL:
        break;
      case DateTimeFieldTimeMode.NONE:
        this.removeTime();
        break;
      case DateTimeFieldTimeMode.REQUIRED:
        this.addTime();
        break;
    }
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._formControlObs.complete();
    this._updateTime.complete();
    this._config.complete();
    this._sub.destroy();
    this._valueSub.destroy();
  }

  datePicked(event: MatDatepickerInputEvent<Date>): void {
    const date = event.value;

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
      this._offset.next(this._offset.value + (offset * direction));
      this._updateTime.next();
    }
  }

  focusTime(): void {

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
