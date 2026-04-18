import type { BaseValueField } from '@ng-forge/dynamic-forms';

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
