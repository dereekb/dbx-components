import type { MatDatepickerField, MatDatepickerProps } from '@ng-forge/dynamic-forms-material';
import type { FieldDef, BaseValueField } from '@ng-forge/dynamic-forms';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';
import type { ForgeDateTimeFieldComponentProps } from './datetime.field.component';
import type { ForgeDateRangeFieldComponentProps, ForgeDateRangeValue } from './daterange.field.component';
import type { ForgeFixedDateRangeFieldComponentProps, ForgeFixedDateRangeValue } from './fixeddaterange.field.component';

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
 * The custom forge field type name for the date-time field.
 */
export const FORGE_DATETIME_FIELD_TYPE = 'datetime' as const;

/**
 * Field definition type for a forge date-time field.
 */
export type ForgeDateTimeFieldDef = BaseValueField<ForgeDateTimeFieldComponentProps, unknown> & {
  readonly type: typeof FORGE_DATETIME_FIELD_TYPE;
};

/**
 * Configuration for a forge date-time picker field combining date and time selection.
 */
export interface ForgeDateTimeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Whether to show only the time picker (hide the date input).
   */
  readonly timeOnly?: boolean;
  /**
   * Whether to include a time input alongside the date picker.
   *
   * Defaults to true.
   */
  readonly showTime?: boolean;
  /**
   * Custom label for the date input.
   */
  readonly dateLabel?: string;
  /**
   * Custom label for the time input.
   */
  readonly timeLabel?: string;
  /**
   * Minimum selectable date.
   */
  readonly minDate?: Date | string;
  /**
   * Maximum selectable date.
   */
  readonly maxDate?: Date | string;
}

/**
 * Creates a forge field definition for a combined date-time picker.
 *
 * Uses a custom ng-forge ValueFieldComponent that renders separate date and time inputs.
 *
 * @param config - Date-time field configuration
 * @returns A {@link ForgeDateTimeFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeDateTimeField({ key: 'eventStart', label: 'Start', required: true });
 * ```
 */
export function forgeDateTimeField(config: ForgeDateTimeFieldConfig): ForgeDateTimeFieldDef {
  const { key, label, required, readonly: isReadonly, description, timeOnly, showTime, dateLabel, timeLabel, minDate, maxDate } = config;

  const props: ForgeDateTimeFieldComponentProps = filterFromPOJO({
    timeOnly,
    showTime,
    dateLabel,
    timeLabel,
    minDate,
    maxDate,
    hint: description
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: FORGE_DATETIME_FIELD_TYPE,
      label: label ?? '',
      value: undefined as unknown,
      required,
      readonly: isReadonly,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as ForgeDateTimeFieldDef
  );
}

// MARK: Date Range Field
/**
 * The custom forge field type name for the date range field.
 */
export const FORGE_DATERANGE_FIELD_TYPE = 'daterange' as const;

/**
 * Field definition type for a forge date range field.
 */
export type ForgeDateRangeFieldDef = BaseValueField<ForgeDateRangeFieldComponentProps, ForgeDateRangeValue> & {
  readonly type: typeof FORGE_DATERANGE_FIELD_TYPE;
};

/**
 * Configuration for a forge date range field with start and end date selection.
 */
export interface ForgeDateRangeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Custom label for the start date input.
   */
  readonly startLabel?: string;
  /**
   * Custom label for the end date input.
   */
  readonly endLabel?: string;
  /**
   * Whether to include time inputs alongside the date pickers.
   *
   * Defaults to false.
   */
  readonly showTime?: boolean;
  /**
   * Minimum selectable date.
   */
  readonly minDate?: Date | string;
  /**
   * Maximum selectable date.
   */
  readonly maxDate?: Date | string;
}

/**
 * Creates a forge field definition for a date range picker (start and end dates).
 *
 * Uses a custom ng-forge ValueFieldComponent that renders two date pickers.
 *
 * @param config - Date range field configuration
 * @returns A {@link ForgeDateRangeFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeDateRangeField({ key: 'period', label: 'Period', required: true });
 * ```
 */
