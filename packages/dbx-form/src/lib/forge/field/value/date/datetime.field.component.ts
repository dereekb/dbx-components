import { Component, ChangeDetectionStrategy, input, computed, effect, type Signal, type InputSignal, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule, type MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { type DynamicText, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG } from '@ng-forge/dynamic-forms-material';
import type { FieldTree } from '@angular/forms/signals';
import { type Maybe, type Milliseconds, type TimezoneString, type ReadableTimeString, type DateOrDayString } from '@dereekb/util';
import { safeToJsDate, dateTimezoneUtcNormal, type DateTimezoneUtcNormalInstance, guessCurrentTimezone, readableTimeStringToDate, toLocalReadableTimeString, getTimezoneAbbreviation, isSameDateHoursAndMinutes, isSameDateDay, DateTimeMinuteInstance, dateFromLogicalDate, utcDayForDate, dateTimeMinuteWholeDayDecisionFunction, toJsDayDate, findMinDate, findMaxDate } from '@dereekb/date';
import { type ObservableOrValueGetter, asObservableFromGetter, SubscriptionObject } from '@dereekb/rxjs';
import { type Observable, of, Subscription } from 'rxjs';
import { startOfDay, addMinutes } from 'date-fns';
import { DbxDateTimeValueMode, dbxDateTimeInputValueParseFactory, dbxDateTimeOutputValueFactory } from '../../../../formly/field/value/date/date.value';
import { DbxDateTimeFieldTimeMode, type DbxDateTimePickerConfiguration } from '../../../../formly/field/value/date/datetime.field.component';
import { type DateTimePresetConfiguration, type DateTimePreset, dateTimePreset } from '../../../../formly/field/value/date/datetime';
import { DateDistancePipe, TimeDistancePipe, GetValuePipe } from '@dereekb/dbx-core';

/**
 * Custom props for the forge date-time field.
 *
 * Full parity with formly `DbxDateTimeFieldProps`.
 */
export interface ForgeDateTimeFieldComponentProps {
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
  readonly fullDayInUTC?: boolean;
  readonly minuteStep?: Maybe<number>;
  readonly inputOutputDebounceTime?: Milliseconds;
  readonly appearance?: 'fill' | 'outline';
  readonly hint?: DynamicText;
  /** @deprecated Use `timeMode` instead. */
  readonly showTime?: boolean;
}

/**
 * Forge date-time field component — redesigned for clean signal-based data flow.
 *
 * Instead of complex observable pipelines, this uses computed signals for derived state
 * and effects for synchronization. Value parsing and output formatting reuse the same
 * utility functions as the formly implementation.
 */
@Component({
  selector: 'dbx-forge-datetime-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, ReactiveFormsModule, FormsModule, NgTemplateOutlet, DatePipe, DateDistancePipe, TimeDistancePipe, GetValuePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dbx-datetime-field dbx-forge-datetime-field">
      <!-- Field Label -->
      @if (fieldLabel()) {
        <div class="dbx-forge-datetime-label-row">
          <span class="dbx-label dbx-forge-field-label">
            {{ fieldLabel() }}
            @if (isRequired()) {
              <span class="dbx-required-marker">*</span>
            }
          </span>
        </div>
      }
      <!-- Date Input -->
      @if (showDateInput()) {
        <div class="dbx-forge-datetime-row" [class.dbx-forge-datetime-row-full]="isDateOnly()">
          <mat-form-field [appearance]="appearance()" subscriptSizing="dynamic" class="dbx-forge-datetime-row-field">
            <mat-label>{{ dateLabel() }}</mat-label>
            <input matInput [matDatepicker]="picker" [matDatepickerFilter]="pickerFilter()" [min]="dateMin()" [max]="dateMax()" [formControl]="dateCtrl" (dateChange)="onDatePicked($event)" />
            @if (!hideDatePicker()) {
              <mat-datepicker-toggle matIconPrefix [for]="picker"></mat-datepicker-toggle>
            }
            <mat-datepicker #picker></mat-datepicker>
            @if (showClearButton() && hasValue()) {
              <button matSuffix mat-icon-button aria-label="Clear date and time" (click)="clearValue()">
                <mat-icon>clear</mat-icon>
              </button>
            }
            @if (!showTimeInput()) {
              <span matTextSuffix>
                <ng-container [ngTemplateOutlet]="tzSuffix"></ng-container>
              </span>
            }
          </mat-form-field>
        </div>
      }
      <!-- Time Input -->
      @if (showTimeInput() || showAddTimeButton()) {
        <div class="dbx-forge-datetime-row">
          @if (showTimeInput()) {
            <mat-menu #timemenu="matMenu">
              @if (timeMode() === 'optional') {
                <button mat-menu-item (click)="removeTime()"><span>Remove Time</span></button>
                <mat-divider></mat-divider>
              }
              @for (preset of presetItems(); track $index) {
                <button mat-menu-item (click)="selectPreset(preset)">{{ preset.label | getValue }}</button>
              }
            </mat-menu>
            <mat-form-field [appearance]="appearance()" subscriptSizing="dynamic" class="dbx-forge-datetime-row-field">
              <mat-label>{{ timeLabel() }}</mat-label>
              <input matInput [formControl]="timeCtrl" (focus)="onTimeFocus()" (focusout)="onTimeBlur()" (keydown)="onTimeKeydown($event)" />
              <button matPrefix mat-icon-button [matMenuTriggerFor]="timemenu" aria-label="Open time presets">
                <mat-icon>timer</mat-icon>
              </button>
              <span matTextSuffix>
                <ng-container [ngTemplateOutlet]="tzSuffix"></ng-container>
              </span>
              @if (timeCtrl.hasError('pattern')) {
                <mat-error>The input time is not recognizable.</mat-error>
              }
            </mat-form-field>
          }
          @if (showAddTimeButton()) {
            <div class="dbx-forge-add-time-wrapper">
              <button mat-button (click)="addTime()">
                <mat-icon>timer</mat-icon>
                Add Time
              </button>
            </div>
          }
        </div>
      }
      <!-- Date Hint -->
      @if (!hideDateHint()) {
        <div class="dbx-forge-datetime-hint-row">
          @if (!hasValue()) {
            <span class="dbx-small dbx-hint">No date/time set</span>
          } @else if (displayDate(); as dv) {
            @if (isFullDay()) {
              <small>
                <b class="dbx-ok">{{ allDayLabel() }}</b>
                {{ dv | date: 'fullDate' }} {{ tzAbbreviation() }} ({{ dv | dateDistance }})
              </small>
            } @else {
              <small>
                <b class="dbx-ok">{{ atTimeLabel() }}</b>
                {{ dv | date: 'medium' }} {{ tzAbbreviation() }} ({{ dv | timeDistance }})
              </small>
            }
          }
        </div>
      }
      <!-- Description -->
      @if (description()) {
        <div class="dbx-forge-datetime-desc-row">
          <p class="dbx-hint">{{ description() }}</p>
        </div>
      }
    </div>

    <ng-template #tzSuffix>
      @if (showTimezone()) {
        <span class="dbx-datetime-timezone dbx-faint">{{ tzAbbreviation() }}</span>
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
    .dbx-forge-datetime-label-row {
      flex: 1 1 100%;
    }
    .dbx-forge-field-label {
      font-weight: 500;
    }
    .dbx-required-marker {
      color: var(--mat-sys-error, red);
    }
    .dbx-forge-datetime-hint-row,
    .dbx-forge-datetime-desc-row {
      flex: 1 1 100%;
    }
    .dbx-forge-datetime-desc-row .dbx-hint {
      font-size: 12px;
      margin-top: 0;
    }
    .dbx-forge-add-time-wrapper {
      display: flex;
      align-items: center;
      min-height: 56px;
    }
    .dbx-datetime-timezone {
      padding: 0 6px;
      pointer-events: none;
    }
  `
})
export class ForgeDateTimeFieldComponent {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  // ng-forge ValueFieldComponent inputs
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

  // Form controls
  readonly dateCtrl = new FormControl<Maybe<Date>>(null);
  readonly timeCtrl = new FormControl<Maybe<ReadableTimeString>>(null, {
    validators: [Validators.pattern(/^(now)$|^([0-9]|(0[0-9])|(1[0-9])|(2[0-3]))(:)?([0-5][0-9])?(\s)?([apAP][Mm])?(\\s)*$/)]
  });

  // Internal state
  private readonly _fullDay = signal(false);
  private readonly _timezone = signal<Maybe<TimezoneString>>(undefined);
  private readonly _pickerConfig = signal<Maybe<DbxDateTimePickerConfiguration>>(undefined);
  private readonly _timeDate = signal<Maybe<Date>>(undefined);
  private readonly _presetConfigs = signal<DateTimePresetConfiguration[]>([]);
  private _syncing = false;
  private _timezoneSub?: Subscription;
  private _pickerConfigSub?: Subscription;
  private _timeDateSub?: Subscription;
  private _presetsSub?: Subscription;

  // MARK: Computed Signals — derived from props
  readonly fieldLabel = computed(() => {
    const l = this.label();
    return typeof l === 'string' && l ? l : undefined;
  });

  readonly isRequired = computed(() => {
    try {
      const f = this.field();
      return (f as any)?.required?.() ?? false;
    } catch {
      return false;
    }
  });

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

  // Timezone
  readonly resolvedTimezone = computed(() => this._timezone() ?? guessCurrentTimezone());

  readonly timezoneInstance = computed<Maybe<DateTimezoneUtcNormalInstance>>(() => {
    const tz = this.resolvedTimezone();
    return tz ? dateTimezoneUtcNormal({ timezone: tz }) : undefined;
  });

  readonly tzAbbreviation = computed(() => {
    const tz = this.resolvedTimezone();
    const date = this.dateCtrl.value ?? this._timeDate() ?? new Date();
    return getTimezoneAbbreviation(tz, date);
  });

  // Picker config
  readonly dateMin = computed<Date | null>(() => {
    const config = this._pickerConfig();
    const minFromProps = this.props()?.minDate;
    const candidates = [config?.limits?.min ? dateFromLogicalDate(config.limits.min) : undefined, minFromProps ? safeToJsDate(minFromProps) : undefined].filter(Boolean) as Date[];
    return candidates.length > 0 ? (findMaxDate(candidates) ?? null) : null;
  });

  readonly dateMax = computed<Date | null>(() => {
    const config = this._pickerConfig();
    const maxFromProps = this.props()?.maxDate;
    const candidates = [config?.limits?.max ? dateFromLogicalDate(config.limits.max) : undefined, maxFromProps ? safeToJsDate(maxFromProps) : undefined].filter(Boolean) as Date[];
    return candidates.length > 0 ? (findMinDate(candidates) ?? null) : null;
  });

  readonly pickerFilter = computed<(d: Date | null) => boolean>(() => {
    const config = this._pickerConfig();
    if (config) {
      const filter = dateTimeMinuteWholeDayDecisionFunction(config, false);
      return (d: Date | null) => (d != null ? filter(d) : true);
    }
    return () => true;
  });

  // Presets
  readonly presetItems = computed<DateTimePreset[]>(() => this._presetConfigs().map(dateTimePreset));

  // Value parsing — reads raw FieldTree value and converts to system-timezone Date
  readonly parsedValue = computed<Maybe<Date>>(() => {
    try {
      const f = this.field();
      const raw = (f as any)?.value?.() as unknown;
      if (raw == null) return undefined;

      const parser = dbxDateTimeInputValueParseFactory(this.valueMode(), this.timezoneInstance());
      const result = parser(raw as Maybe<Date | string | number>);
      if (result instanceof Date && isNaN(result.getTime())) return undefined;
      return result;
    } catch {
      return undefined;
    }
  });

  readonly hasValue = computed(() => this.parsedValue() != null);

  // Display value — safe for template pipes
  readonly displayDate = computed<Maybe<Date>>(() => {
    const v = this.parsedValue();
    return v instanceof Date && !isNaN(v.getTime()) ? v : undefined;
  });

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
        this._timezoneSub = asObservableFromGetter(p.timezone).subscribe((tz) => this._timezone.set(tz));
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
      }
    });

    // Sync inbound: FieldTree value → form controls
    effect(() => {
      const date = this.parsedValue();
      if (this._syncing) return;
      this._syncing = true;

      if (date) {
        const currentDateCtrl = this.dateCtrl.value;
        if (!currentDateCtrl || !isSameDateDay(currentDateCtrl, date)) {
          this.dateCtrl.setValue(date, { emitEvent: false });
        }

        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;
        if (timeStr !== this.timeCtrl.value) {
          this.timeCtrl.setValue(toLocalReadableTimeString(date), { emitEvent: false });
        }
      } else {
        if (this.dateCtrl.value != null) this.dateCtrl.setValue(null, { emitEvent: false });
        if (this.timeCtrl.value) this.timeCtrl.setValue(null, { emitEvent: false });
      }

      this._syncing = false;
    });

    // Sync outbound: form controls → FieldTree
    const dateSub = this.dateCtrl.valueChanges.subscribe(() => this._syncOutbound());
    const timeSub = this.timeCtrl.valueChanges.subscribe(() => this._syncOutbound());

    this.destroyRef.onDestroy(() => {
      dateSub.unsubscribe();
      timeSub.unsubscribe();
      this._timezoneSub?.unsubscribe();
      this._pickerConfigSub?.unsubscribe();
      this._timeDateSub?.unsubscribe();
      this._presetsSub?.unsubscribe();
    });
  }

  // MARK: Actions
  onDatePicked(event: MatDatepickerInputEvent<Date>): void {
    this.dateCtrl.setValue(event.value);
  }

  clearValue(): void {
    this.dateCtrl.setValue(null);
    this.timeCtrl.setValue(null);
    this._setFieldValue(undefined);
  }

  addTime(): void {
    this._fullDay.set(false);
  }

  removeTime(): void {
    this._fullDay.set(true);
    this.timeCtrl.setValue(null);
    this._syncOutbound();
  }

  selectPreset(preset: DateTimePreset): void {
    const value = preset.value();
    if (value.logicalDate) {
      const date = dateFromLogicalDate(value.logicalDate);
      if (date) this.timeCtrl.setValue(toLocalReadableTimeString(date));
    } else if (value.timeString) {
      this.timeCtrl.setValue(value.timeString);
    }
  }

  onTimeFocus(): void {
    const el = document.activeElement as HTMLInputElement;
    if (el?.select) el.select();
  }

  onTimeBlur(): void {
    this._syncOutbound();
  }

  onTimeKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const step = event.key === 'ArrowUp' ? this.minuteStep() : -this.minuteStep();
      this._adjustTime(step);
    }
  }

  // MARK: Internal
  private _adjustTime(minutesDelta: number): void {
    const currentDate = this._buildCombinedDate();
    if (!currentDate) return;

    let newDate = addMinutes(currentDate, minutesDelta);

    // Clamp to picker config limits
    const config = this._pickerConfig();
    if (config) {
      const instance = new DateTimeMinuteInstance({ date: newDate, ...config, roundDownToMinute: true });
      newDate = instance.clamp(newDate);
    }

    this.dateCtrl.setValue(newDate, { emitEvent: false });
    this.timeCtrl.setValue(toLocalReadableTimeString(newDate), { emitEvent: false });
    this._syncOutbound();
  }

  private _buildCombinedDate(): Maybe<Date> {
    const dateValue = this.dateCtrl.value;
    const timeValue = this.timeCtrl.value;
    const fullDay = this._fullDay();
    const timeDate = this._timeDate();

    let baseDate = dateValue;
    if (!baseDate && this.isTimeOnly()) {
      baseDate = timeDate ?? new Date();
    }
    if (!baseDate) return undefined;

    if (fullDay) {
      return this.props()?.fullDayInUTC ? utcDayForDate(baseDate) : startOfDay(baseDate);
    }

    if (timeValue) {
      const combined = readableTimeStringToDate(timeValue, { date: baseDate, useSystemTimezone: true });
      return combined ?? baseDate;
    }

    if (!this.isTimeOnly() && this.timeMode() !== DbxDateTimeFieldTimeMode.REQUIRED) {
      return baseDate;
    }

    return undefined;
  }

  private _syncOutbound(): void {
    if (this._syncing) return;
    this._syncing = true;

    const combinedDate = this._buildCombinedDate();
    const outputFactory = dbxDateTimeOutputValueFactory(this.valueMode(), this.timezoneInstance());
    const outputValue = outputFactory(combinedDate);
    this._setFieldValue(outputValue);

    this._syncing = false;
  }

  private _setFieldValue(value: unknown): void {
    const f = this.field();
    if (!f) return;

    try {
      if (typeof (f as any).setValue === 'function') {
        (f as any).setValue(value);
      } else if (typeof (f as any).value === 'function') {
        const sig = (f as any).value;
        if (sig.set) sig.set(value);
      }
    } catch {
      // Silently handle field update errors
    }
  }
}

// MARK: Mapper
/**
 * Custom mapper for the datetime field type.
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
