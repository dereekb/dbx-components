import { type PrimativeKey, filterFromPOJO } from '@dereekb/util';
import type { FieldDef, FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { forgeField } from '../../field';
import { forgeFormFieldWrapper, type DbxForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import { FORGE_SOURCE_SELECT_FIELD_TYPE, type DbxForgeSourceSelectFieldProps, type DbxForgeSourceSelectFieldDef } from './sourceselect.field.component';

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
export interface DbxForgeSourceSelectFieldConfig<T extends PrimativeKey = PrimativeKey, M = unknown> extends DbxForgeSourceSelectFieldProps<T, M> {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge field definition for a source select field.
 *
 * @param config - Source select field configuration
 * @returns A validated {@link DbxForgeSourceSelectFieldDef}
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
export function forgeSourceSelectField<T extends PrimativeKey = PrimativeKey, M = unknown>(config: DbxForgeSourceSelectFieldConfig<T, M>): DbxForgeFormFieldWrapperFieldDef<DbxForgeSourceSelectFieldDef<T, M>> {
  const { key, label, required, readonly: isReadonly, description, ...selectProps } = config;

  const innerField = forgeField(
    filterFromPOJO({
      key,
      type: FORGE_SOURCE_SELECT_FIELD_TYPE,
      label: '',
      value: undefined as unknown as T | T[],
      required,
      readonly: isReadonly,
      props: filterFromPOJO({
        ...selectProps
      }) as DbxForgeSourceSelectFieldProps<T, M>
    }) as DbxForgeSourceSelectFieldDef<T, M>
  );

  return forgeFormFieldWrapper<DbxForgeSourceSelectFieldDef<T, M>>({
    label: label ?? '',
    hint: description,
    fields: [innerField as unknown as FieldDef<unknown>]
  });
}
