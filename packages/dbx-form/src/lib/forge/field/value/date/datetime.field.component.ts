import { Component, ChangeDetectionStrategy, input, computed, effect, type Signal, type InputSignal, DestroyRef, inject, signal, untracked } from '@angular/core';
import { type AbstractControl, FormControl, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule, type MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { type DynamicText, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES, FIELD_SIGNAL_CONTEXT, type FieldSignalContext } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG } from '@ng-forge/dynamic-forms-material';
import type { FieldTree } from '@angular/forms/signals';
import { type Maybe, type Milliseconds, type TimezoneString, type ReadableTimeString, type DateOrDayString, type ArrayOrValue, asArray, filterMaybeArrayValues } from '@dereekb/util';
import { safeToJsDate, dateTimezoneUtcNormal, type DateTimezoneUtcNormalInstance, guessCurrentTimezone, toLocalReadableTimeString, getTimezoneAbbreviation, isSameDateHoursAndMinutes, isSameDateDay, DateTimeMinuteInstance, dateFromLogicalDate, dateTimeMinuteWholeDayDecisionFunction, toJsDayDate, isSameDate } from '@dereekb/date';
import { type ObservableOrValueGetter, asObservableFromGetter, SubscriptionObject, switchMapMaybeDefault, filterMaybe, skipAllInitialMaybe } from '@dereekb/rxjs';
import { type Observable, of, BehaviorSubject, Subject, combineLatest, interval, type Subscription } from 'rxjs';
import { switchMap, shareReplay, map, startWith, tap, distinctUntilChanged, debounceTime, throttleTime, combineLatestWith, filter, first, skip } from 'rxjs/operators';
import { startOfDay } from 'date-fns';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxDateTimeValueMode, dbxDateTimeInputValueParseFactory, dbxDateTimeOutputValueFactory, dbxDateTimeIsSameDateTimeFieldValue } from '../../../../formly/field/value/date/date.value';
import { DbxDateTimeFieldTimeMode, type DbxDateTimePickerConfiguration, type DbxDateTimeFieldSyncType } from '../../../../formly/field/value/date/datetime.field.component';
import { type DateTimePresetConfiguration, type DateTimePreset, dateTimePreset } from '../../../../formly/field/value/date/datetime';
import { DbxDateTimeFieldMenuPresetsService } from '../../../../formly/field/value/date/datetime.field.service';
import { DateDistancePipe, TimeDistancePipe, GetValuePipe } from '@dereekb/dbx-core';
import { type ErrorStateMatcher } from '@angular/material/core';
import { toggleDisableFormControl } from '../../../../form/form';
import { forgeFieldDisabled } from '../../field.disabled';
import { type DbxForgeDateTimeSyncField } from './datetime.field';
import { buildCombinedDateTime, applyTimeOffset, mergePickerConfig, filterPresets, computeErrorMessage, computeDateKeyboardStep, computeTimeKeyboardStep, navigateDate, type DateTimeCalcInput } from './datetime.calc';

/**
 * Custom props for the forge date-time field.
 *
 * Full parity with formly `DbxDateTimeFieldProps`.
 */
export interface DbxForgeDateTimeFieldComponentProps {
  readonly timeOnly?: boolean;
  readonly timeMode?: DbxDateTimeFieldTimeMode;
  readonly valueMode?: DbxDateTimeValueMode;
  readonly dateLabel?: string;
  readonly timeLabel?: string;
  readonly allDayLabel?: string;
  readonly atTimeLabel?: string;
  readonly minDate?: Date | string;
  readonly maxDate?: Date | string;
  readonly timezone?: Maybe<ObservableOrValueGetter<Maybe<TimezoneString>>>;
  readonly showTimezone?: Maybe<boolean>;
  readonly pickerConfig?: ObservableOrValueGetter<DbxDateTimePickerConfiguration>;
  readonly hideDateHint?: boolean;
  readonly hideDatePicker?: boolean;
  readonly alwaysShowDateInput?: boolean;
  readonly showClearButton?: Maybe<boolean>;
  readonly autofillDateWhenTimeIsPicked?: boolean;
  readonly presets?: ObservableOrValueGetter<DateTimePresetConfiguration[]>;
  readonly timeDate?: Maybe<ObservableOrValueGetter<Maybe<DateOrDayString>>>;
  readonly fullDayFieldName?: string;
  readonly fullDayInUTC?: boolean;
  readonly minuteStep?: Maybe<number>;
  readonly inputOutputDebounceTime?: Milliseconds;
  readonly appearance?: 'fill' | 'outline';
  readonly hint?: DynamicText;
  readonly getSyncFieldsObs?: () => Observable<ArrayOrValue<DbxForgeDateTimeSyncField>>;
  /**
   * @deprecated Use `timeMode` instead.
   */
  readonly showTime?: boolean;
}

