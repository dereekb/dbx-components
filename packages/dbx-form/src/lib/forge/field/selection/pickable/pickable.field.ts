import { type PrimativeKey, filterFromPOJO } from '@dereekb/util';
import type { FieldDef, FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { forgeField } from '../../field';
import { forgeFormFieldWrapper, type DbxForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import { FORGE_PICKABLE_CHIP_FIELD_TYPE, FORGE_PICKABLE_LIST_FIELD_TYPE, type DbxForgePickableFieldProps, type DbxForgePickableChipFieldDef, type DbxForgePickableListFieldDef } from './pickable.field.directive';

// MARK: Field Type Definitions
/**
 * ng-forge FieldTypeDefinition for the pickable chip field.
 *
 * Register via `provideDynamicForm(DBX_PICKABLE_CHIP_FIELD_TYPE)`.
 */
export const DBX_PICKABLE_CHIP_FIELD_TYPE: FieldTypeDefinition<DbxForgePickableChipFieldDef> = {
  name: FORGE_PICKABLE_CHIP_FIELD_TYPE,
  loadComponent: () => import('./pickable-chip.field.component').then((m) => m.DbxForgePickableChipFieldComponent),
  mapper: valueFieldMapper
};

/**
 * ng-forge FieldTypeDefinition for the pickable list field.
 *
 * Register via `provideDynamicForm(DBX_PICKABLE_LIST_FIELD_TYPE)`.
 */
export const DBX_PICKABLE_LIST_FIELD_TYPE: FieldTypeDefinition<DbxForgePickableListFieldDef> = {
  name: FORGE_PICKABLE_LIST_FIELD_TYPE,
  loadComponent: () => import('./pickable-list.field.component').then((m) => m.DbxForgePickableListFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Pickable Chip Field
/**
 * Configuration for a forge pickable chip field.
 */
export interface DbxForgePickableChipFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgePickableFieldProps<T, M, H> {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge field definition for a pickable chip field.
 *
 * @param config - Pickable chip field configuration
 * @returns A validated {@link DbxForgePickableChipFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgePickableChipField({
 *   key: 'tags',
 *   label: 'Tags',
 *   loadValues: () => tags$,
 *   displayForValue: (values) => of(values.map(v => ({ ...v, label: v.meta?.label ?? '' }))),
 *   hashForValue: (tag) => tag.id
 * });
 * ```
 */
export function forgePickableChipField<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgePickableChipFieldConfig<T, M, H>): DbxForgeFormFieldWrapperFieldDef<DbxForgePickableChipFieldDef<T, M, H>> {
  const { key, label, required, readonly: isReadonly, description, ...pickableProps } = config;

  const innerField = forgeField(
    filterFromPOJO({
      key,
      type: FORGE_PICKABLE_CHIP_FIELD_TYPE,
      label: '',
      value: undefined as unknown as T | T[],
      required,
      readonly: isReadonly,
      props: filterFromPOJO({
        ...pickableProps
      }) as DbxForgePickableFieldProps<T, M, H>
    }) as DbxForgePickableChipFieldDef<T, M, H>
  );

  return forgeFormFieldWrapper<DbxForgePickableChipFieldDef<T, M, H>>({
    label: label ?? '',
    hint: description,
    fields: [innerField as unknown as FieldDef<unknown>]
  });
}

// MARK: Pickable List Field
/**
 * Configuration for a forge pickable list field.
 */
export interface DbxForgePickableListFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgePickableFieldProps<T, M, H> {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge field definition for a pickable list field.
 *
 * @param config - Pickable list field configuration
 * @returns A validated {@link DbxForgePickableListFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgePickableListField({
 *   key: 'categories',
 *   label: 'Categories',
 *   loadValues: () => categories$,
 *   displayForValue: (values) => of(values.map(v => ({ ...v, label: v.meta?.label ?? '' }))),
 *   hashForValue: (cat) => cat.id
 * });
 * ```
 */
export function forgePickableListField<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgePickableListFieldConfig<T, M, H>): DbxForgeFormFieldWrapperFieldDef<DbxForgePickableListFieldDef<T, M, H>> {
  const { key, label, required, readonly: isReadonly, description, ...pickableProps } = config;

  const innerField = forgeField(
    filterFromPOJO({
      key,
      type: FORGE_PICKABLE_LIST_FIELD_TYPE,
      label: '',
      value: undefined as unknown as T | T[],
      required,
      readonly: isReadonly,
      props: filterFromPOJO({
        ...pickableProps
      }) as DbxForgePickableFieldProps<T, M, H>
    }) as DbxForgePickableListFieldDef<T, M, H>
  );

  return forgeFormFieldWrapper<DbxForgePickableListFieldDef<T, M, H>>({
    label: label ?? '',
    hint: description,
    fields: [innerField as unknown as FieldDef<unknown>]
  });
}
