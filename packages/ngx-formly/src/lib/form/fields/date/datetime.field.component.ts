import { DateTimeMinuteConfig, DateTimeMinuteInstance } from './../../../model/date.time.minute';
import { DateOrDateString, DateUtility } from '../../../model/date';
import { switchMap, shareReplay, map, filter, startWith, tap, first, distinctUntilChanged, delay, debounce, debounceTime, throttleTime, zipAll } from 'rxjs/operators';
import { EmailAddress, ModelKey, EmailParticipant } from '@/app/common/model';
import {
  ChangeDetectorRef,
  Component, ComponentFactoryResolver, ElementRef, NgZone, OnDestroy, OnInit, Type, ViewChild, ViewContainerRef
} from '@angular/core';
import { AbstractControl, FormControl, Validators } from '@angular/forms';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject, Observable, of, combineLatest, Subject, merge, interval } from 'rxjs';
import { DateTimeUtility, ReadableTimeString } from '@/app/common/model/date.time';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { addMinutes, isSameDay, isSameMinute, isSameSecond, startOfDay } from 'date-fns';
import { SubscriptionObject } from '@dereekb/ngx-core';

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

export interface DbNgxDateTimeFieldConfig {

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
   * Other form contro for enabling/disabling whether or not it is a full day.
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

  /**
   * Optional description/hint to display.
   */
  description?: string;

}

export interface DateTimeFormlyFieldConfig extends DbNgxDateTimeFieldConfig, FormlyFieldConfig { }

@Component({
  templateUrl: 'datetime.field.component.html',
  styleUrls: ['./date.scss']
})
export class DbNgxDateTimeFieldComponent extends FieldType<DateTimeFormlyFieldConfig> implements OnInit, OnDestroy {

  private _sub = new SubscriptionObject();
  private _valueSub = new SubscriptionObject();

  private _fullDayInputCtrl: FormControl;
  private _fullDayControlObs = new BehaviorSubject<AbstractControl>(undefined);
  readonly fullDayControl$ = this._fullDayControlObs.pipe(filter(x => Boolean(x)));

  private _offset = new BehaviorSubject<number>(0);
  private _formControlObs = new BehaviorSubject<AbstractControl>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filter(x => Boolean(x)));

  private _updateTime = new Subject();

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
    filter(x => Boolean(x)),
    map((x) => {
      const timezone = DateUtility.guessCurrentTimezone();
      const timeString = DateTimeUtility.toTimeString(x, timezone);
      return timeString;
    })
  );

  readonly timeInputCtrl = new FormControl('', {
    validators: [
      Validators.pattern(/^([0-9]|(0[0-9])|(1[0-9])|(2[0-3]))(:)?([0-5][0-9])?(\s)?([apAP][Mm])?(\\s)*$/)
    ]
  });

  private _date = new BehaviorSubject<Date>(new Date());
  private _config = new BehaviorSubject<Observable<DateTimePickerConfiguration>>(undefined);

  get timeOnly(): boolean {
    return this.field.timeOnly;
  }

  get showDateInput(): boolean {
    return !this.timeOnly;
  }

  get timeMode(): DateTimeFieldTimeMode {
    return (this.timeOnly) ? DateTimeFieldTimeMode.REQUIRED : (this.field.timeMode ?? DateTimeFieldTimeMode.REQUIRED);
  }

  get description(): string {
    return this.field.templateOptions.description;
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

  readonly date$ = this._date.pipe(distinctUntilChanged((a, b) => isSameDay(a, b)));
  readonly dateValue$ = merge(
    this.value$.pipe(startWith(undefined as Date)),
    this.date$
  ).pipe(
    filter((x: Date) => Boolean(x)),
    map(x => startOfDay(x)),
    distinctUntilChanged((a, b) => isSameDay(a, b)),
    shareReplay(1)
  );

  readonly timeInput$: Observable<ReadableTimeString> = this._updateTime.pipe(
    debounceTime(5),
    map(x => this.timeInputCtrl.value),
    distinctUntilChanged()
  );

  readonly config$ = this._config.pipe(switchMap(x => x), shareReplay(1));

  readonly rawDateTime$: Observable<Date> = combineLatest([
    this.dateValue$.pipe(filter(x => Boolean(x))),
    this.timeInput$.pipe(startWith(null as any)),
    this.fullDay$
  ]).pipe(
    map(([date, timeString, fullDay]) => {
      let result: Date;

      if (fullDay) {
        if (this.field.fullDayInUTC) {
          result = DateUtility.utcDay(date);
        } else {
          result = startOfDay(date);
        }
      } else if (timeString) {
        result = DateTimeUtility.timeStringToDate(timeString, {
          date,
          useSystemTimezone: true
        });
      }

      return result;
    }),
    filter(x => Boolean(x)),
    distinctUntilChanged((a, b) => isSameMinute(a, b)),
    shareReplay(1)
  );

  readonly timeOutput$ = combineLatest([
    this.rawDateTime$,
    this._offset,
    this.config$.pipe(distinctUntilChanged()),
  ]).pipe(
    throttleTime(10, undefined, { leading: false, trailing: true }),
    distinctUntilChanged((current, next) => current[0] === next[0] && next[1] === 0),
    tap(([_, stepsOffset]) => (stepsOffset) ? this._offset.next(0) : 0),
    map(([date, stepsOffset, config]) => {
      const instance = new DateTimeMinuteInstance({
        date,
        ...config,
        roundDownToMinute: true
      });

      date = instance.limit(date);

      const minutes = stepsOffset * 5;
      date = addMinutes(date, minutes);

      return date;
    }),
    distinctUntilChanged((a, b) => a && b && isSameMinute(a, b)),
  );

  constructor(private readonly cdRef: ChangeDetectorRef) {
    super();
  }

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);
    this._config.next(this.field.getConfigObs?.() ?? of(undefined));

    this._sub.subscription = this.timeOutput$.subscribe((value) => {
      this.formControl.setValue(value);
      this.formControl.markAsDirty();
      this.formControl.markAsTouched();
    });

    this._valueSub.subscription = this.timeString$.subscribe((x) => {
      this.timeInputCtrl.setValue(x);
    });

    const isFullDayField = this.field.fullDayFieldName;
    let fullDayFieldCtrl: AbstractControl;

    if (isFullDayField) {
      fullDayFieldCtrl = this.form.get(isFullDayField);
    }

    if (!fullDayFieldCtrl) {
      this._fullDayInputCtrl = new FormControl(true);

      // Set the control in the form too if the name is defined.
      if (isFullDayField) {
        this.form.addControl(isFullDayField, this._fullDayInputCtrl);
      }

      fullDayFieldCtrl = this._fullDayInputCtrl;
    }

    this._fullDayControlObs.next(fullDayFieldCtrl);

    switch (this.field.timeMode) {
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

  ngOnDestroy(): void {
    this._formControlObs.complete();
    this._date.complete();
    this._updateTime.complete();
    this._config.complete();
    this._sub.destroy();
    this._valueSub.destroy();
  }

  datePicked(event: MatDatepickerInputEvent<Date>): void {
    this._date.next(event.value);
    this._updateTime.next();
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
