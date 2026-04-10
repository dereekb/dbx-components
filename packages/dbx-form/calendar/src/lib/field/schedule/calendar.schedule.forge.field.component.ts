import { ChangeDetectionStrategy, Component, type OnDestroy, computed, effect, inject, input, type InputSignal, type Signal } from '@angular/core';
import { type ArrayOrValue, type TimezoneString, type Maybe } from '@dereekb/util';
import { type Subscription } from 'rxjs';
import { type ObservableOrValue, SubscriptionObject, asObservable } from '@dereekb/rxjs';
import { isSameDateCellScheduleDateRange, type DateRange, type DateCellScheduleDateFilterConfig, type DateCellScheduleDayCode, type DateOrDateRangeOrDateCellIndexOrDateCellRange } from '@dereekb/date';
import { type CalendarScheduleSelectionState, DbxCalendarScheduleSelectionStore } from '../../calendar.schedule.selection.store';
import { provideCalendarScheduleSelectionStoreIfParentIsUnavailable } from '../../calendar.schedule.selection.store.provide';
import { type DbxScheduleSelectionCalendarDatePopupContentConfig } from '../../calendar.schedule.selection.dialog.component';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { toObservable } from '@angular/core/rxjs-interop';
import { DbxScheduleSelectionCalendarDateDialogButtonComponent } from '../../calendar.schedule.selection.dialog.button.component';
import { DbxScheduleSelectionCalendarDateRangeComponent } from '../../calendar.schedule.selection.range.component';
import type { FieldTree } from '@angular/forms/signals';
import { type DynamicText, type FieldMeta, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs } from '@ng-forge/dynamic-forms/integration';
import { distinctUntilChanged, skip } from 'rxjs';
import { CompactContextStore } from '@dereekb/dbx-web';

/**
 * Custom props for the forge calendar date schedule range field.
 */
export interface ForgeCalendarDateScheduleRangeFieldComponentProps extends Pick<CalendarScheduleSelectionState, 'computeSelectionResultRelativeToFilter' | 'initialSelectionState'>, Partial<Pick<CalendarScheduleSelectionState, 'cellContentFactory'>> {
  readonly label?: string;
  readonly description?: string;
  readonly appearance?: string;
  readonly allowTextInput?: boolean;
  readonly hideCustomize?: boolean;
  readonly allowCustomizeWithoutDateRange?: boolean;
  readonly outputTimezone?: ObservableOrValue<Maybe<TimezoneString>>;
  readonly defaultScheduleDays?: ObservableOrValue<Maybe<Iterable<DateCellScheduleDayCode>>>;
  readonly minMaxDateRange?: ObservableOrValue<Maybe<Partial<DateRange>>>;
  readonly filter?: ObservableOrValue<Maybe<DateCellScheduleDateFilterConfig>>;
  readonly exclusions?: ObservableOrValue<Maybe<ArrayOrValue<DateOrDateRangeOrDateCellIndexOrDateCellRange>>>;
  readonly dialogContentConfig?: Maybe<DbxScheduleSelectionCalendarDatePopupContentConfig>;
  readonly customDetailsConfig?: Maybe<DbxInjectionComponentConfig>;
}

/**
 * Forge custom field component for calendar date schedule range selection.
 *
 * This is the forge equivalent of {@link DbxFormCalendarDateScheduleRangeFieldComponent}.
 * It bridges ng-forge Signal Forms with the {@link DbxCalendarScheduleSelectionStore}.
 *
 * Registered as ng-forge type 'dbx-forge-calendar-date-schedule-range'.
 */
