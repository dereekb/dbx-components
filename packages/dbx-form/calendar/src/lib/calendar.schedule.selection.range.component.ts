import { switchMap, throttleTime } from 'rxjs/operators';
import { SubscriptionObject } from '@dereekb/rxjs';
import { Component, Inject, Input, OnDestroy } from '@angular/core';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { FormGroup, FormControl } from '@angular/forms';
import { Maybe, randomNumberFactory } from '@dereekb/util';
import { distinctUntilChanged, filter, BehaviorSubject, startWith, Observable, of } from 'rxjs';
import { isSameDateDay } from '@dereekb/date';
import { MatFormFieldAppearance, MatFormFieldDefaultOptions, MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-range',
  templateUrl: './calendar.schedule.selection.range.component.html'
})
export class DbxScheduleSelectionCalendarDateRangeComponent implements OnDestroy {
  @Input()
  required?: boolean;

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

  readonly random = randomNumberFactory(10000)();

  private _pickerOpened = new BehaviorSubject<boolean>(false);

  private _syncSub = new SubscriptionObject();
  private _valueSub = new SubscriptionObject();

  readonly range = new FormGroup({
    start: new FormControl<Maybe<Date>>(null),
    end: new FormControl<Maybe<Date>>(null)
  });

  readonly minDate$ = this.dbxCalendarScheduleSelectionStore.minDate$;
  readonly maxDate$ = this.dbxCalendarScheduleSelectionStore.maxDate$;
  readonly isCustomized$ = this.dbxCalendarScheduleSelectionStore.isCustomized$;

  readonly pickerOpened$ = this._pickerOpened.asObservable();

  constructor(readonly dbxCalendarStore: DbxCalendarStore, readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore, @Inject(MAT_FORM_FIELD_DEFAULT_OPTIONS) readonly matFormFieldDefaultOptions: MatFormFieldDefaultOptions) {}

  ngOnInit(): void {
    this._syncSub.subscription = this.dbxCalendarScheduleSelectionStore.inputRange$.subscribe((x) => {
      this.range.setValue({
        start: x.inputStart ?? null,
        end: x.inputEnd ?? null
      });
    });

    this._valueSub.subscription = this._pickerOpened
      .pipe(
        distinctUntilChanged(),
        switchMap((opened) => {
          let obs: Observable<{ start?: Maybe<Date>; end?: Maybe<Date> }>;

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
  }

  ngOnDestroy(): void {
    this._pickerOpened.complete();
    this._syncSub.destroy();
    this._valueSub.destroy();
  }

  pickerOpened() {
    this._pickerOpened.next(true);
  }

  pickerClosed() {
    this._pickerOpened.next(false);
  }
}
