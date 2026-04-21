import type { MatMultiCheckboxField } from '@ng-forge/dynamic-forms-material';
import { filterFromPOJO } from '@dereekb/util';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef } from '../field';
import type { DbxForgeField } from '../../form/forge.form';

/**
 * Configuration for a forge multi-checkbox (checklist) field.
 */
export interface DbxForgeChecklistFieldConfig<T = unknown> extends DbxForgeFieldFunctionDef<MatMultiCheckboxField<T>> {
  /**
   * Position of labels relative to the checkboxes.
   */
  readonly labelPosition?: 'before' | 'after';
}

/**
 * Generic function type for dbxForgeChecklistField to preserve caller generics.
 */
export type DbxForgeChecklistFieldFunction = <T = unknown>(config: DbxForgeChecklistFieldConfig<T>) => DbxForgeField<MatMultiCheckboxField<T>>;

/** @deprecated Use {@link DbxForgeChecklistFieldFunction} instead. */
export type ForgeChecklistFieldFunction = DbxForgeChecklistFieldFunction;

/**
 * Creates a forge field definition for a Material multi-checkbox (checklist) field.
 *
 * @param config - Checklist field configuration
 * @returns A validated {@link MatMultiCheckboxField} with type `'multi-checkbox'`
 *
 * @example
 * ```typescript
 * const field = dbxForgeChecklistField({
 *   key: 'tags',
 *   label: 'Tags',
 *   options: [
 *     { label: 'Frontend', value: 'frontend' },
 *     { label: 'Backend', value: 'backend' }
 *   ]
 * });
 * ```
 */
export const dbxForgeChecklistField = dbxForgeFieldFunction<DbxForgeChecklistFieldConfig>({
  type: 'multi-checkbox' as const,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((config) =>
    filterFromPOJO({
      labelPosition: config.labelPosition
    })
  )
}) as DbxForgeChecklistFieldFunction;
