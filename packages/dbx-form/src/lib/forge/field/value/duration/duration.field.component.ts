import { Component, ChangeDetectionStrategy, input, computed, effect, type Signal, type InputSignal, DestroyRef, inject, viewChild, ElementRef } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AsyncPipe } from '@angular/common';
import { DynamicTextPipe, type DynamicText, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs, createResolvedErrorsSignal, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG } from '@ng-forge/dynamic-forms-material';
import type { FieldTree } from '@angular/forms/signals';
import { type TimeUnit, type HoursAndMinutes, ALL_TIME_UNITS, hoursAndMinutesToTimeUnit, millisecondsToTimeUnit, minutesToHoursAndMinutes, timeUnitToMilliseconds } from '@dereekb/util';
import { type TimeDurationData, durationDataToMilliseconds, formatDurationString, millisecondsToDurationData, parseDurationString } from '@dereekb/date';
import { DbxPopoverService } from '@dereekb/dbx-web';
import { DbxDurationPickerPopoverComponent } from '../../../../formly/field/value/duration/duration.picker.popover.component';
import type { TimeDurationFieldValueMode } from '../../../../formly/field/value/duration/duration.field';
import { forgeFieldDisabled } from '../../field.disabled';
import { toggleDisableFormControl } from '../../../../form/form';

/**
 * Custom props for the forge time duration field.
 */
export interface DbxForgeTimeDurationFieldComponentProps {
  /**
   * The unit of the output value.
   *
   * Defaults to `'ms'`.
   */
  readonly outputUnit?: TimeUnit;
  /**
   * Output value mode.
   *
   * Defaults to `'number'`.
   */
  readonly valueMode?: TimeDurationFieldValueMode;
  /**
   * The time units available for the field.
   * Controls which units the parser recognizes and default popover columns.
   *
   * Defaults to all time units.
   */
  readonly allowedUnits?: TimeUnit[];
  /**
   * Which units to show in the popover picker.
   *
   * Defaults to allowedUnits filtered to exclude 'ms'.
   */
  readonly pickerUnits?: TimeUnit[];
  /**
   * Minimum output value (in the output unit).
   */
  readonly min?: number;
  /**
   * Maximum output value (in the output unit).
   */
  readonly max?: number;
  /**
   * Whether the popover picker carries over values to the next larger unit.
   */
  readonly carryOver?: boolean;
  /**
   * Material form field appearance.
   */
  readonly appearance?: 'fill' | 'outline';
  /**
   * Hint text displayed below the field.
   */
  readonly hint?: DynamicText;
}

/**
 * Custom ng-forge field component for time duration input with text parsing and a popover picker.
 *
 * The text input accepts duration strings like "3d10h5m8s", "2 hours 30 minutes", etc.
 * A picker button opens a popover with +/- columns for each time unit.
 *
 * This component bridges a FormControl-based duration input with ng-forge Signal Forms.
 *
 * Registered as ng-forge type 'timeduration'.
 */
@Component({
  selector: 'dbx-forge-timeduration-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule, ReactiveFormsModule, DynamicTextPipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './duration.field.component.html'
})
export class DbxForgeTimeDurationFieldComponent {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly popoverService = inject(DbxPopoverService);
  private readonly destroyRef = inject(DestroyRef);

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<unknown>> = input.required<FieldTree<unknown>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<DbxForgeTimeDurationFieldComponentProps | undefined> = input<DbxForgeTimeDurationFieldComponentProps | undefined>();
  readonly meta: InputSignal<Record<string, unknown> | undefined> = input<Record<string, unknown> | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  /**
   * Internal FormControl for the text input.
   */
  readonly textCtrl = new FormControl<string>('');

  readonly pickerButtonElement = viewChild<string, ElementRef>('pickerButton', { read: ElementRef });

  /**
   * Tracks the last parsed duration data for the picker popover.
   */
  private _currentDurationData: TimeDurationData = {};

  // Computed props
  readonly effectiveAppearance = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline');

  readonly outputUnitSignal: Signal<TimeUnit> = computed(() => this.props()?.outputUnit ?? 'ms');
  readonly valueModeSignal: Signal<TimeDurationFieldValueMode> = computed(() => this.props()?.valueMode ?? 'number');
  readonly allowedUnitsSignal: Signal<TimeUnit[]> = computed(() => this.props()?.allowedUnits ?? (ALL_TIME_UNITS as unknown as TimeUnit[]));
  readonly pickerUnitsSignal: Signal<TimeUnit[]> = computed(() => this.props()?.pickerUnits ?? this.allowedUnitsSignal().filter((u) => u !== 'ms'));

  /**
   * Units used for decomposing/displaying duration text.
   */
  readonly displayUnitsSignal: Signal<TimeUnit[]> = computed(() => {
    const units = [...this.pickerUnitsSignal()];

    if (!units.includes('ms')) {
      units.push('ms');
    }

    return units;
  });

