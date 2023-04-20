import { AbstractControl, FormGroup } from '@angular/forms';
import { CompactContextStore } from '@dereekb/dbx-web';
import { Component, NgZone, OnDestroy, OnInit, Optional } from '@angular/core';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { AllOrNoneSelection, Maybe } from '@dereekb/util';
import { FieldType } from '@ngx-formly/material';
import { BehaviorSubject, distinctUntilChanged, shareReplay, startWith, Subscription, switchMap } from 'rxjs';
import { filterMaybe, ObservableOrValue, SubscriptionObject, asObservable } from '@dereekb/rxjs';
import { DateScheduleDateFilterConfig, isSameDateScheduleRange } from '@dereekb/date';
import { CalendarScheduleSelectionState, DbxCalendarScheduleSelectionStore } from '../../calendar.schedule.selection.store';
import { provideCalendarScheduleSelectionStoreIfParentIsUnavailable } from '../../calendar.schedule.selection.store.provide';
import { MatFormFieldAppearance } from '@angular/material/form-field';

export interface DbxFormCalendarDateScheduleRangeFieldProps extends Pick<FormlyFieldProps, 'label' | 'description' | 'readonly' | 'required'>, Pick<CalendarScheduleSelectionState, 'computeSelectionResultRelativeToFilter' | 'initialSelectionState'> {
  appearance?: MatFormFieldAppearance;
  hideCustomize?: boolean;
  filter?: ObservableOrValue<Maybe<DateScheduleDateFilterConfig>>;
}

@Component({
  template: `
    <div class="dbx-schedule-selection-field">
      <dbx-schedule-selection-calendar-date-range [showCustomize]="showCustomize" [required]="required" [disabled]="isReadonlyOrDisabled" [label]="label" [hint]="description">
        <dbx-schedule-selection-calendar-date-dialog-button customizeButton></dbx-schedule-selection-calendar-date-dialog-button>
      </dbx-schedule-selection-calendar-date-range>
    </div>
  `,
  providers: [provideCalendarScheduleSelectionStoreIfParentIsUnavailable()]
})
export class DbxFormCalendarDateScheduleRangeFieldComponent<T extends DbxFormCalendarDateScheduleRangeFieldProps = DbxFormCalendarDateScheduleRangeFieldProps> extends FieldType<FieldTypeConfig<T>> implements OnInit, OnDestroy {
  private _syncSub = new SubscriptionObject();
  private _valueSub = new SubscriptionObject();
  private _filterSub = new SubscriptionObject();

  private _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  readonly value$ = this.formControl$.pipe(
    switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
    shareReplay(1)
  );

  constructor(@Optional() readonly compact: CompactContextStore, readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore, readonly ngZone: NgZone) {
    super();
  }

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

  get showCustomize() {
    return !this.props.hideCustomize;
  }

  get filter() {
    return this.props.filter;
  }

  get initialSelectionState() {
    return this.props.initialSelectionState;
  }

  get computeSelectionResultRelativeToFilter() {
    return this.props.computeSelectionResultRelativeToFilter;
  }

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);

    this._syncSub.subscription = this.value$.pipe(distinctUntilChanged(isSameDateScheduleRange)).subscribe((x) => {
      this.dbxCalendarScheduleSelectionStore.setDateScheduleRangeValue(x);
    });

    this._valueSub.subscription = this.dbxCalendarScheduleSelectionStore.currentDateScheduleRangeValue$.subscribe((x) => {
      this.formControl.setValue(x);
    });

    const filter = this.filter;

    if (filter != null) {
      this._filterSub.subscription = this.dbxCalendarScheduleSelectionStore.setFilter(asObservable(filter)) as Subscription;
    }

    if (this.initialSelectionState !== undefined) {
      this.dbxCalendarScheduleSelectionStore.setInitialSelectionState(this.initialSelectionState);
    }

    if (this.computeSelectionResultRelativeToFilter != null) {
      this.dbxCalendarScheduleSelectionStore.setComputeSelectionResultRelativeToFilter(this.computeSelectionResultRelativeToFilter);
    }
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._syncSub.destroy();
    this._valueSub.destroy();
    this._formControlObs.complete();
    this._filterSub.destroy();
  }
}
