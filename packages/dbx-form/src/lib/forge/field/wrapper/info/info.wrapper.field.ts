import type { FieldTypeDefinition, BaseValueField, FieldDef } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';
import type { DbxForgeWrapperFieldProps } from '../wrapper.field';

// MARK: Field Type
export const FORGE_INFO_WRAPPER_FIELD_TYPE_NAME = 'dbx-forge-info' as const;

/**
 * Props interface for the forge info wrapper field.
 */
export interface DbxForgeInfoWrapperFieldProps extends DbxForgeWrapperFieldProps {
  /**
   * Callback invoked when the info button is clicked.
   */
  readonly onInfoClick: () => void;
  /**
   * Accessible label for the info button.
   */
  readonly ariaLabel?: string;
}

/**
 * Forge field definition for an info wrapper.
 *
 * Renders child fields inside a flex layout with an info icon button
 * positioned beside the content.
 */
export interface DbxForgeInfoWrapperFieldDef extends BaseValueField<DbxForgeInfoWrapperFieldProps, Record<string, unknown>> {
  readonly type: typeof FORGE_INFO_WRAPPER_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the info wrapper field.
 */
export const DBX_FORGE_INFO_WRAPPER_FIELD_TYPE: FieldTypeDefinition<DbxForgeInfoWrapperFieldDef> = {
  name: FORGE_INFO_WRAPPER_FIELD_TYPE_NAME,
  loadComponent: () => import('./info.wrapper.field.component').then((m) => m.DbxForgeInfoWrapperFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Config
/**
 * Configuration for creating a forge info wrapper field.
 */
export interface DbxForgeInfoWrapperFieldConfig {
  /**
   * Child field definitions to render inside the info wrapper.
   */
  readonly fields: FieldDef<unknown>[];
  /**
   * Callback invoked when the info button is clicked.
   */
  readonly onInfoClick: () => void;
  /**
   * Accessible label for the info button. Defaults to 'More information'.
   */
  readonly ariaLabel?: string;
  /**
   * Optional key override. Defaults to auto-generated `_info_wrapper_N`.
   */
  readonly key?: string;
}

let _forgeInfoWrapperCounter = 0;

/**
 * Creates a forge info wrapper field that renders child fields with an
 * info icon button beside them.
 *
 * Unlike {@link forgeInfoWrapper} which wraps a single field in a row,
 * this wraps child fields inside an actual wrapper component with proper
 * value synchronization. Supports wrapping groups of fields.
 *
 * Uses `_` key prefix so `stripForgeInternalKeys` flattens child values into
 * the parent form value.
 *
 * @param config - Info wrapper configuration
 * @returns A {@link DbxForgeInfoWrapperFieldDef}
 *
 * @example
 * ```typescript
 * const infoField = forgeInfoFieldWrapper({
 *   onInfoClick: () => openHelpDialog(),
 *   fields: [
 *     forgeTextField({ key: 'name', label: 'Name' }),
 *     forgeTextField({ key: 'email', label: 'Email' })
 *   ]
 * });
 * ```
 */
export function forgeInfoFieldWrapper(config: DbxForgeInfoWrapperFieldConfig): DbxForgeInfoWrapperFieldDef {
  const { fields, onInfoClick, ariaLabel, key } = config;

  return forgeField(
    filterFromPOJO({
      key: key ?? `_info_wrapper_${_forgeInfoWrapperCounter++}`,
      type: FORGE_INFO_WRAPPER_FIELD_TYPE_NAME,
      label: '',
      value: {} as Record<string, unknown>,
      props: filterFromPOJO({
        fields,
        onInfoClick,
        ariaLabel
      }) as DbxForgeInfoWrapperFieldProps
    }) as DbxForgeInfoWrapperFieldDef
  );
}
