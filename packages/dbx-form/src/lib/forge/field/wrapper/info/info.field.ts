import type { FieldTypeDefinition, BaseValueField } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';

// MARK: Field Type
export const FORGE_INFO_BUTTON_FIELD_TYPE_NAME = 'dbx-forge-info-button' as const;

/**
 * Props interface for the forge info button field.
 */
export interface ForgeInfoButtonFieldProps {
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
export interface ForgeInfoButtonFieldDef extends BaseValueField<ForgeInfoButtonFieldProps, unknown> {
  readonly type: typeof FORGE_INFO_BUTTON_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the info button field.
 */
export const DBX_FORGE_INFO_BUTTON_FIELD_TYPE: FieldTypeDefinition<ForgeInfoButtonFieldDef> = {
  name: FORGE_INFO_BUTTON_FIELD_TYPE_NAME,
  loadComponent: () => import('./info.field.component').then((m) => m.ForgeInfoButtonFieldComponent),
  mapper: valueFieldMapper
};

let _forgeInfoButtonCounter = 0;

// MARK: Config
/**
 * Configuration for creating a forge info button field.
 */
export interface ForgeInfoButtonFieldConfig {
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
 * @returns A {@link ForgeInfoButtonFieldDef}
 */
export function forgeInfoButtonField(config: ForgeInfoButtonFieldConfig): ForgeInfoButtonFieldDef {
  const { onInfoClick, ariaLabel, key } = config;

  return forgeField(
    filterFromPOJO({
      key: key ?? `_info_button_${_forgeInfoButtonCounter++}`,
      type: FORGE_INFO_BUTTON_FIELD_TYPE_NAME,
      label: '',
      value: undefined as unknown,
      props: { onInfoClick, ariaLabel } as ForgeInfoButtonFieldProps
    }) as ForgeInfoButtonFieldDef
  );
}
