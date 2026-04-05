import { type PrimativeKey, filterFromPOJO } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { forgeField } from '../../field';
import { type ForgePickableFieldProps, type ForgePickableChipFieldDef, type ForgePickableListFieldDef } from './pickable.field.component';

// MARK: Field Type Definitions
/**
 * ng-forge FieldTypeDefinition for the pickable chip field.
 *
 * Register via `provideDynamicForm(DBX_PICKABLE_CHIP_FIELD_TYPE)`.
 */
export const DBX_PICKABLE_CHIP_FIELD_TYPE: FieldTypeDefinition<ForgePickableChipFieldDef> = {
  name: 'dbx-pickable-chip',
  loadComponent: () => import('./pickable.field.component').then((m) => m.DbxForgePickableChipFieldComponent),
  mapper: valueFieldMapper
};

/**
 * ng-forge FieldTypeDefinition for the pickable list field.
 *
 * Register via `provideDynamicForm(DBX_PICKABLE_LIST_FIELD_TYPE)`.
 */
export const DBX_PICKABLE_LIST_FIELD_TYPE: FieldTypeDefinition<ForgePickableListFieldDef> = {
  name: 'dbx-pickable-list',
  loadComponent: () => import('./pickable.field.component').then((m) => m.DbxForgePickableListFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Pickable Chip Field
/**
 * Configuration for a forge pickable chip field.
 */
export interface ForgePickableChipFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends ForgePickableFieldProps<T, M, H> {
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
 * @returns A validated {@link ForgePickableChipFieldDef}
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
export function forgePickableChipField<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: ForgePickableChipFieldConfig<T, M, H>): ForgePickableChipFieldDef<T, M, H> {
  const { key, label, required, readonly: isReadonly, description, ...pickableProps } = config;

  return forgeField(
    filterFromPOJO({
      key,
      type: 'dbx-pickable-chip' as const,
      label: label ?? '',
      value: undefined as unknown as T | T[],
      required,
      readonly: isReadonly,
      props: filterFromPOJO({
        ...pickableProps,
        hint: description
      }) as ForgePickableFieldProps<T, M, H>
    }) as ForgePickableChipFieldDef<T, M, H>
  );
}

// MARK: Pickable List Field
/**
 * Configuration for a forge pickable list field.
 */
export interface ForgePickableListFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends ForgePickableFieldProps<T, M, H> {
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
 * @returns A validated {@link ForgePickableListFieldDef}
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
export function forgePickableListField<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: ForgePickableListFieldConfig<T, M, H>): ForgePickableListFieldDef<T, M, H> {
  const { key, label, required, readonly: isReadonly, description, ...pickableProps } = config;

  return forgeField(
    filterFromPOJO({
      key,
      type: 'dbx-pickable-list' as const,
      label: label ?? '',
      value: undefined as unknown as T | T[],
      required,
      readonly: isReadonly,
      props: filterFromPOJO({
        ...pickableProps,
        hint: description
      }) as ForgePickableFieldProps<T, M, H>
    }) as ForgePickableListFieldDef<T, M, H>
  );
}