// MARK: Time Output Constants
const TIME_OUTPUT_THROTTLE_TIME: Milliseconds = 10;

/**
 * Forge date-time field component.
 *
 * Hybrid signal + observable architecture: uses signals for primary/derived state and template
 * bindings, with observable pipelines for timing-sensitive operations (throttling, debouncing,
 * display refresh). Reuses the same value parsing/output utilities as the formly implementation.
 *
 * Registered as custom field type 'datetime' via `forge.providers.ts`.
 */
@Component({
  selector: 'dbx-forge-datetime-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, ReactiveFormsModule, FormsModule, NgTemplateOutlet, DatePipe, DateDistancePipe, TimeDistancePipe, GetValuePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './datetime.field.component.html',
  styles: `
    .dbx-forge-datetime-field-wrapper {
      width: 100%;
    }
    .dbx-forge-datetime-inputs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: flex-start;
      width: 100%;
    }
    .dbx-forge-datetime-col {
      flex: 1 1 0%;
      min-width: 180px;
    }
    .dbx-forge-datetime-col-full {
      flex: 1 1 100%;
    }
    .dbx-forge-datetime-col-field {
      width: 100%;
    }
    .dbx-forge-field-label {
      font-weight: 500;
    }
    .dbx-forge-required-marker {
      color: var(--mat-sys-error, red);
    }
    .dbx-forge-datetime-desc {
      font-size: 12px;
      margin-top: 0;
    }
    .dbx-forge-add-time-wrapper {
      display: flex;
      align-items: center;
      min-height: 56px;
    }
    .dbx-forge-datetime-timezone {
      padding: 0 6px;
      pointer-events: none;
    }
    .dbx-forge-datetime-hint {
      padding: 0 2px;
    }
    .dbx-forge-datetime-error {
      padding: 0 2px;
    }
    @media (max-width: 599px) {
      .dbx-forge-datetime-inputs {
        flex-direction: column;
      }
      .dbx-forge-datetime-col {
        flex: 1 1 100%;
      }
    }
  `
})
export class DbxForgeDateTimeFieldComponent {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly presetsService = inject(DbxDateTimeFieldMenuPresetsService, { optional: true });
  private readonly fieldSignalContext = inject<FieldSignalContext>(FIELD_SIGNAL_CONTEXT);

  // MARK: ng-forge ValueFieldComponent inputs
  readonly field: InputSignal<FieldTree<unknown>> = input.required<FieldTree<unknown>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<DbxForgeDateTimeFieldComponentProps | undefined> = input<DbxForgeDateTimeFieldComponentProps | undefined>();
  readonly meta: InputSignal<Record<string, unknown> | undefined> = input<Record<string, unknown> | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  // MARK: Form controls
  readonly dateCtrl = new FormControl<Maybe<Date>>(null);
  readonly timeCtrl = new FormControl<Maybe<ReadableTimeString>>(null, {
    validators: [Validators.pattern(/^(now)$|^([0-9]|(0[0-9])|(1[0-9])|(2[0-3]))(:)?([0-5][0-9])?(\s)?([apAP][Mm])?(\\s)*$/)]
  });

  // MARK: Internal signals
  private readonly _fullDay = signal(false);
  private readonly _timezone = signal<Maybe<TimezoneString>>(undefined);
  private readonly _pickerConfig = signal<Maybe<DbxDateTimePickerConfiguration>>(undefined);
  private readonly _timeDate = signal<Maybe<Date>>(undefined);
  private readonly _presetConfigs = signal<DateTimePresetConfiguration[]>([]);
  private readonly _isCleared = signal(false);
  private readonly _isTimeInputFocused = signal(false);

  // MARK: Subscription management
  private readonly _sub = new SubscriptionObject();
  private readonly _valueSub = new SubscriptionObject();
  private readonly _autoFillDateSync = new SubscriptionObject();
  private readonly _resyncTimeInputSub = new SubscriptionObject();
  private _timezoneSub?: Subscription;
  private _pickerConfigSub?: Subscription;
  private _timeDateSub?: Subscription;
  private _presetsSub?: Subscription;

  // MARK: Subjects for event coordination
  private readonly _offset = new BehaviorSubject<number>(0);
  private readonly _updateTime = new Subject<void>();
  private readonly _resyncTimeInput = new Subject<void>();
  private readonly _syncConfigObs = new BehaviorSubject<Maybe<Observable<ArrayOrValue<DbxForgeDateTimeSyncField>>>>(undefined);

  // MARK: Error state matcher
  readonly timeErrorStateMatcher: ErrorStateMatcher = {
    isErrorState: (control: AbstractControl | null) => {
      if (control) {
        return (control.invalid && (control.dirty || control.touched)) || this.hasErrorSignal() === true;
      }
      return false;
    }
  };