@Component({
  selector: 'dbx-forge-calendar-date-schedule-range-field',
  template: `
    <div class="dbx-schedule-selection-field">
      <dbx-schedule-selection-calendar-date-range [openPickerOnTextClick]="openPickerOnTextClickSignal()" [showCustomize]="showCustomizeSignal()" [required]="isRequiredSignal()" [disabled]="isReadonlyOrDisabledSignal()" [label]="labelTextSignal()" [hint]="descriptionSignal()">
        <dbx-schedule-selection-calendar-date-dialog-button customizeButton [disabled]="disableCustomizeSignal()" [contentConfig]="dialogContentConfigSignal()"></dbx-schedule-selection-calendar-date-dialog-button>
        <dbx-injection [config]="customDetailsConfigSignal()"></dbx-injection>
      </dbx-schedule-selection-calendar-date-range>
    </div>
  `,
  providers: [provideCalendarScheduleSelectionStoreIfParentIsUnavailable()],
  imports: [DbxInjectionComponent, DbxScheduleSelectionCalendarDateRangeComponent, DbxScheduleSelectionCalendarDateDialogButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ForgeCalendarDateScheduleRangeFieldComponent implements OnDestroy {
  readonly compact = inject(CompactContextStore, { optional: true });
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<unknown>> = input.required<FieldTree<unknown>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<ForgeCalendarDateScheduleRangeFieldComponentProps | undefined> = input<ForgeCalendarDateScheduleRangeFieldComponentProps | undefined>();
  readonly meta: InputSignal<FieldMeta | undefined> = input<FieldMeta | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  // Subscription management
  private readonly _syncSub = new SubscriptionObject();
  private readonly _valueSub = new SubscriptionObject();
  private readonly _timezoneSub = new SubscriptionObject();
  private readonly _minMaxDateRangeSub = new SubscriptionObject();
  private readonly _defaultWeekSub = new SubscriptionObject();
  private readonly _filterSub = new SubscriptionObject();
  private readonly _exclusionsSub = new SubscriptionObject();

  // Field value signal (double-call pattern: field()() to get FieldState)
  readonly fieldValue = computed(() => {
    const state = this.field()?.() as any;
    return state?.value?.() as unknown;
  });

  readonly isDisabled = computed(() => {
    const state = this.field()?.() as any;
    return (state?.disabled?.() as boolean) ?? false;
  });

  readonly isRequiredSignal = computed(() => {
    const state = this.field()?.() as any;
    return (state?.required?.() as boolean) ?? false;
  });

  // Computed props
  readonly labelTextSignal: Signal<Maybe<string>> = computed(() => this.props()?.label);
  readonly descriptionSignal: Signal<Maybe<string>> = computed(() => this.props()?.description);
  readonly isReadonlyOrDisabledSignal = computed(() => (this.props() as any)?.readonly || this.isDisabled());
  readonly openPickerOnTextClickSignal = computed(() => this.props()?.allowTextInput !== true);
  readonly showCustomizeSignal = computed(() => !this.props()?.hideCustomize);
  readonly dialogContentConfigSignal = computed(() => this.props()?.dialogContentConfig);
  readonly customDetailsConfigSignal = computed(() => this.props()?.customDetailsConfig);
  readonly allowCustomizeWithoutDateRangeSignal = computed(() => this.props()?.allowCustomizeWithoutDateRange ?? false);

  readonly disableCustomizeSignal = computed(() => {
    if (this.allowCustomizeWithoutDateRangeSignal()) {
      return false;
    }
    return !this.fieldValue();
  });

  private _setFieldValue(value: unknown): void {
    try {
      const state = this.field()?.() as any;
      if (state?.value?.set) {
        state.value.set(value);
      }
    } catch (e) {
      // field input may not be available yet (NG0950) during early store emissions
    }
  }

  constructor() {
    // Convert field value to observable for store sync
    const fieldValue$ = toObservable(this.fieldValue);

    // Sync field value → store (skip initial emission)
    this._syncSub.subscription = fieldValue$
      .pipe(
        skip(1),
        distinctUntilChanged((a, b) => isSameDateCellScheduleDateRange(a as any, b as any))
      )
      .subscribe((x) => {
        this.dbxCalendarScheduleSelectionStore.setDateScheduleRangeValue(x as any);
      });

    // Sync store → field value
    this._valueSub.subscription = this.dbxCalendarScheduleSelectionStore.currentDateCellScheduleRangeValue$.subscribe((x) => {
      this._setFieldValue(x);
    });

    // Set up store configuration from props (runs once on init via effect)
    effect(() => {
      const p = this.props();
      if (!p) {
        return;
      }

      const { outputTimezone, minMaxDateRange, filter, exclusions, defaultScheduleDays, initialSelectionState, computeSelectionResultRelativeToFilter, cellContentFactory } = p;

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
        this.dbxCalendarScheduleSelectionStore.setOutputTimezone(asObservable(outputTimezone));
      }

      if (initialSelectionState !== undefined) {
        this.dbxCalendarScheduleSelectionStore.setInitialSelectionState(initialSelectionState);
      }

      if (computeSelectionResultRelativeToFilter != null) {
        this.dbxCalendarScheduleSelectionStore.setComputeSelectionResultRelativeToFilter(computeSelectionResultRelativeToFilter);
      }

      if (cellContentFactory != null) {
        this.dbxCalendarScheduleSelectionStore.setCellContentFactory(cellContentFactory);
      }
    });
  }

  ngOnDestroy(): void {
    this._syncSub.destroy();
    this._valueSub.destroy();
    this._filterSub.destroy();
    this._timezoneSub.destroy();
    this._minMaxDateRangeSub.destroy();
    this._defaultWeekSub.destroy();
    this._exclusionsSub.destroy();
  }
}

/**
 * Custom mapper for the forge calendar date schedule range field.
 *
 * Uses the standard buildValueFieldInputs to bridge the ng-forge field definition
 * to the component's input signals.
 */
export function calendarDateScheduleRangeFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
