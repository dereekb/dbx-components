import type { BaseValueField } from '@ng-forge/dynamic-forms';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../../field';
import type { DbxForgeFixedDateRangeFieldComponentProps, DbxForgeFixedDateRangeValue } from './fixeddaterange.field.component';

// MARK: Fixed Date Range Field
/**
 * The custom forge field type name for the fixed date range field.
 */
export const FORGE_FIXEDDATERANGE_FIELD_TYPE = 'fixeddaterange' as const;

/**
 * Field definition type for a forge fixed date range field.
 */
export type DbxForgeFixedDateRangeFieldDef = BaseValueField<DbxForgeFixedDateRangeFieldComponentProps, DbxForgeFixedDateRangeValue> & {
  readonly type: typeof FORGE_FIXEDDATERANGE_FIELD_TYPE;
};

/**
 * Configuration for a forge fixed date range field using an inline calendar-style range picker.
 *
 * Full parity with the formly `FixedDateRangeFieldConfig`.
 */
export interface DbxForgeFixedDateRangeFieldConfig extends DbxForgeFieldFunctionDef<DbxForgeFixedDateRangeFieldDef> {}

/**
 * Creates a forge field definition for a fixed date range picker wrapped in a Material-style
 * outlined container with a notched outline and floating label.
 *
 * Uses an inline `<mat-calendar>` with a custom selection strategy, matching the formly
 * `fixedDateRangeField()` behavior. Supports multiple selection modes, timezone conversion,
 * date range input configuration, and optional text inputs.
 *
 * The field is wrapped by `configureDbxForgeFormFieldWrapper` which provides the Material outlined
 * container, equivalent to formly's `['style', 'form-field']` wrappers.
 *
 * @param config - Fixed date range field configuration
 * @returns A {@link DbxForgeFixedDateRangeFieldDef}
 *
 * @example
 * ```typescript
 * const field = dbxForgeFixedDateRangeField({
 *   key: 'dateRange',
 *   label: 'Fixed Date Range',
 *   required: true,
 *   props: {
 *     dateRangeInput: { type: DateRangeType.WEEKS_RANGE, distance: 1 },
 *     pickerConfig: { limits: { min: 'today_start', max: addMonths(endOfMonth(new Date()), 1) } },
 *     valueMode: DbxDateTimeValueMode.DATE_STRING
 *   }
 * });
 * ```
 */
export const dbxForgeFixedDateRangeField = dbxForgeFieldFunction<DbxForgeFixedDateRangeFieldConfig>({
  type: FORGE_FIXEDDATERANGE_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x) => {
    x.configure(configureDbxForgeFormFieldWrapper);
  })
}) as DbxForgeFieldFunction<DbxForgeFixedDateRangeFieldConfig, DbxForgeFixedDateRangeFieldDef>;
