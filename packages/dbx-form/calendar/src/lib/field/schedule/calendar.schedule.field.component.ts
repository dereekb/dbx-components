import { AbstractControl, FormGroup } from '@angular/forms';
import { CompactContextStore } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { ArrayOrValue, type Maybe } from '@dereekb/util';
import { FieldType } from '@ngx-formly/material';
import { BehaviorSubject, distinctUntilChanged, map, shareReplay, startWith, Subscription, switchMap } from 'rxjs';
import { filterMaybe, ObservableOrValue, SubscriptionObject, asObservable } from '@dereekb/rxjs';
import { DateRange, TimezoneString, isSameDateCellScheduleDateRange, DateCellScheduleDateFilterConfig, DateCellScheduleDayCode, DateOrDateRangeOrDateCellIndexOrDateCellRange } from '@dereekb/date';
import { CalendarScheduleSelectionState, DbxCalendarScheduleSelectionStore } from '../../calendar.schedule.selection.store';
import { provideCalendarScheduleSelectionStoreIfParentIsUnavailable } from '../../calendar.schedule.selection.store.provide';
import { MatFormFieldAppearance } from '@angular/material/form-field';
import { DbxScheduleSelectionCalendarDatePopupContentConfig } from '../../calendar.schedule.selection.dialog.component';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxScheduleSelectionCalendarDateDialogButtonComponent } from '../../calendar.schedule.selection.dialog.button.component';
import { DbxScheduleSelectionCalendarDateRangeComponent } from '../../calendar.schedule.selection.range.component';

export interface DbxFormCalendarDateCellScheduleRangeFieldProps extends Pick<FormlyFieldProps, 'label' | 'description' | 'readonly' | 'required'>, Pick<CalendarScheduleSelectionState, 'computeSelectionResultRelativeToFilter' | 'initialSelectionState'>, Partial<Pick<CalendarScheduleSelectionState, 'cellContentFactory'>> {
  readonly appearance?: MatFormFieldAppearance;
  /**
   * Whether or not to allow inputting custom text into the picker.
   *
   * If false, when the input text is picked the date picker will open.
   *
   * Is false by default.
   */
  readonly allowTextInput?: boolean;
  /**
   * Whether or not to hide the customize button. Defaults to false.
   */
  readonly hideCustomize?: boolean;
  /**
   * Whether or not to allow customizing before picking a date range to customize.
   *
   * Defaults to false.
   */
  readonly allowCustomizeWithoutDateRange?: boolean;
  /**
   * (Optional) Timezone to use for the output start date.
   *
   * If a filter is provided, this timezone overrides the filter's timezone output.
   */
  readonly outputTimezone?: ObservableOrValue<Maybe<TimezoneString>>;
  /**
   * (Optional) Default schedule days to allow.
   */
  readonly defaultScheduleDays?: ObservableOrValue<Maybe<Iterable<DateCellScheduleDayCode>>>;
  /**
   * Optional min/max date range to filter on. Works in conjuction with the filter.
   */
  readonly minMaxDateRange?: ObservableOrValue<Maybe<Partial<DateRange>>>;
  /**
   * (Optional) Observable with a filter value to apply to the date range.
   */
  readonly filter?: ObservableOrValue<Maybe<DateCellScheduleDateFilterConfig>>;
  /**
   * (Optional) Observable with days and values to exclude from the date range.
   */
  readonly exclusions?: ObservableOrValue<Maybe<ArrayOrValue<DateOrDateRangeOrDateCellIndexOrDateCellRange>>>;
  /**
   * Custom dialog content config for the popup
   */
  readonly dialogContentConfig?: Maybe<DbxScheduleSelectionCalendarDatePopupContentConfig>;
  /**
   * Custom details config for the date range
   */
  readonly customDetailsConfig?: Maybe<DbxInjectionComponentConfig>;
}