  // MARK: Computed signals — derived from props
  readonly fieldLabel = computed(() => {
    const l = this.label();
    return typeof l === 'string' && l ? l : undefined;
  });

  readonly isRequired = computed(() => {
    try {
      const state = this.field()?.() as any;
      return (state?.required?.() as boolean) ?? false;
    } catch {
      return false;
    }
  });

  readonly isDateRequired = computed(() => this.isRequired());

  readonly isTimeRequired = computed(() => this.isRequired() && this.timeMode() === DbxDateTimeFieldTimeMode.REQUIRED);

  readonly description = computed(() => {
    const h = this.props()?.hint;
    return typeof h === 'string' ? h : undefined;
  });

  readonly appearance = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline');

  readonly valueMode = computed(() => this.props()?.valueMode ?? DbxDateTimeValueMode.DATE);

  readonly timeMode = computed<DbxDateTimeFieldTimeMode>(() => {
    const p = this.props();
    if (this.valueMode() === DbxDateTimeValueMode.DAY_STRING) return DbxDateTimeFieldTimeMode.NONE;
    if (p?.timeOnly) return DbxDateTimeFieldTimeMode.REQUIRED;
    if (p?.timeMode) return p.timeMode;
    if (p?.showTime === false) return DbxDateTimeFieldTimeMode.NONE;
    return DbxDateTimeFieldTimeMode.REQUIRED;
  });

  readonly isTimeOnly = computed(() => this.valueMode() === DbxDateTimeValueMode.MINUTE_OF_DAY || this.props()?.timeOnly === true);
  readonly isDateOnly = computed(() => this.timeMode() === DbxDateTimeFieldTimeMode.NONE);
  readonly isFullDay = computed(() => this._fullDay());

  readonly showDateInput = computed(() => !this.isTimeOnly());
  readonly showTimeInput = computed(() => !this._fullDay() && this.timeMode() !== DbxDateTimeFieldTimeMode.NONE);
  readonly showAddTimeButton = computed(() => !this.showTimeInput() && this.timeMode() === DbxDateTimeFieldTimeMode.OPTIONAL);

  readonly dateLabel = computed(() => this.props()?.dateLabel ?? 'Date');
  readonly timeLabel = computed(() => this.props()?.timeLabel ?? 'Time');
  readonly allDayLabel = computed(() => this.props()?.allDayLabel ?? 'All Day');
  readonly atTimeLabel = computed(() => this.props()?.atTimeLabel ?? 'At');
  readonly hideDateHint = computed(() => this.props()?.hideDateHint ?? false);
  readonly hideDatePicker = computed(() => this.props()?.hideDatePicker ?? false);
  readonly showTimezone = computed(() => this.props()?.showTimezone ?? true);
  readonly showClearButton = computed(() => this.props()?.showClearButton !== false);
  readonly minuteStep = computed(() => this.props()?.minuteStep ?? 5);
  readonly alwaysShowDateInput = computed(() => this.props()?.alwaysShowDateInput ?? true);
  readonly autofillDateWhenTimeIsPicked = computed(() => this.props()?.autofillDateWhenTimeIsPicked ?? this.alwaysShowDateInput() === false);

  // MARK: Timezone signals
  readonly resolvedTimezone = computed(() => this._timezone() ?? guessCurrentTimezone());

  readonly timezoneInstance = computed<Maybe<DateTimezoneUtcNormalInstance>>(() => {
    const tz = this.resolvedTimezone();
    return tz ? dateTimezoneUtcNormal({ timezone: tz }) : undefined;
  });

  // MARK: Field value reading
  // FieldTree<unknown> is callable — calling it returns FieldState which has .value, .disabled, etc.
  // We call field()() to first unwrap the InputSignal (→ FieldTree), then call the FieldTree (→ FieldState).
  readonly fieldValue = computed(() => {
    try {
      const state = this.field()?.() as any;
      return state?.value?.() as unknown;
    } catch {
      return undefined;
    }
  });

  readonly isDisabled = forgeFieldDisabled();

  // MARK: Observable pipelines

  // Parse field value to system timezone Date
  readonly fieldValue$ = toObservable(this.fieldValue);

  readonly timezoneInstance$ = toObservable(this.timezoneInstance);

  readonly valueInSystemTimezone$: Observable<Maybe<Date>> = this.fieldValue$.pipe(
    combineLatestWith(this.timezoneInstance$),
    map(([raw, timezoneInstance]) => {
      if (raw == null) return undefined;
      const parser = dbxDateTimeInputValueParseFactory(this.valueMode(), timezoneInstance);
      const result = parser(raw as Maybe<Date | string | number>);
      if (result instanceof Date && isNaN(result.getTime())) return undefined;
      return result;
    }),
    throttleTime(20, undefined, { leading: true, trailing: true }),
    distinctUntilChanged(isSameDateHoursAndMinutes),
    shareReplay(1)
  );

