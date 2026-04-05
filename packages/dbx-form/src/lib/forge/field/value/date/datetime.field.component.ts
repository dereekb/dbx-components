import { Component, ChangeDetectionStrategy, input, computed, effect, type Signal, type InputSignal, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule, type MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AsyncPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { DynamicTextPipe, type DynamicText, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs, createResolvedErrorsSignal, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG } from '@ng-forge/dynamic-forms-material';
import type { FieldTree } from '@angular/forms/signals';
import { type Maybe, type Milliseconds, type TimezoneString, type ReadableTimeString, type DateOrDayString } from '@dereekb/util';
import { safeToJsDate, dateTimezoneUtcNormal, type DateTimezoneUtcNormalInstance, guessCurrentTimezone, readableTimeStringToDate, toLocalReadableTimeString, getTimezoneAbbreviation, isSameDateHoursAndMinutes, isSameDateDay, DateTimeMinuteInstance, dateFromLogicalDate, utcDayForDate, dateTimeMinuteWholeDayDecisionFunction, toJsDayDate, findMinDate, findMaxDate } from '@dereekb/date';
import { type ObservableOrValueGetter, asObservableFromGetter, SubscriptionObject, switchMapMaybeDefault, filterMaybe, switchMapFilterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, map, of, shareReplay, startWith, Subject, switchMap, throttleTime, type Observable, merge, skip } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { startOfDay, addMinutes } from 'date-fns';
import { DbxDateTimeValueMode, dbxDateTimeInputValueParseFactory, dbxDateTimeOutputValueFactory, dbxDateTimeIsSameDateTimeFieldValue } from '../../../../formly/field/value/date/date.value';
import { DbxDateTimeFieldTimeMode, type DbxDateTimePickerConfiguration } from '../../../../formly/field/value/date/datetime.field.component';
import { type DateTimePresetConfiguration, type DateTimePreset, dateTimePreset } from '../../../../formly/field/value/date/datetime';
import { DateDistancePipe, TimeDistancePipe, GetValuePipe } from '@dereekb/dbx-core';

/**
 * Custom props for the forge date-time field.
 *
 * Full parity with formly `DbxDateTimeFieldProps`.
 */
export interface ForgeDateTimeFieldComponentProps {
  // --- Display modes ---
  readonly timeOnly?: boolean;
  readonly timeMode?: DbxDateTimeFieldTimeMode;
  readonly valueMode?: DbxDateTimeValueMode;

  // --- Labels ---
  readonly dateLabel?: string;
  readonly timeLabel?: string;
  readonly allDayLabel?: string;
  readonly atTimeLabel?: string;

  // --- Date constraints ---
  readonly minDate?: Date | string;
  readonly maxDate?: Date | string;

  // --- Timezone ---
  readonly timezone?: Maybe<ObservableOrValueGetter<Maybe<TimezoneString>>>;
  readonly showTimezone?: Maybe<boolean>;

  // --- Picker configuration ---
  readonly pickerConfig?: ObservableOrValueGetter<DbxDateTimePickerConfiguration>;

  // --- UI toggles ---
  readonly hideDateHint?: boolean;
  readonly hideDatePicker?: boolean;
  readonly alwaysShowDateInput?: boolean;
  readonly showClearButton?: Maybe<boolean>;
  readonly autofillDateWhenTimeIsPicked?: boolean;

  // --- Presets ---
  readonly presets?: ObservableOrValueGetter<DateTimePresetConfiguration[]>;

  // --- Time date reference ---
  readonly timeDate?: Maybe<ObservableOrValueGetter<Maybe<DateOrDayString>>>;

  // --- Advanced ---
  readonly fullDayInUTC?: boolean;
  readonly minuteStep?: Maybe<number>;
  readonly inputOutputDebounceTime?: Milliseconds;

  // --- Material ---
  readonly appearance?: 'fill' | 'outline';
  readonly hint?: DynamicText;

  // --- Deprecated compat ---
  /** @deprecated Use `timeMode` instead. */
  readonly showTime?: boolean;
}

const TIME_OUTPUT_THROTTLE_TIME: Milliseconds = 10;

/**
 * Custom ng-forge field component for date-time selection.
 *
 * Full parity with formly `DbxDateTimeFieldComponent`. Supports timezone conversion,
 * value mode parsing/output, time mode states, picker configuration with limits and schedule,
 * presets dropdown, clear button, date/time hints, and arrow key navigation.
 *
 * Registered as ng-forge type 'datetime'.
 */
@Component({
  selector: 'dbx-forge-datetime-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, ReactiveFormsModule, FormsModule, NgTemplateOutlet, DynamicTextPipe, AsyncPipe, DatePipe, DateDistancePipe, TimeDistancePipe, GetValuePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dbx-datetime-field dbx-forge-datetime-field">
      <!-- Date -->
      @if (showDateInputSignal()) {
        <div class="dbx-forge-datetime-row" [class.dbx-forge-datetime-row-full]="dateOnlySignal()">
          <mat-form-field [appearance]="effectiveAppearance()" subscriptSizing="dynamic" class="dbx-forge-datetime-row-field">
            <mat-label>{{ dateLabelSignal() }}</mat-label>
            <input matInput [matDatepicker]="picker" [matDatepickerFilter]="pickerFilterSignal()" [min]="dateInputMinSignal()" [max]="dateInputMaxSignal()" [formControl]="dateInputCtrl" (dateChange)="datePicked($event)" />
            @if (!hideDatePickerSignal()) {
              <mat-datepicker-toggle matIconPrefix [for]="picker"></mat-datepicker-toggle>
            }
            <mat-datepicker #picker></mat-datepicker>
            @if (showClearButtonSignal()) {
              <button matSuffix mat-icon-button aria-label="Clear date and time" (click)="clearValue()" class="dbx-datetime-clear-button">
                <mat-icon>clear</mat-icon>
              </button>
            }
            @if (!showTimeInputSignal()) {
              <span matTextSuffix>
                <ng-container *ngTemplateOutlet="timezoneSuffixTemplate"></ng-container>
              </span>
            }
          </mat-form-field>
        </div>
      }
      <!-- Time -->
      @if (showTimeInputSignal() || showAddTimeSignal()) {
        <div class="dbx-forge-datetime-row">
          @if (showTimeInputSignal()) {
            <mat-menu #timemenu="matMenu">
              @if (effectiveTimeModeSignal() === 'optional') {
                <button mat-menu-item (click)="removeTime()">
                  <span>Remove Time</span>
                </button>
                <mat-divider></mat-divider>
              }
              @for (preset of presetsSignal(); track preset) {
                <button mat-menu-item (click)="selectPreset(preset)">{{ preset.label | getValue }}</button>
              }
            </mat-menu>
            <mat-form-field [appearance]="effectiveAppearance()" subscriptSizing="dynamic" class="dbx-forge-datetime-row-field">
              <mat-label>{{ timeLabelSignal() }}</mat-label>
              <input matInput [formControl]="timeInputCtrl" (focus)="focusTime()" (focusout)="focusOutTime()" (keydown)="keydownOnTimeInput($event)" />
              <button matPrefix mat-icon-button [matMenuTriggerFor]="timemenu" aria-label="Open time presets" class="dbx-datetime-row-button">
                <mat-icon>timer</mat-icon>
              </button>
              <span matTextSuffix>
                <ng-container *ngTemplateOutlet="timezoneSuffixTemplate"></ng-container>
              </span>
              @if (timeInputCtrl.hasError('pattern')) {
                <mat-error>The input time is not recognizable.</mat-error>
              }
            </mat-form-field>
          }
          @if (showAddTimeSignal()) {
            <div class="add-time-button-wrapper">
              <button mat-button class="add-time-button" (click)="addTime()">
                <mat-icon>timer</mat-icon>
                Add Time
              </button>
            </div>
          }
        </div>
      }
      <!-- Date Hint -->
      @if (!hasErrorSignal()) {
        @if (!hideDateHintSignal()) {
          <div class="dbx-forge-datetime-hint-row">
            <div class="dbx-hint">
              @if (hasEmptyDisplayValueSignal()) {
                <span class="dbx-small">No date/time set</span>
              } @else {
                @if (fullDaySignal()) {
                  <small>
                    @if (validDisplayValueSignal(); as dv) {
                      <b class="dbx-ok">{{ allDayLabelSignal() }}</b>
                      {{ dv | date: 'fullDate' }} {{ timezoneAbbreviationSignal() }} ({{ dv | dateDistance }})
                    }
                  </small>
                } @else {
                  <small>
                    @if (validDisplayValueSignal(); as dv) {
                      <b class="dbx-ok">{{ atTimeLabelSignal() }}</b>
                      {{ dv | date: 'medium' }} {{ timezoneAbbreviationSignal() }} ({{ dv | timeDistance }})
                    }
                  </small>
                }
              }
            </div>
          </div>
        }
      } @else {
        @if (currentErrorMessageSignal()) {
          <mat-error>{{ currentErrorMessageSignal() }}</mat-error>
        }
      }
    </div>

    <!-- Timezone Suffix -->
    <ng-template #timezoneSuffixTemplate>
      @if (showTimezoneSignal()) {
        <span class="dbx-datetime-timezone dbx-faint">{{ timezoneAbbreviationSignal() }}</span>
      }
    </ng-template>
  `,
  styles: `
    .dbx-forge-datetime-field {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: flex-start;
    }
    .dbx-forge-datetime-row {
      flex: 1 1 auto;
      min-width: 140px;
    }
    .dbx-forge-datetime-row-full {
      flex: 1 1 100%;
    }
    .dbx-forge-datetime-row-field {
      width: 100%;
    }
    .dbx-forge-datetime-hint-row {
      flex: 1 1 100%;
    }
    .add-time-button-wrapper {
      display: flex;
      align-items: center;
      min-height: 56px;
    }
  `
})
export class ForgeDateTimeFieldComponent {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<unknown>> = input.required<FieldTree<unknown>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<ForgeDateTimeFieldComponentProps | undefined> = input<ForgeDateTimeFieldComponentProps | undefined>();
  readonly meta: InputSignal<Record<string, unknown> | undefined> = input<Record<string, unknown> | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  /**
   * Internal FormControl for the date portion.
   */
  readonly dateInputCtrl = new FormControl<Maybe<Date>>(null);

  /**
   * Internal FormControl for the time portion (readable time string).
   */
  readonly timeInputCtrl = new FormControl<Maybe<ReadableTimeString>>(null, {
    validators: [Validators.pattern(/^(now)$|^([0-9]|(0[0-9])|(1[0-9])|(2[0-3]))(:)?([0-5][0-9])?(\s)?([apAP][Mm])?(\\s)*$/)]
  });

  private readonly _fullDay = new BehaviorSubject<boolean>(false);
  private readonly _offset = new BehaviorSubject<number>(0);
  private readonly _cleared = new Subject<void>();
  private readonly _updateTime = new Subject<void>();
  private readonly _config = new BehaviorSubject<Maybe<Observable<DbxDateTimePickerConfiguration>>>(undefined);
  private readonly _defaultTimezone = new BehaviorSubject<Maybe<Observable<Maybe<TimezoneString>>>>(undefined);
  private readonly _timeDate = new BehaviorSubject<Maybe<Observable<Maybe<DateOrDayString>>>>(undefined);
  private readonly _presets = new BehaviorSubject<Observable<DateTimePresetConfiguration[]>>(of([]));
  private readonly _sub = new SubscriptionObject();
  private readonly _valueSub = new SubscriptionObject();

  // Computed props
  readonly effectiveAppearance = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline');

  readonly valueModeSignal = computed(() => this.props()?.valueMode ?? DbxDateTimeValueMode.DATE);

  readonly effectiveTimeModeSignal = computed<DbxDateTimeFieldTimeMode>(() => {
    const p = this.props();
    const valueMode = this.valueModeSignal();

    if (valueMode === DbxDateTimeValueMode.DAY_STRING) {
      return DbxDateTimeFieldTimeMode.NONE;
    }

    if (p?.timeOnly) {
      return DbxDateTimeFieldTimeMode.REQUIRED;
    }

    // Handle deprecated showTime
    if (p?.timeMode) return p.timeMode;
    if (p?.showTime === false) return DbxDateTimeFieldTimeMode.NONE;
    return DbxDateTimeFieldTimeMode.REQUIRED;
  });

  readonly timeOnlySignal = computed(() => {
    const p = this.props();
    const valueMode = this.valueModeSignal();
    return valueMode === DbxDateTimeValueMode.MINUTE_OF_DAY || p?.timeOnly === true;
  });

  readonly dateOnlySignal = computed(() => this.effectiveTimeModeSignal() === DbxDateTimeFieldTimeMode.NONE);
  readonly dateLabelSignal = computed(() => this.props()?.dateLabel ?? 'Date');
  readonly timeLabelSignal = computed(() => this.props()?.timeLabel ?? 'Time');
  readonly allDayLabelSignal = computed(() => this.props()?.allDayLabel ?? 'All Day');
  readonly atTimeLabelSignal = computed(() => this.props()?.atTimeLabel ?? 'At');
  readonly hideDateHintSignal = computed(() => this.props()?.hideDateHint ?? false);
  readonly hideDatePickerSignal = computed(() => this.props()?.hideDatePicker ?? false);
  readonly showTimezoneSignal = computed(() => this.props()?.showTimezone ?? true);
  readonly alwaysShowDateInputSignal = computed(() => this.props()?.alwaysShowDateInput ?? true);
  readonly minuteStepSignal = computed(() => this.props()?.minuteStep ?? 5);

  // Timezone
  readonly latestConfig$ = this._config.pipe(switchMapMaybeDefault(), distinctUntilChanged(), shareReplay(1));

  readonly timezone$: Observable<Maybe<TimezoneString>> = this._defaultTimezone.pipe(
    switchMapMaybeDefault(),
    distinctUntilChanged(),
    map((defaultTimezone) => defaultTimezone ?? guessCurrentTimezone()),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly timezoneInstance$: Observable<Maybe<DateTimezoneUtcNormalInstance>> = this.timezone$.pipe(
    map((timezone) => (timezone ? dateTimezoneUtcNormal({ timezone }) : undefined)),
    shareReplay(1)
  );

  readonly timeDate$: Observable<Maybe<Date>> = this._timeDate.pipe(
    switchMapMaybeDefault(),
    map((x) => (x ? toJsDayDate(x) : undefined)),
    distinctUntilChanged(isSameDateDay),
    shareReplay(1)
  );

  // Value parsing from FieldTree
  readonly fieldValueSignal = computed(() => {
    const f = this.field();
    return (f as any)?.value?.() as Maybe<unknown>;
  });

  private readonly _fieldValue$ = new BehaviorSubject<Maybe<unknown>>(undefined);

  readonly valueInSystemTimezone$: Observable<Maybe<Date>> = combineLatest([this._fieldValue$.pipe(distinctUntilChanged()), this.timezoneInstance$]).pipe(
    map(([rawValue, timezoneInstance]) => {
      if (rawValue == null) return undefined;

      try {
        const valueMode = this.valueModeSignal();
        const parser = dbxDateTimeInputValueParseFactory(valueMode, timezoneInstance);
        const result = parser(rawValue as Maybe<Date | string | number>);

        // Guard against invalid Date objects
        if (result instanceof Date && isNaN(result.getTime())) {
          return undefined;
        }

        return result;
      } catch {
        return undefined;
      }
    }),
    throttleTime(20, undefined, { leading: true, trailing: true }),
    distinctUntilChanged(isSameDateHoursAndMinutes),
    shareReplay(1)
  );

  readonly displayValue$: Observable<Maybe<Date>> = this.valueInSystemTimezone$.pipe(shareReplay(1));

  readonly timeString$: Observable<ReadableTimeString | ''> = this.valueInSystemTimezone$.pipe(
    map((x) => (x ? toLocalReadableTimeString(x) : '')),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Date input observables
  readonly currentDate$ = this.dateInputCtrl.valueChanges.pipe(startWith(this.dateInputCtrl.value), shareReplay(1));
  readonly date$ = this.currentDate$.pipe(filterMaybe(), shareReplay(1));

  readonly timezoneAbbreviation$ = combineLatest([this.currentDate$, this.timezone$, this.timeDate$]).pipe(
    map(([date, timezone, timeDate]) => getTimezoneAbbreviation(timezone, timeDate ?? date ?? new Date())),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly dateValue$: Observable<Maybe<Date>> = merge(this.date$, this.valueInSystemTimezone$).pipe(
    map((x: Maybe<Date>) => (x ? startOfDay(x) : null)),
    distinctUntilChanged<Maybe<Date>>(isSameDateDay),
    shareReplay(1)
  );

  readonly timeInput$: Observable<ReadableTimeString> = this._updateTime.pipe(
    debounceTime(5),
    map(() => this.timeInputCtrl.value || ''),
    distinctUntilChanged()
  );

  // Full day
  readonly fullDay$ = this._fullDay.asObservable().pipe(distinctUntilChanged(), shareReplay(1));
  readonly showTimeInput$ = this.fullDay$.pipe(map((x) => !x && this.effectiveTimeModeSignal() !== DbxDateTimeFieldTimeMode.NONE));
  readonly showAddTime$ = this.showTimeInput$.pipe(
    map((x) => !x && this.effectiveTimeModeSignal() === DbxDateTimeFieldTimeMode.OPTIONAL),
    shareReplay(1)
  );

  // Picker config
  readonly dateTimePickerConfig$: Observable<Maybe<DbxDateTimePickerConfiguration>> = this._config.pipe(switchMapFilterMaybe(), shareReplay(1));

  readonly dateInputMin$: Observable<Date | null> = this.dateTimePickerConfig$.pipe(
    map((x) => {
      const minFromProps = this.props()?.minDate;
      const minFromConfig = x?.limits?.min;
      const candidates = [minFromConfig ? dateFromLogicalDate(minFromConfig) : undefined, minFromProps ? safeToJsDate(minFromProps) : undefined].filter(Boolean) as Date[];
      return candidates.length > 0 ? (findMaxDate(candidates) ?? null) : null;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly dateInputMax$: Observable<Date | null> = this.dateTimePickerConfig$.pipe(
    map((x) => {
      const maxFromProps = this.props()?.maxDate;
      const maxFromConfig = x?.limits?.max;
      const candidates = [maxFromConfig ? dateFromLogicalDate(maxFromConfig) : undefined, maxFromProps ? safeToJsDate(maxFromProps) : undefined].filter(Boolean) as Date[];
      return candidates.length > 0 ? (findMinDate(candidates) ?? null) : null;
    }),
    distinctUntilChanged(),
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
        const filter = dateTimeMinuteWholeDayDecisionFunction(x, false);
        return (d: Date | null) => (d != null ? filter(d) : true);
      }
      return () => true;
    }),
    shareReplay(1)
  );

  readonly showDateInput$: Observable<boolean> = this.dateMinAndMaxIsSameDay$.pipe(
    map((dateMinAndMaxIsSameDay) => !this.timeOnlySignal() && (this.alwaysShowDateInputSignal() || !dateMinAndMaxIsSameDay)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Raw combined date-time
  readonly rawDateTime$: Observable<Maybe<Date>> = combineLatest([
    this.timeOnlySignal() ? of(null) : this.dateValue$,
    this.timeInput$.pipe(startWith(null)),
    this.fullDay$,
    this.timeDate$,
    this._cleared.pipe(
      map(() => true),
      startWith(false)
    )
  ]).pipe(
    map(([date, timeString, fullDay, timeDate, isCleared]) => {
      let result: Maybe<Date>;

      if (!isCleared) {
        if (!date || this.timeOnlySignal()) {
          date = timeDate ?? new Date();
        }

        if (date) {
          if (fullDay) {
            result = this.props()?.fullDayInUTC ? utcDayForDate(date) : startOfDay(date);
          } else if (timeString) {
            result = readableTimeStringToDate(timeString, { date, useSystemTimezone: true }) ?? date;
          } else if (!this.timeOnlySignal() && this.effectiveTimeModeSignal() !== DbxDateTimeFieldTimeMode.REQUIRED) {
            result = date;
          }
        }
      }

      return result;
    }),
    distinctUntilChanged(isSameDateHoursAndMinutes),
    shareReplay(1)
  );

  // Time output with clamping
  readonly timeOutput$: Observable<Maybe<Date>> = combineLatest([this.rawDateTime$, this._offset, this.dateTimePickerConfig$]).pipe(
    throttleTime(TIME_OUTPUT_THROTTLE_TIME, undefined, { leading: false, trailing: true }),
    map(([date, stepsOffset, config]) => {
      if (date != null) {
        const instance = new DateTimeMinuteInstance({ date, ...config, roundDownToMinute: true });

        if (stepsOffset) {
          date = instance.clamp(date);
          const minutes = stepsOffset * this.minuteStepSignal();
          if (minutes !== 0) {
            date = addMinutes(date, minutes);
            date = instance.clamp(date);
          }
        }
      }

      return date;
    }),
    distinctUntilChanged(isSameDateHoursAndMinutes),
    shareReplay(1)
  );

  // Presets
  readonly allPresets$: Observable<DateTimePreset[]> = this._presets.pipe(
    switchMapFilterMaybe(),
    map((x: DateTimePresetConfiguration[]) => x.map(dateTimePreset)),
    shareReplay(1)
  );

  readonly presets$: Observable<DateTimePreset[]> = combineLatest([this.allPresets$, this.fullDay$]).pipe(
    switchMap(([x, fullDay]) => (fullDay || x.length === 0 ? of([]) : of(x))),
    shareReplay(1)
  );

  // Clear button
  readonly hasEmptyDisplayValue$ = this.displayValue$.pipe(
    map((x) => !x),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly showClearButton$: Observable<boolean> = this.hasEmptyDisplayValue$.pipe(
    map((x) => Boolean(this.props()?.showClearButton !== false && !x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Error handling
  readonly currentErrorMessage$ = new BehaviorSubject<Maybe<string>>(undefined).asObservable();

  readonly hasError$ = this.currentErrorMessage$.pipe(
    map((x) => Boolean(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Signals for template
  readonly dateValueSignal = toSignal(this.dateValue$);
  readonly displayValueSignal = toSignal(this.displayValue$);
  readonly pickerFilterSignal = toSignal(this.pickerFilter$, { initialValue: () => true });
  readonly dateInputMinSignal = toSignal(this.dateInputMin$, { initialValue: null });
  readonly dateInputMaxSignal = toSignal(this.dateInputMax$, { initialValue: null });
  readonly showDateInputSignal = toSignal(this.showDateInput$, { initialValue: true });
  readonly showTimeInputSignal = toSignal(this.showTimeInput$, { initialValue: true });
  readonly showAddTimeSignal = toSignal(this.showAddTime$, { initialValue: false });
  readonly fullDaySignal = toSignal(this.fullDay$, { initialValue: false });
  readonly timezoneAbbreviationSignal = toSignal(this.timezoneAbbreviation$);
  readonly hasEmptyDisplayValueSignal = toSignal(this.hasEmptyDisplayValue$, { initialValue: true });
  readonly validDisplayValueSignal = computed(() => {
    const v = this.displayValueSignal();
    return v instanceof Date && !isNaN(v.getTime()) ? v : undefined;
  });
  readonly currentErrorMessageSignal = toSignal(this.currentErrorMessage$);
  readonly showClearButtonSignal = toSignal(this.showClearButton$, { initialValue: false });
  readonly presetsSignal = toSignal(this.presets$, { initialValue: [] as DateTimePreset[] });
  readonly hasErrorSignal = toSignal(this.hasError$, { initialValue: false });

  /**
   * Flag to prevent feedback loops during sync.
   */
  private _syncing = false;

  // Sync field value to _fieldValue$ subject
  private readonly _syncFieldValueEffect = effect(() => {
    const fieldValue = this.fieldValueSignal();
    this._fieldValue$.next(fieldValue);
  });

  // Initialize config from props
  private readonly _initConfigEffect = effect(() => {
    const p = this.props();
    if (p?.pickerConfig) {
      this._config.next(asObservableFromGetter(p.pickerConfig));
    } else {
      this._config.next(of({}));
    }

    if (p?.timezone && !p?.fullDayInUTC) {
      this._defaultTimezone.next(asObservableFromGetter(p.timezone));
    }

    if (p?.timeDate) {
      this._timeDate.next(asObservableFromGetter(p.timeDate));
    }

    if (p?.presets) {
      this._presets.next(asObservableFromGetter(p.presets));
    }

    // Set full day based on time mode
    const timeMode = this.effectiveTimeModeSignal();
    if (timeMode === DbxDateTimeFieldTimeMode.NONE) {
      this._fullDay.next(true);
    }
  });

  constructor() {
    // Sync inbound: FieldTree value → date/time controls
    effect(() => {
      const fieldTree = this.field();
      const fieldState = fieldTree();
      const signalValue: unknown = fieldState.value();

      if (!this._syncing) {
        this._syncing = true;
        const p = this.props();
        const valueMode = p?.valueMode ?? DbxDateTimeValueMode.DATE;
        // We need to parse the raw value using the timezone
        // but for the effect, just update the BehaviorSubject which drives the observable pipeline
        this._fieldValue$.next(signalValue);
        this._syncing = false;
      }
    });

    // Sync outbound: time output → FieldTree
    this._sub.subscription = combineLatest([this.valueInSystemTimezone$, this.timezoneInstance$.pipe(map((timezoneInstance) => dbxDateTimeOutputValueFactory(this.valueModeSignal(), timezoneInstance)))])
      .pipe(
        throttleTime(TIME_OUTPUT_THROTTLE_TIME, undefined, { leading: false, trailing: true }),
        switchMap(([currentValue, valueFactory]) =>
          this.timeOutput$.pipe(
            throttleTime(TIME_OUTPUT_THROTTLE_TIME * 2, undefined, { leading: false, trailing: true }),
            distinctUntilChanged(isSameDateHoursAndMinutes),
            map((x) => [valueFactory(x), currentValue] as [unknown, unknown])
          )
        )
      )
      .subscribe(([value, currentValue]: [unknown, unknown]) => {
        if (!dbxDateTimeIsSameDateTimeFieldValue(value as Maybe<Date | string | number>, currentValue as Maybe<Date | string | number>)) {
          this._setFieldValue(value);
        }
      });

    // Sync time string to time input
    this._valueSub.subscription = this.timeString$.subscribe((x) => {
      this.setTime(x);
    });

    // Sync date value to date input
    const dateValueSub = this.valueInSystemTimezone$.subscribe((date) => {
      if (!this._syncing && date) {
        this._syncing = true;
        const currentDateCtrlValue = this.dateInputCtrl.value;
        if (!currentDateCtrlValue || !isSameDateDay(currentDateCtrlValue, date)) {
          this.dateInputCtrl.setValue(date, { emitEvent: false });
        }
        this._syncing = false;
      }
    });

    this.destroyRef.onDestroy(() => {
      dateValueSub.unsubscribe();
      this._sub.destroy();
      this._valueSub.destroy();
      this._fullDay.complete();
      this._offset.complete();
      this._cleared.complete();
      this._updateTime.complete();
      this._config.complete();
      this._defaultTimezone.complete();
      this._timeDate.complete();
      this._presets.complete();
      this._fieldValue$.complete();
    });
  }

  // MARK: Actions
  datePicked(event: MatDatepickerInputEvent<Date>): void {
    this.dateInputCtrl.setValue(event.value);
    this._updateTime.next();
  }

  clearValue(): void {
    this.dateInputCtrl.setValue(null);
    this.timeInputCtrl.setValue(null);
    this._cleared.next();
    this._setFieldValue(undefined);
  }

  addTime(): void {
    this._fullDay.next(false);
  }

  removeTime(): void {
    this._fullDay.next(true);
    this.timeInputCtrl.setValue(null);
    this._updateTime.next();
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

  setTime(time: ReadableTimeString | ''): void {
    if (time !== this.timeInputCtrl.value) {
      this.timeInputCtrl.setValue(time || null, { emitEvent: false });
    }
    this._updateTime.next();
  }

  focusTime(): void {
    // Select all text for easy replacement
    const el = document.activeElement as HTMLInputElement;
    if (el?.select) {
      el.select();
    }
  }

  focusOutTime(): void {
    this._updateTime.next();
  }

  keydownOnTimeInput(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this._offset.next(this._offset.value + 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this._offset.next(this._offset.value - 1);
    }
  }

  // MARK: Internal
  private _setFieldValue(value: unknown): void {
    const f = this.field();
    if (!f) return;

    if (typeof (f as any).setValue === 'function') {
      (f as any).setValue(value);
    } else if (typeof (f as any).value === 'function') {
      const sig = (f as any).value;
      if (sig.set) {
        sig.set(value);
      }
    }
  }
}

// MARK: Mapper
/**
 * Custom mapper for the datetime field type.
 *
 * Uses the standard valueFieldMapper pattern from ng-forge/integration to resolve
 * the field tree and build the standard inputs for the component.
 *
 * @param fieldDef - The datetime field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
export function dateTimeFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
