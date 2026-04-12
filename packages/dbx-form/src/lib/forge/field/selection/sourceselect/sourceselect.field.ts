import { type PrimativeKey, filterFromPOJO } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { forgeField } from '../../field.util.meta';
import { FORGE_SOURCE_SELECT_FIELD_TYPE, type DbxForgeSourceSelectFieldProps, type DbxForgeSourceSelectFieldDef } from './sourceselect.field.component';
import type { DbxForgeFieldConfig } from '../../field.type';

// MARK: Field Type Definition
/**
 * ng-forge FieldTypeDefinition for the source select field.
 *
 * Register via `provideDynamicForm(DBX_SOURCE_SELECT_FIELD_TYPE)`.
 */
export const DBX_SOURCE_SELECT_FIELD_TYPE: FieldTypeDefinition<DbxForgeSourceSelectFieldDef> = {
  name: FORGE_SOURCE_SELECT_FIELD_TYPE,
  loadComponent: () => import('./sourceselect.field.component').then((m) => m.DbxForgeSourceSelectFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Source Select Field
/**
 * Configuration for a forge source select field.
 */
export interface DbxForgeSourceSelectFieldConfig<T extends PrimativeKey = PrimativeKey, M = unknown> extends DbxForgeFieldConfig, DbxForgeSourceSelectFieldProps<T, M> {
  readonly label?: string;
  readonly description?: string;
}

/**
 * Creates a forge field definition for a source select field.
 *
 * The component uses `<mat-form-field>` with `[formField]` for native ng-forge value binding,
 * proper Material rendering, and built-in logic (hidden/disabled/readonly) support.
 *
 * @param config - Source select field configuration
 * @returns A {@link DbxForgeSourceSelectFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeSourceSelectField({
 *   key: 'source',
 *   label: 'Source',
 *   valueReader: (meta) => meta.id,
 *   metaLoader: (values) => myService.loadMeta(values),
 *   displayForValue: (values) => of(values.map(v => ({ ...v, label: v.meta.name })))
 * });
 * ```
 */
export function forgeSourceSelectField<T extends PrimativeKey = PrimativeKey, M = unknown>(config: DbxForgeSourceSelectFieldConfig<T, M>): DbxForgeSourceSelectFieldDef<T, M> {
  const { key, label, required, readonly: isReadonly, description, logic, ...selectProps } = config;

  return forgeField({
    key,
    type: FORGE_SOURCE_SELECT_FIELD_TYPE,
    label: label ?? '',
    value: undefined as unknown as T | T[],
    required,
    readonly: isReadonly,
    logic,
    props: filterFromPOJO({
      ...selectProps,
      hint: description
    }) as DbxForgeSourceSelectFieldProps<T, M>
  } as DbxForgeSourceSelectFieldDef<T, M>);
}
