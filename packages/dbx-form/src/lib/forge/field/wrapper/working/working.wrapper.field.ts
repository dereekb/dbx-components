import type { FieldTypeDefinition, BaseValueField, FieldDef } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';

import { forgeField } from '../../field';
import type { DbxForgeWrapperFieldProps } from '../wrapper.field';

// MARK: Field Type
export const FORGE_WORKING_WRAPPER_FIELD_TYPE_NAME = 'dbx-forge-working-wrapper' as const;

/**
 * Props interface for the forge working wrapper field.
 *
 * Extends base wrapper props with no additional configuration needed.
 * The wrapper monitors its own field tree's pending state automatically.
 */
export interface DbxForgeWorkingWrapperFieldProps extends DbxForgeWrapperFieldProps {}

/**
 * Forge field definition for a working wrapper.
 *
 * Renders child fields with a loading indicator that appears when
 * any child field has pending async validation.
 */
export interface DbxForgeWorkingWrapperFieldDef extends BaseValueField<DbxForgeWorkingWrapperFieldProps, Record<string, unknown>> {
  readonly type: typeof FORGE_WORKING_WRAPPER_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the working wrapper field.
 */
export const DBX_FORGE_WORKING_WRAPPER_FIELD_TYPE: FieldTypeDefinition<DbxForgeWorkingWrapperFieldDef> = {
  name: FORGE_WORKING_WRAPPER_FIELD_TYPE_NAME,
  loadComponent: () => import('./working.wrapper.field.component').then((m) => m.DbxForgeWorkingWrapperFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Config
/**
 * Configuration for creating a forge working wrapper field.
 */
export interface DbxForgeWorkingWrapperFieldConfig {
  /**
   * Child field definitions to render inside the working wrapper.
   */
  readonly fields: FieldDef<unknown>[];
  /**
   * Optional key override. Defaults to auto-generated `_working_wrapper_N`.
   */
  readonly key?: string;
}

let _forgeWorkingWrapperCounter = 0;

/**
 * Creates a forge working wrapper field that renders child fields with a
 * loading indicator that appears during async validation.
 *
 * Unlike {@link forgeWorkingWrapper} which places a sibling working indicator
 * field alongside the target field, this wraps child fields inside an actual
 * wrapper component that monitors the field tree's pending state.
 *
 * Uses `_` key prefix so `stripForgeInternalKeys` flattens child values into
 * the parent form value.
 *
 * @param config - Working wrapper configuration
 * @returns A {@link DbxForgeWorkingWrapperFieldDef}
 *
 * @example
 * ```typescript
 * const working = forgeWorkingFieldWrapper({
 *   fields: [
 *     forgeTextField({ key: 'username', label: 'Username' })
 *   ]
 * });
 * ```
 */
export function forgeWorkingFieldWrapper(config: DbxForgeWorkingWrapperFieldConfig): DbxForgeWorkingWrapperFieldDef {
  const { fields, key } = config;

  return forgeField({
    key: key ?? `_working_wrapper_${_forgeWorkingWrapperCounter++}`,
    type: FORGE_WORKING_WRAPPER_FIELD_TYPE_NAME,
    label: '',
    value: {} as Record<string, unknown>,
    props: {
      fields
    } as DbxForgeWorkingWrapperFieldProps
  } as DbxForgeWorkingWrapperFieldDef);
}
