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
 * Inline calendar-style date-range picker with fixed range length (e.g. "7 days from start"). Wrapped in a Material form-field container with a custom selection strategy.
 *
 * Uses an inline `<mat-calendar>` with a custom selection strategy, matching the formly
 * `fixedDateRangeField()` behavior. Supports multiple selection modes, timezone conversion,
 * date range input configuration, and optional text inputs.
 *
 * @param config - Fixed date range field configuration
 * @returns A {@link DbxForgeFixedDateRangeFieldDef}
 *
 * @dbxFormField
 * @dbxFormSlug fixed-date-range
 * @dbxFormTier field-factory
 * @dbxFormProduces DbxForgeFixedDateRangeValue
 * @dbxFormArrayOutput no
 * @dbxFormNgFormType fixeddaterange
 * @dbxFormWrapperPattern material-form-field-wrapped
 * @dbxFormConfigInterface DbxForgeFixedDateRangeFieldConfig
 * @dbxFormPropsInterface DbxForgeFixedDateRangeFieldComponentProps
 *
 * @example
 * ```typescript
 * dbxForgeFixedDateRangeField({ key: 'range', label: 'Date Range' })
 * ```
 */
export const dbxForgeFixedDateRangeField = dbxForgeFieldFunction<DbxForgeFixedDateRangeFieldConfig>({
  type: FORGE_FIXEDDATERANGE_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x) => {
    x.configure(configureDbxForgeFormFieldWrapper);
  })
}) as DbxForgeFieldFunction<DbxForgeFixedDateRangeFieldConfig, DbxForgeFixedDateRangeFieldDef>;