export function forgeDateRangeField(config: ForgeDateRangeFieldConfig): ForgeDateRangeFieldDef {
  const { key, label, required, readonly: isReadonly, description, startLabel, endLabel, showTime, minDate, maxDate } = config;

  const props: ForgeDateRangeFieldComponentProps = filterFromPOJO({
    startLabel,
    endLabel,
    showTime,
    minDate,
    maxDate,
    hint: description
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: FORGE_DATERANGE_FIELD_TYPE,
      label: label ?? '',
      value: undefined as unknown as ForgeDateRangeValue,
      required,
      readonly: isReadonly,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as ForgeDateRangeFieldDef
  );
}

// MARK: DateTime Range Field
/**
 * Configuration for a forge date-time range field with start and end date-time selection.
 *
 * Reuses the date range field with `showTime` enabled.
 */
export interface ForgeDateTimeRangeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Custom label for the start date-time input.
   */
  readonly startLabel?: string;
  /**
   * Custom label for the end date-time input.
   */
  readonly endLabel?: string;
  /**
   * Minimum selectable date.
   */
  readonly minDate?: Date | string;
  /**
   * Maximum selectable date.
   */
  readonly maxDate?: Date | string;
}

/**
 * Creates a forge field definition for a date-time range picker (start and end date-times).
 *
 * This is a convenience wrapper around {@link forgeDateRangeField} with `showTime` enabled.
 *
 * @param config - Date-time range field configuration
 * @returns A {@link ForgeDateRangeFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeDateTimeRangeField({ key: 'shift', label: 'Shift', required: true });
 * ```
 */
export function forgeDateTimeRangeField(config: ForgeDateTimeRangeFieldConfig): ForgeDateRangeFieldDef {
  const { key, label, required, readonly: isReadonly, description, startLabel, endLabel, minDate, maxDate } = config;

  return forgeDateRangeField({
    key,
    label,
    required,
    readonly: isReadonly,
    description,
    startLabel: startLabel ?? 'Start',
    endLabel: endLabel ?? 'End',
    showTime: true,
    minDate,
    maxDate
  });
}

// MARK: Fixed Date Range Field
/**
 * The custom forge field type name for the fixed date range field.
 */
export const FORGE_FIXEDDATERANGE_FIELD_TYPE = 'fixeddaterange' as const;

/**
 * Field definition type for a forge fixed date range field.
 */
export type ForgeFixedDateRangeFieldDef = BaseValueField<ForgeFixedDateRangeFieldComponentProps, ForgeFixedDateRangeValue> & {
  readonly type: typeof FORGE_FIXEDDATERANGE_FIELD_TYPE;
};

/**
 * Configuration for a forge fixed date range field that uses a calendar-style range picker.
 */
export interface ForgeFixedDateRangeFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Custom label for the start date placeholder.
   */
  readonly startLabel?: string;
  /**
   * Custom label for the end date placeholder.
   */
  readonly endLabel?: string;
  /**
   * Minimum selectable date.
   */
  readonly minDate?: Date | string;
  /**
   * Maximum selectable date.
   */
  readonly maxDate?: Date | string;
}

/**
 * Creates a forge field definition for a fixed date range picker.
 *
 * Uses Angular Material's mat-date-range-input for inline start/end date picking.
 *
 * @param config - Fixed date range field configuration
 * @returns A {@link ForgeFixedDateRangeFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeFixedDateRangeField({ key: 'vacation', label: 'Vacation Period', required: true });
 * ```
 */
export function forgeFixedDateRangeField(config: ForgeFixedDateRangeFieldConfig): ForgeFixedDateRangeFieldDef {
  const { key, label, required, readonly: isReadonly, description, startLabel, endLabel, minDate, maxDate } = config;

  const props: ForgeFixedDateRangeFieldComponentProps = filterFromPOJO({
    startLabel,
    endLabel,
    minDate,
    maxDate,
    hint: description
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: FORGE_FIXEDDATERANGE_FIELD_TYPE,
      label: label ?? '',
      value: undefined as unknown as ForgeFixedDateRangeValue,
      required,
      readonly: isReadonly,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as ForgeFixedDateRangeFieldDef
  );
}