@Component({
  template: `
    <div class="dbx-schedule-selection-field">
      <dbx-schedule-selection-calendar-date-range [openPickerOnTextClick]="openPickerOnTextClick" [showCustomize]="showCustomize" [required]="required" [disabled]="isReadonlyOrDisabled" [label]="label" [hint]="description">
        <dbx-schedule-selection-calendar-date-dialog-button customizeButton [disabled]="disabledSignal()" [contentConfig]="dialogContentConfig"></dbx-schedule-selection-calendar-date-dialog-button>
        <dbx-injection [config]="customDetailsConfig"></dbx-injection>
      </dbx-schedule-selection-calendar-date-range>
    </div>
  `,
  providers: [provideCalendarScheduleSelectionStoreIfParentIsUnavailable()],
  imports: [DbxInjectionComponent, DbxScheduleSelectionCalendarDateRangeComponent, DbxScheduleSelectionCalendarDateDialogButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFormCalendarDateScheduleRangeFieldComponent<T extends DbxFormCalendarDateCellScheduleRangeFieldProps = DbxFormCalendarDateCellScheduleRangeFieldProps> extends FieldType<FieldTypeConfig<T>> implements OnInit, OnDestroy {
  readonly compact = inject(CompactContextStore, { optional: true });

  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  private readonly _syncSub = new SubscriptionObject();
  private readonly _valueSub = new SubscriptionObject();
  private readonly _timezoneSub = new SubscriptionObject();
  private readonly _minMaxDateRangeSub = new SubscriptionObject();
  private readonly _defaultWeekSub = new SubscriptionObject();
  private readonly _filterSub = new SubscriptionObject();
  private readonly _exclusionsSub = new SubscriptionObject();

  private readonly _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  readonly value$ = this.formControl$.pipe(
    switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
    shareReplay(1)
  );

  readonly disableCustomize$ = this.value$.pipe(
    map((x) => (this.allowCustomizeWithoutDateRange ? false : !x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly disabledSignal = toSignal(this.disableCustomize$);

  get formGroupName(): string {
    return this.field.key as string;
  }

  get formGroup(): FormGroup {
    return this.form as FormGroup;
  }

  get label(): Maybe<string> {
    return this.field.props?.label;
  }

  get description(): Maybe<string> {
    return this.props.description;
  }

  get isReadonlyOrDisabled() {
    return this.props.readonly || this.disabled;
  }

  get openPickerOnTextClick() {
    return this.props.allowTextInput !== true; // Opposite of allowTextInput
  }

  get allowCustomizeWithoutDateRange() {
    return this.props.allowCustomizeWithoutDateRange ?? false;
  }

  get showCustomize() {
    return !this.props.hideCustomize;
  }

  get defaultScheduleDays() {
    return this.props.defaultScheduleDays;
  }

  get minMaxDateRange() {
    return this.props.minMaxDateRange;
  }

  get filter() {
    return this.props.filter;
  }

  get exclusions() {
    return this.props.exclusions;
  }

  get outputTimezone() {
    return this.props.outputTimezone;
  }

  get initialSelectionState() {
    return this.props.initialSelectionState;
  }

  get computeSelectionResultRelativeToFilter() {
    return this.props.computeSelectionResultRelativeToFilter;
  }

  get dialogContentConfig() {
    return this.props.dialogContentConfig;
  }

  get customDetailsConfig() {
    return this.props.customDetailsConfig;
  }

  get cellContentFactory() {
    return this.props.cellContentFactory;
  }

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);

    this._syncSub.subscription = this.value$.pipe(distinctUntilChanged(isSameDateCellScheduleDateRange)).subscribe((x) => {
      this.dbxCalendarScheduleSelectionStore.setDateScheduleRangeValue(x);
    });

    this._valueSub.subscription = this.dbxCalendarScheduleSelectionStore.currentDateCellScheduleRangeValue$.subscribe((x) => {
      this.formControl.setValue(x);
    });

    const { outputTimezone, minMaxDateRange, filter, exclusions, defaultScheduleDays } = this;

    if (filter != null) {
      this._filterSub.subscription = this.dbxCalendarScheduleSelectionStore.setFilter(asObservable(filter)) as Subscription;
    }

    if (defaultScheduleDays != null) {
      this._defaultWeekSub.subscription = this.dbxCalendarScheduleSelectionStore.setDefaultScheduleDays(asObservable(defaultScheduleDays)) as Subscription;
    }

    if (minMaxDateRange != null) {
      this._minMaxDateRangeSub.subscription = this.dbxCalendarScheduleSelectionStore.setMinMaxDateRange(asObservable(minMaxDateRange)) as Subscription;
    }

    if (exclusions != null) {
      this._exclusionsSub.subscription = this.dbxCalendarScheduleSelectionStore.setExclusions(asObservable(exclusions)) as Subscription;
    }

    if (outputTimezone != null) {
      this.dbxCalendarScheduleSelectionStore.setOutputTimezone(asObservable(this.outputTimezone));
    }

    if (this.initialSelectionState !== undefined) {
      this.dbxCalendarScheduleSelectionStore.setInitialSelectionState(this.initialSelectionState);
    }

    if (this.computeSelectionResultRelativeToFilter != null) {
      this.dbxCalendarScheduleSelectionStore.setComputeSelectionResultRelativeToFilter(this.computeSelectionResultRelativeToFilter);
    }

    if (this.cellContentFactory != null) {
      this.dbxCalendarScheduleSelectionStore.setCellContentFactory(this.cellContentFactory);
    }
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._syncSub.destroy();
    this._valueSub.destroy();
    this._filterSub.destroy();
    this._timezoneSub.destroy();
    this._minMaxDateRangeSub.destroy();
    this._exclusionsSub.destroy();
    this._formControlObs.complete();
  }
}