  // Disabled state
  readonly isDisabled = forgeFieldDisabled();

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field as Signal<FieldTree<unknown>>, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field as Signal<FieldTree<unknown>>);
  readonly errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  /**
   * Flag to prevent feedback loops during sync.
   */
  private _syncing = false;

  constructor() {
    // Disabled state propagation
    effect(() => {
      const disabled = this.isDisabled();
      toggleDisableFormControl(this.textCtrl, disabled);
    });

    // Sync Signal Forms field -> text control (inbound)
    effect(() => {
      const fieldTree = this.field();
      const fieldState = fieldTree();
      const signalValue: unknown = fieldState.value();

      // Also read computed dependencies so the effect re-runs on config changes
      const outputUnit = this.outputUnitSignal();
      const valueMode = this.valueModeSignal();
      const displayUnits = this.displayUnitsSignal();

      if (!this._syncing) {
        this._syncing = true;

        if (signalValue == null) {
          this._currentDurationData = {};
          this.textCtrl.setValue('', { emitEvent: false });
        } else {
          const ms = this._outputValueToMilliseconds(signalValue, outputUnit, valueMode);
          this._currentDurationData = millisecondsToDurationData(ms, displayUnits);
          this.textCtrl.setValue(formatDurationString(this._currentDurationData), { emitEvent: false });
        }

        this._syncing = false;
      }
    });
  }

  /**
   * Called when the text input loses focus. Parses the text and updates the output.
   */
  onTextBlur(): void {
    this._parseAndSync();
  }

  /**
   * Called when Enter is pressed in the text input.
   *
   * @param event - The keyboard event triggered by pressing Enter
   */
  onTextEnter(event: Event): void {
    event.preventDefault();
    this._parseAndSync();
  }

  /**
   * Opens the duration picker popover.
   */
  openPicker(): void {
    const origin = this.pickerButtonElement();

    if (!origin) {
      return;
    }

    const existingMs = this._currentDurationData.milliseconds;
    const outputUnit = this.outputUnitSignal();

    const onPickerChange = (data: TimeDurationData) => {
      // Preserve milliseconds from the existing data since the popover doesn't show them
      const merged: TimeDurationData = existingMs ? { ...data, milliseconds: existingMs } : data;
      this._currentDurationData = merged;
      this.textCtrl.setValue(formatDurationString(merged), { emitEvent: false });
      this._syncOutputFromDurationData(merged);
    };

    const propsValue = this.props();
    const minMs = propsValue?.min != null ? timeUnitToMilliseconds(propsValue.min, outputUnit) : undefined;
    const maxMs = propsValue?.max != null ? timeUnitToMilliseconds(propsValue.max, outputUnit) : undefined;

    DbxDurationPickerPopoverComponent.openPopover(this.popoverService, {
      origin,
      data: {
        current: this._currentDurationData,
        units: this.pickerUnitsSignal(),
        onChange: onPickerChange,
        minMs,
        maxMs,
        carryOver: propsValue?.carryOver
      }
    });
  }

  /**
   * Parses the current text input and syncs the output value.
   */
  private _parseAndSync(): void {
    if (this._syncing) {
      return;
    }

    const text = this.textCtrl.value?.trim();

    if (!text) {
      this._currentDurationData = {};
      this._setFieldValue(undefined);
      return;
    }

    const parsed = parseDurationString(text);
    this._currentDurationData = parsed;

    // Re-format the display text to normalize it
    this.textCtrl.setValue(formatDurationString(parsed), { emitEvent: false });
    this._syncOutputFromDurationData(parsed);
  }

  /**
   * Converts duration data to the output value and sets it on the field.
   *
   * @param data - The parsed duration data containing time unit values
   */
  private _syncOutputFromDurationData(data: TimeDurationData): void {
    const ms = durationDataToMilliseconds(data);
    const outputUnit = this.outputUnitSignal();
    const valueMode = this.valueModeSignal();

    let outputValue: unknown;

    if (valueMode === 'duration_data') {
      outputValue = data;
    } else if (valueMode === 'hours_and_minutes') {
      const totalMinutes = ms / 60000;
      outputValue = minutesToHoursAndMinutes(Math.round(totalMinutes));
    } else {
      outputValue = millisecondsToTimeUnit(ms, outputUnit);
    }

    this._setFieldValue(outputValue);
  }

  /**
   * Writes a value to the Signal Forms field tree.
   *
   * @param value - The value to set on the field, or undefined to clear it
   */
  private _setFieldValue(value: unknown): void {
    this._syncing = true;

    const fieldTree = this.field();
    const fieldState = fieldTree();
    fieldState.value.set(value);
    fieldState.markAsTouched();
    fieldState.markAsDirty();

    this._syncing = false;
  }

  /**
   * Converts an output value (number, HoursAndMinutes, or TimeDurationData) to milliseconds.
   *
   * @param value - The output value to convert (number, HoursAndMinutes, or TimeDurationData depending on valueMode)
   * @param outputUnit - The time unit of the numeric output value (used when valueMode is 'number')
   * @param valueMode - The current value mode determining how to interpret the value
   * @returns The equivalent duration in milliseconds
   */
  private _outputValueToMilliseconds(value: unknown, outputUnit: TimeUnit, valueMode: TimeDurationFieldValueMode): number {
    let result: number;

    if (valueMode === 'duration_data') {
      result = durationDataToMilliseconds(value as TimeDurationData);
    } else if (valueMode === 'hours_and_minutes') {
      const hm = value as HoursAndMinutes;
      result = hoursAndMinutesToTimeUnit(hm, 'ms');
    } else {
      result = timeUnitToMilliseconds(value as number, outputUnit);
    }

    return result;
  }
}

// MARK: Mapper
/**
 * Custom mapper for the timeduration field type.
 *
 * Uses the standard valueFieldMapper pattern from ng-forge/integration to resolve
 * the field tree and build the standard inputs for the component.
 *
 * @param fieldDef - The time duration field definition
 * @param fieldDef.key - Form model key for the field
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
export function timeDurationFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
