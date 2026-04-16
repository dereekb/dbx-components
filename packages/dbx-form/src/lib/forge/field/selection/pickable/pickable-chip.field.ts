import { type PrimativeKey } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { dbxForgeMaterialFormFieldWrappedFieldFunction, type DbxForgeFormFieldWrapperWrappedFieldDef } from '../../wrapper/formfield/formfield.wrapper';
import { FORGE_PICKABLE_CHIP_FIELD_TYPE, type DbxForgePickableChipFieldDef } from './pickable.field';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';

// MARK: Field Type Definition
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
  buildFieldDef: dbxForgeBuildFieldDef(() => {})
}) as DbxForgePickableChipFieldFunction;
