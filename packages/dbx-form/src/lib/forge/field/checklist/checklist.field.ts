import type { MatMultiCheckboxField } from '@ng-forge/dynamic-forms-material';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef } from '../field';
import type { DbxForgeField } from '../../form/forge.form';

/**
 * Configuration for a forge multi-checkbox (checklist) field.
 */
export interface DbxForgeChecklistFieldConfig<T = unknown> extends DbxForgeFieldFunctionDef<MatMultiCheckboxField<T>> {}

/**
 * Generic function type for dbxForgeChecklistField to preserve caller generics.
 */
export type DbxForgeChecklistFieldFunction = <T = unknown>(config: DbxForgeChecklistFieldConfig<T>) => DbxForgeField<MatMultiCheckboxField<T>>;

/**
 * @deprecated Use {@link DbxForgeChecklistFieldFunction} instead.
 */
export type ForgeChecklistFieldFunction = DbxForgeChecklistFieldFunction;

/**
 * Multi-checkbox group. Use for small static option sets where every option is visible at once.
 *
 * @param config - Checklist field configuration
 * @returns A validated {@link MatMultiCheckboxField} with type `'multi-checkbox'`
 *
 * @dbxFormField
 * @dbxFormSlug checklist
 * @dbxFormTier field-factory
 * @dbxFormProduces T[]
 * @dbxFormArrayOutput yes
 * @dbxFormNgFormType multi-checkbox
 * @dbxFormWrapperPattern unwrapped
 * @dbxFormConfigInterface DbxForgeChecklistFieldConfig<T>
 * @dbxFormGeneric <T = unknown>
 *
 * @example
 * ```typescript
 * dbxForgeChecklistField<string>({ key: 'flags', props: { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } })
 * ```
 */
export const dbxForgeChecklistField = dbxForgeFieldFunction<DbxForgeChecklistFieldConfig>({
  type: 'multi-checkbox' as const,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder()
}) as DbxForgeChecklistFieldFunction;
