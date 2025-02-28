import { SubscriptionObject } from '@dereekb/rxjs';
import { Component, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { FormGroup, FormControl, AbstractControl } from '@angular/forms';
import { type Maybe } from '@dereekb/util';
import { switchMap, throttleTime, distinctUntilChanged, filter, BehaviorSubject, startWith, Observable, map, shareReplay, combineLatest, EMPTY } from 'rxjs';
import { isSameDateDay } from '@dereekb/date';
import { MatFormFieldDefaultOptions, MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { ErrorStateMatcher } from '@angular/material/core';
import { DateFilterFn, MatDateRangePicker } from '@angular/material/datepicker';

interface RangeValue {
  start?: Maybe<Date>;
  end?: Maybe<Date>;
}

@Component({
  selector: 'dbx-schedule-selection-calendar-date-range',
  templateUrl: './calendar.schedule.selection.range.component.html'
})
export class DbxScheduleSelectionCalendarDateRangeComponent implements OnInit, OnDestroy {
  readonly dbxCalendarStore = inject(DbxCalendarStore);
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);
  readonly matFormFieldDefaultOptions = inject<MatFormFieldDefaultOptions>(MAT_FORM_FIELD_DEFAULT_OPTIONS, { optional: true });

  private _required = new BehaviorSubject<boolean>(false);

  readonly required$ = this._required.asObservable();
  readonly timezone$ = this.dbxCalendarScheduleSelectionStore.effectiveOutputTimezone$;

  @Input()
  openPickerOnTextClick: boolean = true;

  @ViewChild('picker')
  picker!: MatDateRangePicker<Date>;

  @Input()
  label?: Maybe<string> = 'Enter a date range';

  @Input()
  hint?: Maybe<string>;

  @Input()
  set disabled(disabled: Maybe<boolean>) {
    if (disabled) {
      this.range.disable();
    } else {
      this.range.enable();
    }
  }

  @Input()
  showCustomize = false;

  private _pickerOpened = new BehaviorSubject<boolean>(false);

  private _requiredSub = new SubscriptionObject();
  private _syncSub = new SubscriptionObject();
  private _valueSub = new SubscriptionObject();

  readonly range = new FormGroup({
    start: new FormControl<Maybe<Date>>(null),
    end: new FormControl<Maybe<Date>>(null)
  });

  readonly errorStateMatcher: ErrorStateMatcher = {
    isErrorState: (control: AbstractControl | null, form) => {
      if (control) {
        return (control.invalid && (control.dirty || control.touched)) || (control.touched && this.range.invalid);
      } else {
        return false;
      }
    }
  };

  readonly minDate$ = this.dbxCalendarScheduleSelectionStore.minDate$;
  readonly maxDate$ = this.dbxCalendarScheduleSelectionStore.maxDate$;
  readonly timezoneReleventDate$ = this.dbxCalendarScheduleSelectionStore.currentDateRange$.pipe(
    map((currentDateRange) => {
      return currentDateRange ? currentDateRange.start ?? currentDateRange.end : undefined ?? new Date();
    }),
    shareReplay(1)
  );

  readonly isCustomized$ = this.dbxCalendarScheduleSelectionStore.isCustomized$;
  readonly currentErrorMessage$ = this.range.statusChanges.pipe(
    filter((x) => x === 'INVALID' || x === 'VALID'),
    map((x) => {
      let currentErrorMessage: string | undefined;

      if (x === 'INVALID') {
        const { start, end } = this.range.controls;

        if (this.range.hasError('required')) {
          currentErrorMessage = 'Date range is required';
        } else if (start.hasError('matStartDateInvalid')) {
          currentErrorMessage = 'Invalid start date';
        } else if (start.hasError('matDatepickerMin')) {
          currentErrorMessage = 'Start date is too early';
        } else if (start.hasError('matDatepickerMax')) {
          currentErrorMessage = 'Start date is too late';
        } else if (end.hasError('matStartDateInvalid')) {
          currentErrorMessage = 'Invalid end date';
        } else if (end.hasError('matDatepickerMin')) {
          currentErrorMessage = 'End date is too early';
        } else if (end.hasError('matDatepickerMax')) {
          currentErrorMessage = 'End date is too late';
        }
      }

      return currentErrorMessage;
    }),
    shareReplay(1)
  );

  readonly pickerOpened$ = this._pickerOpened.asObservable();

  readonly defaultDatePickerFilter: DateFilterFn<Date> = () => true;
  readonly datePickerFilter$: Observable<DateFilterFn<Date>> = combineLatest([this.dbxCalendarScheduleSelectionStore.isEnabledFilterDayFunction$, this.dbxCalendarScheduleSelectionStore.isInAllowedDaysOfWeekFunction$]).pipe(
    map(([isEnabled, isAllowedDayOfWeek]) => {
      const fn = (date: Date | null) => {
        const result = date ? isAllowedDayOfWeek(date) && isEnabled(date) : true;
        return result;
      };
      return fn;
    }),
    shareReplay(1)
  );

  ngOnInit(): void {
    this._syncSub.subscription = this.dbxCalendarScheduleSelectionStore.currentInputRange$.subscribe((x) => {
      this.range.setValue({
        start: x?.inputStart ?? null,
        end: x?.inputEnd ?? null
      });
    });

    this._valueSub.subscription = this._pickerOpened
      .pipe(
        distinctUntilChanged(),
        switchMap((opened) => {
          let obs: Observable<RangeValue>;

          if (opened) {
            obs = EMPTY;
          } else {
            obs = this.range.valueChanges.pipe(startWith(this.range.value));
          }

          return obs;
        }),
        filter((x) => Boolean(x.start && x.end)),
        distinctUntilChanged((a, b) => isSameDateDay(a.start, b.start) && isSameDateDay(a.end, b.end)),
        throttleTime(100, undefined, { trailing: true })
      )
      .subscribe((x) => {
        if (x.start && x.end) {
          this.dbxCalendarScheduleSelectionStore.setInputRange({ inputStart: x.start, inputEnd: x.end });
        }
      });

    // add a required validator when needed
    this._requiredSub.subscription = this._required.subscribe((x) => {
      const validators = x
        ? [
            (control: AbstractControl) => {
              const range = control.value;

              if (!range || !range.start || !range.end) {
                return { required: true };
              }

              return null;
            }
          ]
        : [];

      this.range.setValidators(validators);
    });
  }

  ngOnDestroy(): void {
    this._required.complete();
    this._pickerOpened.complete();
    this._requiredSub.destroy();
    this._syncSub.destroy();
    this._valueSub.destroy();
  }

  @Input()
  get required() {
    return this._required.value;
  }

  set required(required: boolean) {
    this._required.next(required);
  }

  clickedDateRangeInput() {
    if (this.openPickerOnTextClick) {
      this.picker.open();
    }
  }

  pickerOpened() {
    this._pickerOpened.next(true);
  }

  pickerClosed() {
    this._pickerOpened.next(false);
  }
}
