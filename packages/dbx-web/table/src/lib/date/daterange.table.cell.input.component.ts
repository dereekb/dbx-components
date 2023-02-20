import { ChangeDetectionStrategy, Component, Injectable, OnDestroy, OnInit } from '@angular/core';
import { DateRangeDayDistanceInput, isSameDateDay } from '@dereekb/date';
import { DbxTableStore } from '../table.store';
import { MatDateRangeSelectionStrategy, DateRange, MAT_DATE_RANGE_SELECTION_STRATEGY } from '@angular/material/datepicker';
import { DateAdapter } from '@angular/material/core';
import { Days, Maybe } from '@dereekb/util';
import { FormGroup, FormControl } from '@angular/forms';
import { SubscriptionObject } from '@dereekb/rxjs';
import { addDays, format as formatDate } from 'date-fns';
import { BehaviorSubject, distinctUntilChanged, filter, map, Observable, of, startWith, switchMap, throttleTime, combineLatest } from 'rxjs';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';

@Injectable()
export class DbxTableDateRangeDayDistanceInputCellInputRangeSelectionStrategy<D> implements MatDateRangeSelectionStrategy<D> {
  constructor(private _dateAdapter: DateAdapter<D>, private dbxTableDateRangeDayDistanceInputCellInputComponent: DbxTableDateRangeDayDistanceInputCellInputComponent) {}

  selectionFinished(date: D | null): DateRange<D> {
    return this._createFiveDayRange(date);
  }

  createPreview(activeDate: D | null): DateRange<D> {
    return this._createFiveDayRange(activeDate);
  }

  private _createFiveDayRange(date: D | null): DateRange<D> {
    if (date) {
      const start = date;
      const end = this._dateAdapter.addCalendarDays(date, this.dbxTableDateRangeDayDistanceInputCellInputComponent.daysDistance);
      return new DateRange<D>(start, end);
    }

    return new DateRange<D>(null, null);
  }
}

export interface DbxTableDateRangeDayDistanceInputCellInputComponentConfig {
  /**
   * Button format for the dates
   */
  buttonFormat?: string;
  /**
   * Distance from the start to span.
   */
  daysDistance: Days;
  minDate?: Maybe<Date>;
  maxDate?: Maybe<Date>;
}

export const DEFAULT_DBX_TABLE_DATE_RANGE_DAY_DISTIANCE_INPUT_CELL_COMPONENT_CONFIG = { daysDistance: 6 };

export const DEFAULT_DBX_TABLE_DATE_RANGE_DAY_BUTTON_FORMAT = 'MMM dd';

/**
 * Cell input for a DateRangeDayDistanceInput value.
 */
@Component({
  template: `
    <div class="dbx-table-date-range-distance-input-cell">
      <mat-date-range-input class="dbx-table-date-range-distance-input" [min]="minDate$ | async" [max]="maxDate$ | async" [formGroup]="range" [rangePicker]="picker">
        <input matStartDate formControlName="start" placeholder="Start date" />
        <input matEndDate formControlName="end" placeholder="End date" />
      </mat-date-range-input>
      <button mat-stroked-button color="primary" (click)="picker.open()">{{ dateRangeString$ | async }}</button>
      <mat-date-range-picker #picker (opened)="pickerOpened()" (closed)="pickerClosed()"></mat-date-range-picker>
    </div>
  `,
  providers: [
    {
      provide: MAT_DATE_RANGE_SELECTION_STRATEGY,
      useClass: DbxTableDateRangeDayDistanceInputCellInputRangeSelectionStrategy
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableDateRangeDayDistanceInputCellInputComponent implements OnInit, OnDestroy {
  private _syncSub = new SubscriptionObject();
  private _valueSub = new SubscriptionObject();

  private _pickerOpened = new BehaviorSubject<boolean>(false);
  private _config = new BehaviorSubject<DbxTableDateRangeDayDistanceInputCellInputComponentConfig>(DEFAULT_DBX_TABLE_DATE_RANGE_DAY_DISTIANCE_INPUT_CELL_COMPONENT_CONFIG);

  readonly range = new FormGroup({
    start: new FormControl<Maybe<Date>>(null),
    end: new FormControl<Maybe<Date>>(null)
  });

  readonly pickerOpened$ = this._pickerOpened.asObservable();

  readonly minDate$ = this._config.pipe(map((x) => x.minDate));
  readonly maxDate$ = this._config.pipe(map((x) => x.maxDate));

  readonly buttonFormat$ = this._config.pipe(map((x) => x.buttonFormat ?? DEFAULT_DBX_TABLE_DATE_RANGE_DAY_BUTTON_FORMAT));

  readonly dateRangeString$ = combineLatest([this.buttonFormat$, this.range.valueChanges]).pipe(
    map(([buttonFormat, { start, end }]) => {
      if (start && end) {
        return `${formatDate(start, buttonFormat)} - ${formatDate(end, buttonFormat)}`;
      } else {
        return `Select Date`;
      }
    })
  );

  constructor(readonly tableStore: DbxTableStore<DateRangeDayDistanceInput>) {}

  ngOnInit(): void {
    this._syncSub.subscription = this.tableStore.input$.subscribe((x) => {
      const start = x?.date ?? null;
      const end = start ? addDays(start, this.daysDistance) : undefined;

      this.range.setValue({
        start,
        end
      });
    });

    this._valueSub.subscription = this._pickerOpened
      .pipe(
        distinctUntilChanged(),
        switchMap((opened) => {
          let obs: Observable<{ start?: Maybe<Date> }>;

          if (opened) {
            obs = of({});
          } else {
            obs = this.range.valueChanges.pipe(startWith(this.range.value));
          }

          return obs;
        }),
        filter((x) => Boolean(x.start)),
        distinctUntilChanged((a, b) => isSameDateDay(a.start, b.start)),
        throttleTime(100, undefined, { trailing: true })
      )
      .subscribe((x) => {
        if (x.start) {
          this.tableStore.setInput({ date: x.start, distance: this.daysDistance });
        }
      });
  }

  ngOnDestroy(): void {
    this._pickerOpened.complete();
    this._config.complete();
    this._syncSub.destroy();
    this._valueSub.destroy();
  }

  get daysDistance() {
    return this._config.value.daysDistance;
  }

  get config() {
    return this._config.value;
  }

  set config(config: Maybe<DbxTableDateRangeDayDistanceInputCellInputComponentConfig>) {
    this._config.next(config || DEFAULT_DBX_TABLE_DATE_RANGE_DAY_DISTIANCE_INPUT_CELL_COMPONENT_CONFIG);
  }

  pickerOpened() {
    this._pickerOpened.next(true);
  }

  pickerClosed() {
    this._pickerOpened.next(false);
  }
}

export function dbxTableDateRangeDayDistanceInputCellInput(componentConfig?: DbxTableDateRangeDayDistanceInputCellInputComponentConfig): DbxInjectionComponentConfig<DbxTableDateRangeDayDistanceInputCellInputComponent> {
  const config: DbxInjectionComponentConfig<DbxTableDateRangeDayDistanceInputCellInputComponent> = {
    componentClass: DbxTableDateRangeDayDistanceInputCellInputComponent,
    init: (x) => {
      x.config = componentConfig;
    }
  };

  return config;
}
