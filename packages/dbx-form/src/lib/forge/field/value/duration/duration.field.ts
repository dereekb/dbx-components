import type { BaseValueField } from '@ng-forge/dynamic-forms';
import { type TimeUnit, filterFromPOJO } from '@dereekb/util';
import type { TimeDurationFieldValueMode } from '../../../../formly/field/value/duration/duration.field';
import type { DbxForgeTimeDurationFieldComponentProps } from './duration.field.component';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../../field';

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
export interface DbxForgeTimeDurationFieldConfig extends DbxForgeFieldFunctionDef<DbxForgeTimeDurationFieldDef> {
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
 * const field = dbxForgeTimeDurationField({
 *   key: 'timeout',
 *   label: 'Timeout',
 *   outputUnit: 'min',
 *   min: 0,
 *   max: 480
 * });
 * ```
 */
export const dbxForgeTimeDurationField = dbxForgeFieldFunction<DbxForgeTimeDurationFieldConfig>({
  type: FORGE_TIMEDURATION_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((config) =>
    filterFromPOJO({
      outputUnit: config.outputUnit,
      valueMode: config.valueMode,
      allowedUnits: config.allowedUnits,
      pickerUnits: config.pickerUnits,
      min: config.min,
      max: config.max,
      carryOver: config.carryOver
    })
  )
}) as DbxForgeFieldFunction<DbxForgeTimeDurationFieldConfig, DbxForgeTimeDurationFieldDef>;
