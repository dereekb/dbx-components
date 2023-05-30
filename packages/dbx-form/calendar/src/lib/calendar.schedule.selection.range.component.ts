import { SubscriptionObject, tapLog } from '@dereekb/rxjs';
import { Component, Inject, Input, OnDestroy, OnInit } from '@angular/core';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { FormGroup, FormControl, Validators, AbstractControl } from '@angular/forms';
import { Maybe, randomNumberFactory } from '@dereekb/util';
import { switchMap, throttleTime, distinctUntilChanged, filter, BehaviorSubject, startWith, Observable, of, combineLatest, map, distinct, shareReplay } from 'rxjs';
import { isSameDateDay } from '@dereekb/date';
import { MatFormFieldDefaultOptions, MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { ErrorStateMatcher } from '@angular/material/core';

interface RangeValue {
  start?: Maybe<Date>;
  end?: Maybe<Date>;
}

@Component({
  selector: 'dbx-schedule-selection-calendar-date-range',
  templateUrl: './calendar.schedule.selection.range.component.html'
})
export class DbxScheduleSelectionCalendarDateRangeComponent implements OnInit, OnDestroy {
  private _required = new BehaviorSubject<boolean>(false);
  readonly required$ = this._required.asObservable();
  readonly timezone$ = this.dbxCalendarScheduleSelectionStore.currentTimezone$;

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

  readonly pickerOpened$ = this._pickerOpened.asObservable();

  constructor(readonly dbxCalendarStore: DbxCalendarStore, readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore, @Inject(MAT_FORM_FIELD_DEFAULT_OPTIONS) readonly matFormFieldDefaultOptions: MatFormFieldDefaultOptions) {}

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
            obs = of({});
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

  pickerOpened() {
    this._pickerOpened.next(true);
  }

  pickerClosed() {
    this._pickerOpened.next(false);
  }
}
