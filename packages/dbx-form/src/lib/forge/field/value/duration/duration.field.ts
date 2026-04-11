import type { BaseValueField } from '@ng-forge/dynamic-forms';
import { type TimeUnit, filterFromPOJO } from '@dereekb/util';
import type { TimeDurationFieldValueMode } from '../../../../formly/field/value/duration/duration.field';
import type { DbxForgeTimeDurationFieldComponentProps } from './duration.field.component';
import { forgeField } from '../../field';
import type { DbxForgeFieldConfig } from '../../field.type';

/**
 * The custom forge field type name for the time duration field.
 */
export const FORGE_TIMEDURATION_FIELD_TYPE = 'timeduration' as const;

/**
 * Field definition type for a forge time duration field.
 */
export type DbxForgeTimeDurationFieldDef = BaseValueField<DbxForgeTimeDurationFieldComponentProps, unknown> & {
  readonly type: typeof FORGE_TIMEDURATION_FIELD_TYPE;
};

// MARK: TimeDuration Field
/**
 * Configuration for a forge time duration input field.
 */
export interface DbxForgeTimeDurationFieldConfig extends DbxForgeFieldConfig {
  readonly label?: string;
  readonly description?: string;
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
   * Whether the popover picker should carry over values to the next larger unit.
   */
  readonly carryOver?: boolean;
}

/**
 * Creates a forge field definition for a time duration input.
 *
 * Uses a custom ng-forge ValueFieldComponent that provides a text input
 * accepting duration strings (e.g. "2h30m") and a popover picker.
 *
 * @param config - Time duration field configuration
 * @returns A {@link DbxForgeTimeDurationFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeTimeDurationField({
 *   key: 'timeout',
 *   label: 'Timeout',
 *   outputUnit: 'min',
 *   min: 0,
 *   max: 480
 * });
 * ```
 */
export function forgeTimeDurationField(config: DbxForgeTimeDurationFieldConfig): DbxForgeTimeDurationFieldDef {
  const { key, label, required, readonly: isReadonly, description, logic, outputUnit, valueMode, allowedUnits, pickerUnits, min, max, carryOver } = config;

  const props: DbxForgeTimeDurationFieldComponentProps = filterFromPOJO({
    outputUnit,
    valueMode,
    allowedUnits,
    pickerUnits,
    min,
    max,
    carryOver,
    hint: description
  });

  return forgeField({
    key,
    type: FORGE_TIMEDURATION_FIELD_TYPE,
    label: label ?? '',
    value: undefined as unknown,
    required,
    readonly: isReadonly,
    logic,
    props: Object.keys(props).length > 0 ? props : undefined
  } as DbxForgeTimeDurationFieldDef);
}
