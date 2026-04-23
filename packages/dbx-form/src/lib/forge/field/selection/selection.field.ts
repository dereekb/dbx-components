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
 * Creates a forge field definition for a Material select (dropdown) field.
 *
 * The component uses `<mat-form-field>` with `[formField]` for native ng-forge value binding,
 * proper Material rendering, and built-in logic (hidden/disabled/readonly) support.
 *
 * Supports static arrays, Observable option sources, and `ValueSelectionOptionClear` entries.
 *
 * @param config - Selection field configuration
 * @returns A forge field definition for the value selection component
 *
 * @example
 * ```typescript
 * // Static options
 * const field = dbxForgeValueSelectionField({
 *   key: 'color',
 *   label: 'Color',
 *   props: {
 *     options: [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }]
 *   }
 * });
 *
 * // Observable options
 * const field = dbxForgeValueSelectionField({
 *   key: 'status',
 *   label: 'Status',
 *   props: {
 *     options: status$.pipe(map(statuses => statuses.map(s => ({ label: s.name, value: s.id })))),
 *     addClearOption: 'No Selection'
 *   }
 * });
 * ```
 */
export const dbxForgeValueSelectionField = dbxForgeFieldFunction<DbxForgeValueSelectionFieldConfig>({
  type: FORGE_VALUE_SELECTION_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder()
}) as DbxForgeValueSelectionFieldFunction;
