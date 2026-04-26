import type { MatDatepickerField } from '@ng-forge/dynamic-forms-material';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../../field';

// MARK: Date Field
/**
 * Configuration for a forge date picker field.
 */
export interface DbxForgeDateFieldConfig extends DbxForgeFieldFunctionDef<MatDatepickerField> {}

/**
 * Material datepicker (date-only, no time). For time-of-day picking use the `date-time` field; for ranges use `date-range-row` or `date-time-range-row`.
 *
 * Uses the native ng-forge MatDatepickerField.
 *
 * @param config - Date field configuration including key, label, and date constraints
 * @returns A validated {@link MatDatepickerField}
 *
 * @dbxFormField
 * @dbxFormSlug date
 * @dbxFormTier field-factory
 * @dbxFormProduces Date
 * @dbxFormArrayOutput no
 * @dbxFormNgFormType datepicker
 * @dbxFormWrapperPattern unwrapped
 * @dbxFormConfigInterface DbxForgeDateFieldConfig
 *
 * @example
 * ```typescript
 * dbxForgeDateField({ key: 'startDate', label: 'Start Date', required: true })
 * ```
 */
export const dbxForgeDateField = dbxForgeFieldFunction<DbxForgeDateFieldConfig>({
  type: 'datepicker' as const,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder()
}) as DbxForgeFieldFunction<DbxForgeDateFieldConfig, MatDatepickerField>;
