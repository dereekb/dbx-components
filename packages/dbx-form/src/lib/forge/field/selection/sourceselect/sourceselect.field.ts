import { type PrimativeKey } from '@dereekb/util';
import type { FieldTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { FORGE_SOURCE_SELECT_FIELD_TYPE, type DbxForgeSourceSelectFieldDef } from './sourceselect.field.component';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';

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
export interface DbxForgeSourceSelectFieldConfig<T extends PrimativeKey = PrimativeKey, M = unknown> extends DbxForgeFieldFunctionDef<DbxForgeSourceSelectFieldDef<T, M>> {}

export type DbxForgeSourceSelectFieldFunction = <T extends PrimativeKey = PrimativeKey, M = unknown>(config: DbxForgeSourceSelectFieldConfig<T, M>) => DbxForgeSourceSelectFieldDef<T, M>;

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
export const forgeSourceSelectField = dbxForgeFieldFunction<DbxForgeSourceSelectFieldConfig>({
  type: FORGE_SOURCE_SELECT_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef(() => {
    // TODO: ...
  })
}) as DbxForgeSourceSelectFieldFunction;