  // Display value with 10-second refresh interval
  readonly refreshInterval$ = interval(10 * 1000);

  readonly displayValue$: Observable<Maybe<Date>> = this.refreshInterval$.pipe(
    startWith(0),
    map(() => new Date().getMinutes()),
    distinctUntilChanged(),
    switchMap(() => this.valueInSystemTimezone$),
    shareReplay(1)
  );

  // Time string from parsed value
  readonly timeString$: Observable<ReadableTimeString | ''> = this.valueInSystemTimezone$.pipe(
    map((x) => (x ? toLocalReadableTimeString(x) : '')),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Date input control value stream
  readonly currentDate$ = this.dateCtrl.valueChanges.pipe(startWith(this.dateCtrl.value), shareReplay(1));
  readonly date$ = this.currentDate$.pipe(filterMaybe(), shareReplay(1));

  // Effective date value: merges date control changes with incoming form value
  readonly dateValue$: Observable<Maybe<Date>> = this.date$.pipe(
    map((x: Maybe<Date>) => (x ? startOfDay(x) : null)),
    distinctUntilChanged<Maybe<Date>>(isSameDateDay),
    shareReplay(1)
  );

  // Time input stream gated by _updateTime subject
  readonly timeInput$: Observable<ReadableTimeString> = this._updateTime.pipe(
    debounceTime(5),
    map(() => this.timeCtrl.value || ''),
    distinctUntilChanged()
  );

  // Resync time input debounced
  readonly resyncTimeInput$ = this._resyncTimeInput.pipe(debounceTime(200), shareReplay(1));

  // Timezone abbreviation
  readonly tzAbbreviation$ = combineLatest([this.currentDate$, toObservable(this.resolvedTimezone), toObservable(this._timeDate)]).pipe(
    map(([date, timezone, timeDate]) => getTimezoneAbbreviation(timezone, timeDate ?? date ?? new Date())),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Observable versions of signals (must be at class level for injection context)
  private readonly _isCleared$ = toObservable(this._isCleared);
  private readonly _timeDate$ = toObservable(this._timeDate);

  readonly isTimeCleared$ = combineLatest([this.currentDate$, toObservable(this._timeDate).pipe(startWith(null)), this._isCleared$]).pipe(
    map(([date, time, isCleared]) => isCleared || Boolean(!date && !time)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Sync config processing
  readonly syncConfigObs$ = this._syncConfigObs.pipe(switchMapMaybeDefault(), shareReplay(1));

  readonly parsedSyncConfigs$ = this.syncConfigObs$.pipe(
    map((x) => {
      if (!x) return [];
      return filterMaybeArrayValues(
        asArray(x).map((syncField) => {
          const form = this.fieldSignalContext.form;
          const siblingTree = (form as any)?.[syncField.syncWith];
          const siblingState = siblingTree?.() as any;
          if (siblingState?.value) {
            return { syncType: syncField.syncType, fieldState: siblingState };
          }
          return undefined;
        })
      );
    }),
    shareReplay(1)
  );

  private _syncConfigValueObs(type: DbxDateTimeFieldSyncType): Observable<Date | null> {
    return this.parsedSyncConfigs$.pipe(
      switchMap((configs) => {
        const config = configs.find((c) => c.syncType === type);
        if (config) {
          // Poll the sibling field's signal value since toObservable() cannot be used
          // inside switchMap (outside injection context).
          return interval(500).pipe(
            startWith(0),
            map(() => {
              const val = config.fieldState.value();
              const date = safeToJsDate(val as any);
              // Reject Invalid Date values (e.g. from empty string sibling fields)
              return date instanceof Date && !isNaN(date.getTime()) ? date : null;
            }),
            distinctUntilChanged()
          );
        }
        return of(null);
      }),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  readonly syncConfigBeforeValue$ = this._syncConfigValueObs('before');
  readonly syncConfigAfterValue$ = this._syncConfigValueObs('after');

  // Picker config merged with sync constraints
  readonly pickerConfig$ = toObservable(this._pickerConfig);

  readonly dateTimePickerConfig$: Observable<Maybe<DbxDateTimePickerConfiguration>> = combineLatest([this.pickerConfig$, this.syncConfigBeforeValue$, this.syncConfigAfterValue$]).pipe(
    map(([config, syncBefore, syncAfter]) => mergePickerConfig(config, syncBefore, syncAfter)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly dateInputMin$: Observable<Date | null> = this.dateTimePickerConfig$.pipe(
    map((x) => (x?.limits?.min ?? null) as Date | null),
    distinctUntilChanged<Date | null>(isSameDate),
    shareReplay(1)
  );

  readonly dateInputMax$: Observable<Date | null> = this.dateTimePickerConfig$.pipe(
    map((x) => (x?.limits?.max ?? null) as Date | null),
    distinctUntilChanged<Date | null>(isSameDate),
    shareReplay(1)
  );

  readonly dateMinAndMaxIsSameDay$: Observable<boolean> = combineLatest([this.dateInputMin$, this.dateInputMax$]).pipe(
    map(([a, b]) => Boolean(a && b) && isSameDateDay(a, b)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly pickerFilter$: Observable<(d: Date | null) => boolean> = this.dateTimePickerConfig$.pipe(
    map((x) => {
      if (x) {
        const fn = dateTimeMinuteWholeDayDecisionFunction(x, false);
        return (d: Date | null) => (d != null ? fn(d) : true);
      }
      return () => true;
    }),
    shareReplay(1)
  );

  // Show date input reactively based on restricted range
  readonly showDateInput$: Observable<boolean> = this.dateMinAndMaxIsSameDay$.pipe(
    map((sameDay) => this.showDateInput() && (this.alwaysShowDateInput() || !sameDay)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Raw datetime calculation
  readonly rawDateTime$: Observable<Maybe<Date>> = combineLatest([this.isTimeOnly() ? of(null) : this.dateValue$, this.timeInput$.pipe(startWith(null)), toObservable(this._fullDay), toObservable(this._timeDate), this.isTimeCleared$]).pipe(
    map(([date, timeString, fullDay, timeDate, isTimeCleared]) => {
      const input: DateTimeCalcInput = {
        dateValue: date,
        timeString,
        isFullDay: fullDay,
        fullDayInUTC: this.props()?.fullDayInUTC ?? false,
        isTimeOnly: this.isTimeOnly(),
        timeMode: this.timeMode(),
        timeDate,
        isCleared: isTimeCleared
      };
      return buildCombinedDateTime(input);
    }),
    distinctUntilChanged(isSameDateHoursAndMinutes),
    shareReplay(1)
  );

  // Time output with offset accumulation and throttling
  readonly timeOutput$: Observable<Maybe<Date>> = combineLatest([this.rawDateTime$, this._offset, this.dateTimePickerConfig$]).pipe(
    throttleTime(TIME_OUTPUT_THROTTLE_TIME, undefined, { leading: false, trailing: true }),
    distinctUntilChanged((current, next) => current[0] === next[0] && next[1] === 0 && current[2] === next[2]),
    tap(([, stepsOffset]) => (stepsOffset ? this._offset.next(0) : 0)),
    map(([date, stepsOffset, config]) => {
      if (date != null && stepsOffset) {
        return applyTimeOffset(date, stepsOffset, this.minuteStep(), config);
      }
      return date;
    }),
    distinctUntilChanged(isSameDateHoursAndMinutes),
    shareReplay(1)
  );

  // Picker instance for validation
  readonly dateTimePickerInstance$ = this.dateTimePickerConfig$.pipe(
    map((config) => new DateTimeMinuteInstance({ ...config, roundDownToMinute: true })),
    shareReplay(1)
  );

  // Presets pipeline
  readonly allPresets$ = toObservable(this._presetConfigs).pipe(
    map((configs) => configs.map(dateTimePreset)),
    shareReplay(1)
  );

  readonly presets$: Observable<DateTimePreset[]> = combineLatest([this.allPresets$, toObservable(this._fullDay)]).pipe(
    switchMap(([allPresets, fullDay]) => {
      if (this.isTimeOnly()) return of(allPresets);
      if (fullDay) return of([]);

      // Use currentDate$ (includes null) so the combineLatest emits even when no date is set.
      // Fall back to timeDate, then today, so presets are always available for time selection.
      return combineLatest([this.currentDate$.pipe(throttleTime(1000, undefined, { leading: true, trailing: true })), this.dateTimePickerConfig$, this._timeDate$.pipe(startWith(undefined))]).pipe(map(([selectedDate, config, timeDate]) => filterPresets(allPresets, selectedDate ?? timeDate ?? startOfDay(new Date()), false, false, config)));
    }),
    shareReplay(1)
  );

  // Error tracking
  readonly hasEmptyDisplayValue$ = this.displayValue$.pipe(
    map((x) => !x),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentErrorMessage$ = toObservable(
    computed(() => {
      const f = this.field()?.() as any;
      if (!f) return undefined;
      const invalid = f.invalid?.() as boolean;
      if (!invalid) return undefined;
      const errors = f.errors?.() as Array<{ type?: string }> | undefined;
      if (!errors || errors.length === 0) return undefined;
      // Convert ValidationError.WithFieldTree[] to a record
      const errorRecord: Record<string, unknown> = {};
      for (const err of errors) {
        if (err.type) errorRecord[err.type] = true;
      }
      return computeErrorMessage(errorRecord, this.isRequired());
    })
  ).pipe(shareReplay(1));

  readonly hasError$ = this.currentErrorMessage$.pipe(
    map((x) => Boolean(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Show clear button
  readonly showClearButton$ = this.hasEmptyDisplayValue$.pipe(
    map((empty) => Boolean(this.showClearButton() && !empty)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: Template signals via toSignal()
  /**
   * Template signal for the date input `[value]` binding.
   *
   * Reads directly from the Signal Forms field value so it updates on both
   * inbound sync (form source) and user picks. Returns null when cleared.
   */
  readonly dateValueSignal = computed(() => {
    if (this._isCleared()) return null;
    const raw = this.fieldValue();
    if (raw == null) return null;
    const parser = dbxDateTimeInputValueParseFactory(this.valueMode(), this.timezoneInstance());
    const date = parser(raw as Maybe<Date | string | number>);
    if (!date || (date instanceof Date && isNaN(date.getTime()))) return null;
    return startOfDay(date);
  });
  readonly displayValueSignal = toSignal(this.displayValue$);
  readonly pickerFilterSignal = toSignal(this.pickerFilter$, { initialValue: () => true as boolean });
  readonly dateInputMinSignal = toSignal(this.dateInputMin$, { initialValue: null });
  readonly dateInputMaxSignal = toSignal(this.dateInputMax$, { initialValue: null });
  readonly showDateInputSignal = toSignal(this.showDateInput$);
  readonly showTimeInputSignal = this.showTimeInput;
  readonly showAddTimeButtonSignal = this.showAddTimeButton;
  readonly fullDaySignal = this._fullDay.asReadonly();
  readonly tzAbbreviationSignal = toSignal(this.tzAbbreviation$);
  readonly hasValueSignal = toSignal(this.hasEmptyDisplayValue$.pipe(map((x) => !x)));
  readonly currentErrorMessageSignal = toSignal(this.currentErrorMessage$);
  readonly hasErrorSignal = toSignal(this.hasError$);
  readonly showClearButtonSignal = toSignal(this.showClearButton$);
  readonly presetsSignal = toSignal(this.presets$);
  readonly isDisabledSignal = this.isDisabled;

  constructor() {
    // Initialize fullDay from timeMode
    effect(() => {
      if (this.timeMode() === DbxDateTimeFieldTimeMode.NONE) {
        this._fullDay.set(true);
      }
    });

    // Subscribe to async props (timezone, pickerConfig, timeDate, presets)
    effect(() => {
      const p = this.props();

      // Timezone
      this._timezoneSub?.unsubscribe();
      if (p?.timezone && !p?.fullDayInUTC) {
        this._timezoneSub = asObservableFromGetter(p.timezone).subscribe((tz) => {
          const changed = this._timezone() !== tz;
          this._timezone.set(tz);
          // Re-trigger the output pipeline when timezone changes so the stored value
          // is re-converted with the new timezone.
          if (changed) {
            this._updateTime.next();
          }
        });
      }

      // Picker config
      this._pickerConfigSub?.unsubscribe();
      if (p?.pickerConfig) {
        this._pickerConfigSub = asObservableFromGetter(p.pickerConfig).subscribe((config) => this._pickerConfig.set(config));
      }

      // Time date
      this._timeDateSub?.unsubscribe();
      if (p?.timeDate) {
        this._timeDateSub = asObservableFromGetter(p.timeDate).subscribe((td) => this._timeDate.set(td ? toJsDayDate(td) : undefined));
      }

      // Presets
      this._presetsSub?.unsubscribe();
      if (p?.presets) {
        this._presetsSub = asObservableFromGetter(p.presets).subscribe((configs) => this._presetConfigs.set(configs));
      } else if (this.presetsService) {
        this._presetsSub = this.presetsService.configurations$.subscribe((configs) => this._presetConfigs.set(configs));
      }

      // Sync fields
      this._syncConfigObs.next(p?.getSyncFieldsObs?.());

      // Full day field name (read from sibling FieldTree)
      if (p?.fullDayFieldName) {
        const siblingTree = (this.fieldSignalContext.form as any)?.[p.fullDayFieldName];
        const siblingState = siblingTree?.() as any;
        if (siblingState?.value) {
          // Sync fullDay signal from sibling field
          this._fullDay.set(Boolean(siblingState.value()));
        }
      }
    });

    // Disabled state propagation
    effect(() => {
      const disabled = this.isDisabled();
      toggleDisableFormControl(this.dateCtrl, disabled);
      toggleDisableFormControl(this.timeCtrl, disabled);
    });

    // Sync inbound: FieldTree value → form controls.
    // Uses untracked() for _isTimeInputFocused to avoid re-running on focus changes.
    effect(() => {
      const raw = this.fieldValue();
      const isTimeFocused = untracked(() => this._isTimeInputFocused());

      if (raw == null) {
        if (this.dateCtrl.value != null) this.dateCtrl.setValue(null, { emitEvent: false });
        // Do not clear time control while user is actively editing it
        if (this.timeCtrl.value && !isTimeFocused) this.timeCtrl.setValue(null, { emitEvent: false });
        return;
      }

      const parser = dbxDateTimeInputValueParseFactory(this.valueMode(), this.timezoneInstance());
      const date = parser(raw as Maybe<Date | string | number>);
      if (!date || (date instanceof Date && isNaN(date.getTime()))) return;

      const currentDateCtrl = this.dateCtrl.value;
      if (!currentDateCtrl || !isSameDateDay(currentDateCtrl, date)) {
        this.dateCtrl.setValue(date, { emitEvent: false });
      }

      // Do not overwrite time control while user is actively editing it
      if (!isTimeFocused) {
        const timeStr = toLocalReadableTimeString(date);
        if (timeStr !== this.timeCtrl.value) {
          this.timeCtrl.setValue(timeStr, { emitEvent: false });
        }
      }
    });

    // Main output subscription: timeOutput$ → field value
    this._sub.subscription = this.valueInSystemTimezone$
      .pipe(
        combineLatestWith(this.timezoneInstance$.pipe(map((tz) => dbxDateTimeOutputValueFactory(this.valueMode(), tz)))),
        throttleTime(TIME_OUTPUT_THROTTLE_TIME, undefined, { leading: false, trailing: true }),
        switchMap(([currentValue, valueFactory]) => {
          return this.timeOutput$.pipe(
            throttleTime(TIME_OUTPUT_THROTTLE_TIME * 2, undefined, { leading: false, trailing: true }),
            skipAllInitialMaybe(),
            distinctUntilChanged(isSameDateHoursAndMinutes),
            map((x) => valueFactory(x)),
            filter((x) => !dbxDateTimeIsSameDateTimeFieldValue(x, currentValue))
          );
        })
      )
      .subscribe((value) => {
        this._setFieldValue(value);
      });

    // Time value sync (midnight edge case)
    let hasSetMidnightFromInput = false;

    this._valueSub.subscription = this.valueInSystemTimezone$
      .pipe(
        map((x) => (x ? isSameDate(x, startOfDay(x)) : false)),
        distinctUntilChanged(),
        switchMap((isInputValueAtMidnight) => {
          hasSetMidnightFromInput = false;
          return this.timeString$.pipe(map((timeString) => [timeString, isInputValueAtMidnight] as [string, boolean]));
        })
      )
      .subscribe(([x, isInputValueAtMidnight]) => {
        // Do not overwrite time while user is actively editing the time input
        if (this._isTimeInputFocused()) {
          return;
        }
        // Skip empty time strings to avoid overwriting a cleared null with ''
        if (!x) {
          return;
        }
        if (!this.timeCtrl.value && x === '12:00AM' && (!isInputValueAtMidnight || (isInputValueAtMidnight && hasSetMidnightFromInput))) {
          return;
        }
        if (x === '12:00AM' && isInputValueAtMidnight) {
          hasSetMidnightFromInput = true;
        }
        this.setTime(x);
      });

    // Auto-fill date from restricted range
    if (this.autofillDateWhenTimeIsPicked()) {
      this._autoFillDateSync.subscription = this.dateMinAndMaxIsSameDay$
        .pipe(
          switchMap((canAutofill) => {
            if (canAutofill) {
              return this._updateTime.pipe(
                debounceTime(200),
                switchMap(() => this.dateInputMin$),
                filterMaybe()
              );
            }
            return of(null);
          })
        )
        .subscribe((autoDate) => {
          if (autoDate != null) {
            this.dateCtrl.setValue(autoDate);
          }
        });
    }

    // Auto-fill date with today when user enters a time and no date is set (non-timeOnly fields only).
    // Uses timeDate or today as the fallback date.
    if (!this.isTimeOnly()) {
      const autoFillDateOnTimeSub = this._updateTime
        .pipe(
          debounceTime(50),
          filter(() => !this.dateCtrl.value && !!this.timeCtrl.value && !this.isTimeOnly())
        )
        .subscribe(() => {
          const fallbackDate = this._timeDate() ?? startOfDay(new Date());
          this.dateCtrl.setValue(fallbackDate);
        });

      this.destroyRef.onDestroy(() => autoFillDateOnTimeSub.unsubscribe());
    }

    // Resync time input on focus out — normalizes the display string from the stored value.
    // Skip resync if timeString$ is empty but the user has typed a time (the output pipeline
    // hasn't written back to the field tree yet).
    this._resyncTimeInputSub.subscription = this.resyncTimeInput$.pipe(switchMap(() => combineLatest([this.currentDate$, this.timeString$]).pipe(first()))).subscribe(([currentDate, timeString]) => {
      if (currentDate != null && (timeString || !this.timeCtrl.value)) {
        this.timeCtrl.setValue(timeString || null, { emitEvent: false });
      }
    });

    // Outbound sync: form controls → FieldTree via _updateTime
    const dateSub = this.dateCtrl.valueChanges.subscribe(() => this._updateTime.next());
    const timeSub = this.timeCtrl.valueChanges.subscribe(() => this._updateTime.next());

    // Config update time sync
    const configSyncSub = this.dateTimePickerConfig$.pipe(skip(1)).subscribe(() => this._updateTime.next());

    // Cleanup
    this.destroyRef.onDestroy(() => {
      dateSub.unsubscribe();
      timeSub.unsubscribe();
      configSyncSub.unsubscribe();
      this._sub.destroy();
      this._valueSub.destroy();
      this._autoFillDateSync.destroy();
      this._resyncTimeInputSub.destroy();
      this._timezoneSub?.unsubscribe();
      this._pickerConfigSub?.unsubscribe();
      this._timeDateSub?.unsubscribe();
      this._presetsSub?.unsubscribe();
      this._offset.complete();
      this._updateTime.complete();
      this._resyncTimeInput.complete();
      this._syncConfigObs.complete();
    });
  }

  // MARK: Actions
  onDatePicked(event: MatDatepickerInputEvent<Date>): void {
    const date = event.value;
    if (date) {
      this.dateCtrl.setValue(date);
      this._updateTime.next();
    }
  }

  onDateKeydown(event: KeyboardEvent): void {
    const step = computeDateKeyboardStep(event);
    if (!step) return;

    event.preventDefault();

    combineLatest([this.date$, this.dateTimePickerConfig$])
      .pipe(first())
      .subscribe(([date, config]) => {
        const nextDate = navigateDate(date, step, config);
        if (nextDate != null) {
          this.dateCtrl.setValue(nextDate);
          this._updateTime.next();
        }
      });
  }

  onTimeKeydown(event: KeyboardEvent): void {
    const step = computeTimeKeyboardStep(event);
    if (!step) return;

    event.preventDefault();
    this._offset.next(this._offset.value + step.offset * step.direction);
    this._updateTime.next();
  }

  onTimeFocus(): void {
    this._isTimeInputFocused.set(true);
  }

  onTimeBlur(): void {
    this._isTimeInputFocused.set(false);
    if (!this.timeCtrl.hasError('pattern')) {
      this._updateTime.next();
      this._resyncTimeInput.next();
    }
  }

  clearValue(): void {
    this._isCleared.set(true);
    this.dateCtrl.setValue(null);
    this.timeCtrl.setValue(null);
    // Use null (not undefined) to clear the field value — undefined can corrupt
    // the Signal Forms field node, destroying metadata like required state.
    this._setFieldValue(null);
    // Reset cleared state after a tick so future edits work
    setTimeout(() => this._isCleared.set(false), 0);
  }

  addTime(): void {
    this._fullDay.set(false);
    this._syncFullDayToSibling(false);
  }

  removeTime(): void {
    this._fullDay.set(true);
    this.timeCtrl.setValue(null);
    this._updateTime.next();
    this._syncFullDayToSibling(true);
  }

  selectPreset(preset: DateTimePreset): void {
    const value = preset.value();
    if (value.logicalDate) {
      const date = dateFromLogicalDate(value.logicalDate);
      if (date) {
        this.setTime(toLocalReadableTimeString(date));
      }
    } else if (value.timeString) {
      this.setTime(value.timeString);
    }
  }

  setTime(time: ReadableTimeString): void {
    if (this.timeCtrl.value !== time) {
      this.timeCtrl.setValue(time);
      this._offset.next(0);
      this._updateTime.next();
    }
  }

  // MARK: Internal helpers

  private _setFieldValue(value: unknown): void {
    try {
      const state = this.field()?.() as any;
      if (state?.value?.set) {
        state.value.set(value);
      }
    } catch {
      // Silently handle if FieldTree value is not writable
    }
  }

  private _syncFullDayToSibling(fullDay: boolean): void {
    const fieldName = this.props()?.fullDayFieldName;
    if (!fieldName) return;

    try {
      const siblingTree = (this.fieldSignalContext.form as any)?.[fieldName];
      const siblingState = siblingTree?.() as any;
      if (siblingState?.value?.set) {
        siblingState.value.set(fullDay);
      }
    } catch {
      // Silently handle if sibling field is not writable
    }
  }
}

// MARK: Mapper

/**
 * Custom mapper for the datetime field type.
 * Called by ng-forge's DynamicForm to create the inputs for the component.
 *
 * @param fieldDef - Field definition configuration
 * @param fieldDef.key - Form model key for the field
 * @returns Signal containing a Record of input names to values for ngComponentOutlet
 */
export function dateTimeFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
