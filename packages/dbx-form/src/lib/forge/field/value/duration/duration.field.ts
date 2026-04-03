import type { FieldDef } from '@ng-forge/dynamic-forms';
import type { TimeUnit } from '@dereekb/util';
import type { TimeDurationFieldValueMode } from '../../../../formly/field/value/duration/duration.field';

// MARK: TimeDuration Field
/**
 * Configuration for a forge time duration input field.
 */
export interface ForgeTimeDurationFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
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
   * Minimum output value (expressed in the output unit).
   */
  readonly min?: number;
  /**
   * Maximum output value (expressed in the output unit).
   */
  readonly max?: number;
}

/**
 * Creates a forge field definition for a time duration input.
 *
 * TODO: Requires custom ValueFieldComponent implementation.
 * Currently throws an error indicating it is not yet implemented.
 *
 * @param _config - Time duration field configuration
 * @returns A {@link FieldDef}
 */
export function forgeTimeDurationField(_config: ForgeTimeDurationFieldConfig): FieldDef<unknown> {
  throw new Error('forgeTimeDurationField requires a custom ValueFieldComponent. Not yet implemented.');
}
