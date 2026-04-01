import { type ValidatorFn, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type TimeUnit, type HoursAndMinutes, TIME_UNIT_LABEL_MAP, millisecondsToTimeUnit, hoursAndMinutesToTimeUnit } from '@dereekb/util';
import { type TimeDurationData, durationDataToMilliseconds } from '@dereekb/date';
import { type DescriptionFieldConfig, type LabeledFieldConfig, type MaterialFormFieldConfig, formlyField, propsAndConfigForFieldConfig, validatorsForFieldConfig } from '../../field';

// MARK: TimeDurationFieldValueMode
/**
 * Determines the shape of the output value from a time duration field.
 *
 * - `'number'` — output is a single number in the configured output unit
 * - `'hours_and_minutes'` — output is an HoursAndMinutes object
 * - `'duration_data'` — output is a TimeDurationData object
 */
export type TimeDurationFieldValueMode = 'number' | 'hours_and_minutes' | 'duration_data';

// MARK: TimeDurationFieldConfig
/**
 * Configuration for creating a time duration input field.
 *
 * Combines labeling, description, Material styling, and duration-specific props.
 */
export interface TimeDurationFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, MaterialFormFieldConfig {
  /**
   * The unit of the output value.
   *
   * Defaults to `'ms'` (milliseconds).
   */
  readonly outputUnit?: TimeUnit;
  /**
   * The output value mode.
   *
   * Defaults to `'number'`.
   */
  readonly valueMode?: TimeDurationFieldValueMode;
  /**
   * The time units available for the field.
   * Controls which units the parser recognizes and the default popover columns.
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
   * Minimum output value (expressed in the output unit).
   */
  readonly min?: number;
  /**
   * Maximum output value (expressed in the output unit).
   */
  readonly max?: number;
  /**
   * Whether the popover picker should carry over values to the next larger unit
   * (e.g., 60 seconds → 1 minute). Only carries into units present in the picker.
   *
   * Defaults to false.
   */
  readonly carryOver?: boolean;
}

// MARK: Validator
/**
 * Creates a ValidatorFn that checks the duration output value against min/max constraints.
 *
 * @param config - The duration field config containing min, max, outputUnit, and valueMode
 * @returns A ValidatorFn, or undefined if no min/max is configured
 */
function timeDurationMinMaxValidator(config: Partial<TimeDurationFieldConfig>): ValidatorFn | undefined {
  const { min, max, outputUnit = 'ms', valueMode = 'number' } = config;

  if (min == null && max == null) {
    return undefined;
  }

  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (value == null) {
      return null;
    }

    let outputValue: number;

    if (valueMode === 'duration_data') {
      const data = value as TimeDurationData;
      const totalMs = durationDataToMilliseconds(data);
      outputValue = millisecondsToTimeUnit(totalMs, outputUnit);
    } else if (valueMode === 'hours_and_minutes') {
      const hm = value as HoursAndMinutes;
      const totalMs = hoursAndMinutesToTimeUnit(hm, 'ms');
      outputValue = totalMs / 60000; // compare in minutes
    } else {
      outputValue = value as number;
    }

    const unitLabel = TIME_UNIT_LABEL_MAP[valueMode === 'hours_and_minutes' ? 'min' : outputUnit].toLowerCase();
    const actualRounded = Math.round(outputValue * 100) / 100;
    const errors: ValidationErrors = {};

    if (min != null && outputValue < min) {
      errors['durationMin'] = { min, actual: actualRounded, unit: unitLabel };
    }

    if (max != null && outputValue > max) {
      errors['durationMax'] = { max, actual: actualRounded, unit: unitLabel };
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

/**
 * Creates a Formly field configuration for a time duration input.
 *
 * The field uses a text input that parses duration strings (e.g., "3d10h5m8s",
 * "2 hours 30 minutes") and a popover picker button with +/- columns for each unit.
 *
 * @param config - Time duration field configuration
 * @returns A validated {@link FormlyFieldConfig} with type `'timeduration'`
 *
 * @example
 * ```typescript
 * // Basic usage — output in milliseconds
 * const field = timeDurationField({
 *   key: 'timeout',
 *   label: 'Timeout',
 *   outputUnit: 'ms',
 *   allowedUnits: ['min', 'h', 'd']
 * });
 *
 * // With min/max constraints — output in minutes, max 8 hours
 * const constrained = timeDurationField({
 *   key: 'duration',
 *   label: 'Duration',
 *   outputUnit: 'min',
 *   min: 0,
 *   max: 480
 * });
 *
 * // HoursAndMinutes output mode
 * const hoursMin = timeDurationField({
 *   key: 'workTime',
 *   label: 'Work Time',
 *   valueMode: 'hours_and_minutes',
 *   allowedUnits: ['min', 'h']
 * });
 * ```
 */
export function timeDurationField(config: Partial<TimeDurationFieldConfig> = {}): FormlyFieldConfig {
  const { key = 'duration', outputUnit, valueMode, allowedUnits, pickerUnits, min, max, carryOver, materialFormField } = config;

  const validators: ValidatorFn[] = [];
  const minMaxValidator = timeDurationMinMaxValidator(config);

  if (minMaxValidator) {
    validators.push(minMaxValidator);
  }

  return formlyField({
    key,
    type: 'timeduration',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      outputUnit,
      valueMode,
      allowedUnits,
      pickerUnits,
      min,
      max,
      carryOver
    } as any),
    ...validatorsForFieldConfig({ validators })
  });
}
