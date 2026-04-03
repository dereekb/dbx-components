import type { MatDatepickerField, MatDatepickerProps } from '@ng-forge/dynamic-forms-material';
import type { FieldDef } from '@ng-forge/dynamic-forms';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';

// MARK: Date Field
/**
 * Configuration for a forge date picker field.
 */
export interface ForgeDateFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Minimum selectable date.
   */
  readonly minDate?: Date | string;
  /**
   * Maximum selectable date.
   */
  readonly maxDate?: Date | string;
  /**
   * Date to start the calendar view at when opened.
   */
  readonly startAt?: Date;
}

/**
 * Creates a forge field definition for a date picker input.
 *
 * Uses the native ng-forge MatDatepickerField.
 *
 * @param config - Date field configuration including key, label, and date constraints
 * @returns A validated {@link MatDatepickerField}
 *
 * @example
 * ```typescript
 * const field = forgeDateField({ key: 'startDate', label: 'Start Date', required: true });
 * ```
 */
export function forgeDateField(config: ForgeDateFieldConfig): MatDatepickerField {
  const { key, label, required, readonly: isReadonly, description, minDate, maxDate, startAt } = config;

  const props: Partial<MatDatepickerProps> = filterFromPOJO({
    hint: description
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: 'datepicker' as const,
      label: label ?? '',
      value: undefined as unknown as Date,
      required,
      readonly: isReadonly,
      minDate,
      maxDate,
      startAt,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as MatDatepickerField
  );
}

// MARK: DateTime Field
/**
 * Configuration for a forge date-time picker field combining date and time selection.
 */
export interface ForgeDateTimeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge field definition for a combined date-time picker.
 *
 * TODO: Requires custom ValueFieldComponent implementation.
 * Currently throws an error indicating it is not yet implemented.
 *
 * @param _config - Date-time field configuration
 * @returns A {@link FieldDef}
 */
export function forgeDateTimeField(_config: ForgeDateTimeFieldConfig): FieldDef<unknown> {
  throw new Error('forgeDateTimeField requires a custom ValueFieldComponent. Not yet implemented.');
}

// MARK: Date Range Field
/**
 * Configuration for a forge date range field with start and end date selection.
 */
export interface ForgeDateRangeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge field definition for a date range picker (start and end dates).
 *
 * TODO: Requires custom ValueFieldComponent implementation.
 * Currently throws an error indicating it is not yet implemented.
 *
 * @param _config - Date range field configuration
 * @returns A {@link FieldDef}
 */
export function forgeDateRangeField(_config: ForgeDateRangeFieldConfig): FieldDef<unknown> {
  throw new Error('forgeDateRangeField requires a custom ValueFieldComponent. Not yet implemented.');
}

// MARK: DateTime Range Field
/**
 * Configuration for a forge date-time range field with start and end date-time selection.
 */
export interface ForgeDateTimeRangeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge field definition for a date-time range picker (start and end date-times).
 *
 * TODO: Requires custom ValueFieldComponent implementation.
 * Currently throws an error indicating it is not yet implemented.
 *
 * @param _config - Date-time range field configuration
 * @returns A {@link FieldDef}
 */
export function forgeDateTimeRangeField(_config: ForgeDateTimeRangeFieldConfig): FieldDef<unknown> {
  throw new Error('forgeDateTimeRangeField requires a custom ValueFieldComponent. Not yet implemented.');
}

// MARK: Fixed Date Range Field
/**
 * Configuration for a forge fixed date range field that uses a calendar-style range picker.
 */
export interface ForgeFixedDateRangeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge field definition for a fixed date range picker.
 *
 * TODO: Requires custom ValueFieldComponent implementation.
 * Currently throws an error indicating it is not yet implemented.
 *
 * @param _config - Fixed date range field configuration
 * @returns A {@link FieldDef}
 */
export function forgeFixedDateRangeField(_config: ForgeFixedDateRangeFieldConfig): FieldDef<unknown> {
  throw new Error('forgeFixedDateRangeField requires a custom ValueFieldComponent. Not yet implemented.');
}
