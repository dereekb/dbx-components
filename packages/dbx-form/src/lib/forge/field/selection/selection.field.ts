import { FORGE_VALUE_SELECTION_FIELD_TYPE, type DbxForgeValueSelectionFieldDef, type DbxForgeValueSelectionFieldProps } from './selection.field.component';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef } from '../field';
import type { DbxForgeField } from '../../form/forge.form';

// MARK: Re-exports
export { resolveForgeSelectionOptions, type DbxForgeResolvedSelectionOption, type DbxForgeValueSelectionFieldProps, type DbxForgeValueSelectionFieldDef, FORGE_VALUE_SELECTION_FIELD_TYPE } from './selection.field.component';

// MARK: Config
/**
 * Configuration for a forge select (dropdown) field.
 *
 * Equivalent to formly's `ValueSelectionFieldConfig` — supports static and Observable options,
 * clear options, and multiple selection.
 */
export interface DbxForgeValueSelectionFieldConfig<T = unknown> extends Omit<DbxForgeFieldFunctionDef<DbxForgeValueSelectionFieldDef<T>>, 'props'> {
  readonly props: DbxForgeValueSelectionFieldProps<T>;
}

/**
 * Generic function type for dbxForgeValueSelectionField to preserve caller generics.
 */
export type DbxForgeValueSelectionFieldFunction = <T = unknown>(config: DbxForgeValueSelectionFieldConfig<T>) => DbxForgeField<DbxForgeValueSelectionFieldDef<T>>;

/**
 * @deprecated Use {@link DbxForgeValueSelectionFieldFunction} instead.
 */
export type ForgeValueSelectionFieldFunction = DbxForgeValueSelectionFieldFunction;

// MARK: Factory
/**
 * Single-select dropdown over a static or async value list. Simpler than `source-select` when metadata lookup is unnecessary.
 *
 * The component uses `<mat-form-field>` with `[formField]` for native ng-forge value binding,
 * proper Material rendering, and built-in logic (hidden/disabled/readonly) support.
 *
 * Supports static arrays, Observable option sources, and `ValueSelectionOptionClear` entries.
 *
 * @param config - Selection field configuration
 * @returns A forge field definition for the value selection component
 *
 * @dbxFormField
 * @dbxFormSlug value-selection
 * @dbxFormTier field-factory
 * @dbxFormProduces T
 * @dbxFormArrayOutput no
 * @dbxFormNgFormType dbx-value-selection
 * @dbxFormWrapperPattern material-form-field-wrapped
 * @dbxFormConfigInterface DbxForgeValueSelectionFieldConfig<T>
 * @dbxFormGeneric <T = unknown>
 *
 * @example
 * ```typescript
 * dbxForgeValueSelectionField<string>({ key: 'status', props: { options: [{ value: 'active', label: 'Active' }] } })
 * ```
 */
export const dbxForgeValueSelectionField = dbxForgeFieldFunction<DbxForgeValueSelectionFieldConfig>({
  type: FORGE_VALUE_SELECTION_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder()
}) as DbxForgeValueSelectionFieldFunction;
