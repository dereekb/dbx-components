import type { MatDatepickerField } from '@ng-forge/dynamic-forms-material';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../../field';

// MARK: Date Field
/**
 * Configuration for a forge date picker field.
 */
export interface DbxForgeDateFieldConfig extends DbxForgeFieldFunctionDef<MatDatepickerField> {}

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
 * const field = dbxForgeDateField({ key: 'startDate', label: 'Start Date', required: true });
 * ```
 */
export const dbxForgeDateField = dbxForgeFieldFunction<DbxForgeDateFieldConfig>({
  type: 'datepicker' as const,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder()
}) as DbxForgeFieldFunction<DbxForgeDateFieldConfig, MatDatepickerField>;
