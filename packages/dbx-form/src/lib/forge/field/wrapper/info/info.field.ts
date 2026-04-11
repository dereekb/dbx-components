import type { FieldTypeDefinition, BaseValueField } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';

import { forgeField } from '../../field';

// MARK: Field Type
export const FORGE_INFO_BUTTON_FIELD_TYPE_NAME = 'dbx-forge-info-button' as const;

/**
 * Props interface for the forge info button field.
 */
export interface DbxForgeInfoButtonFieldProps {
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
 * Forge field definition for an info button.
 */
export interface DbxForgeInfoButtonFieldDef extends BaseValueField<DbxForgeInfoButtonFieldProps, unknown> {
  readonly type: typeof FORGE_INFO_BUTTON_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the info button field.
 */
export const DBX_FORGE_INFO_BUTTON_FIELD_TYPE: FieldTypeDefinition<DbxForgeInfoButtonFieldDef> = {
  name: FORGE_INFO_BUTTON_FIELD_TYPE_NAME,
  loadComponent: () => import('./info.field.component').then((m) => m.DbxForgeInfoButtonFieldComponent),
  mapper: valueFieldMapper
};

let _forgeInfoButtonCounter = 0;

// MARK: Config
/**
 * Configuration for creating a forge info button field.
 */
export interface DbxForgeInfoButtonFieldConfig {
  /**
   * Callback invoked when the info button is clicked.
   */
  readonly onInfoClick: () => void;
  /**
   * Accessible label for the button. Defaults to 'More information'.
   */
  readonly ariaLabel?: string;
  /**
   * Optional key. Defaults to auto-generated.
   */
  readonly key?: string;
}

/**
 * Creates a forge info button field that renders a Material info icon button.
 *
 * @param config - Info button configuration
 * @returns A {@link DbxForgeInfoButtonFieldDef}
 */
export function forgeInfoButtonField(config: DbxForgeInfoButtonFieldConfig): DbxForgeInfoButtonFieldDef {
  const { onInfoClick, ariaLabel, key } = config;

  return forgeField({
    key: key ?? `_info_button_${_forgeInfoButtonCounter++}`,
    type: FORGE_INFO_BUTTON_FIELD_TYPE_NAME,
    label: '',
    value: undefined as unknown,
    props: { onInfoClick, ariaLabel } as DbxForgeInfoButtonFieldProps
  } as DbxForgeInfoButtonFieldDef);
}
