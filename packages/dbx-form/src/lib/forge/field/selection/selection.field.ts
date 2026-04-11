import { filterFromPOJO } from '@dereekb/util';
import type { ObservableOrValue } from '@dereekb/rxjs';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { forgeField } from '../field';
import type { DbxForgeFieldConfig } from '../field.type';
import { FORGE_VALUE_SELECTION_FIELD_TYPE, type DbxForgeValueSelectionFieldProps, type DbxForgeValueSelectionFieldDef } from './selection.field.component';
import type { ValueSelectionOption } from '../../../field/field.selection';

// MARK: Re-exports
export { resolveForgeSelectionOptions, type DbxForgeResolvedSelectionOption, type DbxForgeValueSelectionFieldProps, type DbxForgeValueSelectionFieldDef, FORGE_VALUE_SELECTION_FIELD_TYPE } from './selection.field.component';

// MARK: Field Type Definition
/**
 * ng-forge FieldTypeDefinition for the value selection field.
 *
 * Register via `provideDynamicForm(DBX_VALUE_SELECTION_FIELD_TYPE)`.
 */
export const DBX_VALUE_SELECTION_FIELD_TYPE: FieldTypeDefinition<DbxForgeValueSelectionFieldDef> = {
  name: FORGE_VALUE_SELECTION_FIELD_TYPE,
  loadComponent: () => import('./selection.field.component').then((m) => m.DbxForgeValueSelectionFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Config
/**
 * Configuration for a forge select (dropdown) field.
 *
 * Equivalent to formly's `ValueSelectionFieldConfig` — supports static and Observable options,
 * clear options, and multiple selection.
 */
export interface DbxForgeValueSelectionFieldConfig<T = unknown> extends DbxForgeFieldConfig {
  readonly label?: string;
  readonly description?: string;
  /**
   * Options to select from.
   *
   * Accepts a static array or an Observable that emits option arrays.
   * Options may include `ValueSelectionOptionClear` entries with `{ clear: true }`.
   */
  readonly options: ObservableOrValue<ValueSelectionOption<T>[]>;
  /**
   * Allow selecting multiple values and return an array.
   */
  readonly multiple?: boolean;
  /**
   * Default selected value.
   */
  readonly defaultValue?: T;
  /**
   * When true or a string, adds a clear/reset option at the top of the options list.
   * If a string is provided, it is used as the clear option label.
   *
   * @default false
   */
  readonly addClearOption?: boolean | string;
}

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
 * const field = forgeValueSelectionField({
 *   key: 'color',
 *   label: 'Color',
 *   options: [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }]
 * });
 *
 * // Observable options
 * const field = forgeValueSelectionField({
 *   key: 'status',
 *   label: 'Status',
 *   options: status$.pipe(map(statuses => statuses.map(s => ({ label: s.name, value: s.id })))),
 *   addClearOption: 'No Selection'
 * });
 * ```
 */
export function forgeValueSelectionField<T = unknown>(config: DbxForgeValueSelectionFieldConfig<T>): DbxForgeValueSelectionFieldDef<T> {
  const { key, label, required, readonly: isReadonly, description, options, multiple, defaultValue, addClearOption, logic } = config;

  return forgeField({
    key,
    type: FORGE_VALUE_SELECTION_FIELD_TYPE,
    label: label ?? '',
    value: defaultValue as T,
    required,
    readonly: isReadonly,
    logic,
    props: filterFromPOJO({
      options,
      addClearOption,
      multiple,
      hint: description
    }) as DbxForgeValueSelectionFieldProps<T>
  } as DbxForgeValueSelectionFieldDef<T>);
}
