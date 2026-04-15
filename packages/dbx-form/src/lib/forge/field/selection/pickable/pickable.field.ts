import { type PrimativeKey } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { dbxForgeMaterialFormFieldWrappedFieldFunction, type DbxForgeFormFieldWrapperWrappedFieldDef } from '../../wrapper/formfield/formfield.wrapper';
import { FORGE_PICKABLE_CHIP_FIELD_TYPE, FORGE_PICKABLE_LIST_FIELD_TYPE, type DbxForgePickableChipFieldDef, type DbxForgePickableListFieldDef } from './pickable.field.directive';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';

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
export interface DbxForgePickableChipFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgePickableChipFieldDef<T, M, H>> {}

export type DbxForgePickableChipFieldFunction = <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgePickableChipFieldConfig<T, M, H>) => DbxForgeFormFieldWrapperWrappedFieldDef<DbxForgePickableChipFieldDef<T, M, H>>;

/**
 * Creates a forge field definition for a pickable chip field.
 *
 * @param config - Pickable chip field configuration
 * @returns A {@link DbxForgeFormFieldWrapperWrappedFieldDef} wrapping a pickable chip field
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
export const forgePickableChipField = dbxForgeMaterialFormFieldWrappedFieldFunction<DbxForgePickableChipFieldConfig>({
  type: FORGE_PICKABLE_CHIP_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef(() => {
    // TODO: Ensure proper merging
    /*

  const innerField = forgeField({
    key,
    type: FORGE_PICKABLE_CHIP_FIELD_TYPE,
    label: '',
    value: undefined as unknown as T | T[],
    required,
    readonly: isReadonly,
  } as DbxForgePickableChipFieldDef<T, M, H>);

  // SAFE TO REMOVE
  /**
   * - dbxForgeFieldFunctionConfigPropsWithHintBuilder handles this
   *
    props: filterFromPOJO({
      ...pickableProps
    }) as DbxForgePickableFieldProps<T, M, H>
   */
  })
}) as DbxForgePickableChipFieldFunction;

// MARK: Pickable List Field
/**
 * Configuration for a forge pickable list field.
 */
export interface DbxForgePickableListFieldConfig<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends DbxForgeFieldFunctionDef<DbxForgePickableListFieldDef<T, M, H>> {}

export type DbxForgePickableListFieldFunction = <T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey>(config: DbxForgePickableListFieldConfig<T, M, H>) => DbxForgeFormFieldWrapperWrappedFieldDef<DbxForgePickableListFieldDef<T, M, H>>;

/**
 * Creates a forge field definition for a pickable list field.
 *
 * @param config - Pickable list field configuration
 * @returns A {@link DbxForgeFormFieldWrapperWrappedFieldDef} wrapping a pickable list field
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
export const forgePickableListField = dbxForgeMaterialFormFieldWrappedFieldFunction<DbxForgePickableListFieldConfig>({
  type: FORGE_PICKABLE_LIST_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef(() => {
    // TODO: Ensure proper merging
    /*

  const innerField = forgeField({
    key,
    type: FORGE_PICKABLE_LIST_FIELD_TYPE,
    label: '',
    value: undefined as unknown as T | T[],
    required,
    readonly: isReadonly,
  } as DbxForgePickableListFieldDef<T, M, H>);

  // SAFE TO REMOVE
  /**
   * - dbxForgeFieldFunctionConfigPropsWithHintBuilder handles this
   *
    props: filterFromPOJO({
      ...pickableProps
    }) as DbxForgePickableFieldProps<T, M, H>
   */
  })
}) as DbxForgePickableListFieldFunction;
