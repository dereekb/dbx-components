import { ChangeDetectionStrategy, Component, Injectable, inject, signal, computed } from '@angular/core';
import { DateRangeDayDistanceInput, isSameDateDay } from '@dereekb/date';
import { DbxTableStore } from '../table.store';
import { MatDateRangeSelectionStrategy, DateRange, MAT_DATE_RANGE_SELECTION_STRATEGY, MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter } from '@angular/material/core';
import { Days, type Maybe } from '@dereekb/util';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { SubscriptionObject } from '@dereekb/rxjs';
import { addDays, format as formatDate } from 'date-fns';
import { distinctUntilChanged, filter, startWith, throttleTime } from 'rxjs';
import { cleanSubscription, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { MatButtonModule } from '@angular/material/button';

@Injectable()
export class DbxTableDateRangeDayDistanceInputCellInputRangeSelectionStrategy<D> implements MatDateRangeSelectionStrategy<D> {
  private readonly _dateAdapter = inject(DateAdapter<D>);
  private readonly dbxTableDateRangeDayDistanceInputCellInputComponent = inject(DbxTableDateRangeDayDistanceInputCellInputComponent);

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
  readonly buttonFormat?: string;
  /**
   * Distance from the start to span.
   */
  readonly daysDistance: Days;
  readonly minDate?: Maybe<Date>;
  readonly maxDate?: Maybe<Date>;
}

export const DEFAULT_DBX_TABLE_DATE_RANGE_DAY_DISTIANCE_INPUT_CELL_COMPONENT_CONFIG = { daysDistance: 6 };

export const DEFAULT_DBX_TABLE_DATE_RANGE_DAY_BUTTON_FORMAT = 'MMM dd';

/**
 * Cell input for a DateRangeDayDistanceInput value.
 */
@Component({
  template: `
    <div class="dbx-table-date-range-distance-input-cell">
      <mat-date-range-input class="dbx-table-date-range-distance-input" [min]="minDateSignal()" [max]="maxDateSignal()" [formGroup]="range" [rangePicker]="picker">
        <input matStartDate formControlName="start" placeholder="Start date" />
        <input matEndDate formControlName="end" placeholder="End date" />
      </mat-date-range-input>
      <button mat-stroked-button color="primary" (click)="picker.open()">{{ dateRangeStringSignal() }}</button>
      <mat-date-range-picker #picker (opened)="pickerOpened()" (closed)="pickerClosed()"></mat-date-range-picker>
    </div>
  `,
  providers: [
    {
      provide: MAT_DATE_RANGE_SELECTION_STRATEGY,
      useClass: DbxTableDateRangeDayDistanceInputCellInputRangeSelectionStrategy
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDatepickerModule, ReactiveFormsModule, MatButtonModule]
})
export class DbxTableDateRangeDayDistanceInputCellInputComponent {
  readonly tableStore = inject(DbxTableStore<DateRangeDayDistanceInput>);

  private readonly _syncSub = new SubscriptionObject();
  private readonly _valueSub = new SubscriptionObject();

  private readonly _pickerOpenedSignal = signal<boolean>(false);
  private readonly _configSignal = signal<DbxTableDateRangeDayDistanceInputCellInputComponentConfig>(DEFAULT_DBX_TABLE_DATE_RANGE_DAY_DISTIANCE_INPUT_CELL_COMPONENT_CONFIG);

  readonly range = new FormGroup({
    start: new FormControl<Maybe<Date>>(null),
    end: new FormControl<Maybe<Date>>(null)
  });

  readonly pickerOpened$ = this.range.valueChanges.pipe(startWith(this.range.value));

  readonly minDateSignal = computed(() => this._configSignal().minDate ?? null);
  readonly maxDateSignal = computed(() => this._configSignal().maxDate ?? null);
  readonly buttonFormatSignal = computed(() => this._configSignal().buttonFormat ?? DEFAULT_DBX_TABLE_DATE_RANGE_DAY_BUTTON_FORMAT);

  readonly rangeValue$ = this.range.valueChanges.pipe(startWith(this.range.value));
  readonly dateRangeStringSignal = computed(() => {
    const buttonFormat = this.buttonFormatSignal();
    const { start, end } = this.range.value;

    if (start && end) {
      return `${formatDate(start, buttonFormat)} - ${formatDate(end, buttonFormat)}`;
    } else {
      return `Select Date`;
    }
  });

  constructor() {
    cleanSubscription(
      this.tableStore.input$.subscribe((x) => {
        const start = x?.date ?? null;
        const end = start ? addDays(start, this.daysDistance) : undefined;

        this.range.setValue({
          start,
          end
        });
      })
    );

    cleanSubscription(
      this.rangeValue$
        .pipe(
          filter((x) => Boolean(x.start)),
          distinctUntilChanged((a, b) => isSameDateDay(a?.start, b?.start)),
          throttleTime(100, undefined, { trailing: true })
        )
        .subscribe((x) => {
          if (x.start) {
            this.tableStore.setInput({ date: x.start, distance: this.daysDistance });
          }
        })
    );
  }

  get daysDistance() {
    return this._configSignal().daysDistance;
  }

  get config() {
    return this._configSignal();
  }

  set config(config: Maybe<DbxTableDateRangeDayDistanceInputCellInputComponentConfig>) {
    this._configSignal.set(config || DEFAULT_DBX_TABLE_DATE_RANGE_DAY_DISTIANCE_INPUT_CELL_COMPONENT_CONFIG);
  }

  pickerOpened() {
    this._pickerOpenedSignal.set(true);
  }

  pickerClosed() {
    this._pickerOpenedSignal.set(false);
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
