import { type DynamicText } from '@ng-forge/dynamic-forms';
import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type DbxButtonStyle } from '@dereekb/dbx-web';

/**
 * Index pair passed to the labelForField factory.
 */
export interface DbxForgeArrayItemPair {
  readonly index: number;
}

/**
 * Props for the dbx-forge-array-field-element wrapper.
 *
 * Controls per-item rendering: drag handle, item label, and remove button
 * for each array entry.
 */
export interface DbxForgeArrayFieldElementWrapperProps<T = unknown> {
  /**
   * Label for each array item. Can be a static string or a function.
   */
  readonly labelForEntry?: DynamicText | FactoryWithRequiredInput<DynamicText, T>;
  /**
   * Text for the remove button. Defaults to 'Remove'.
   */
  readonly removeText?: DynamicText;
  /**
   * Whether items can be removed. Defaults to true.
   */
  readonly allowRemove?: boolean;
  /**
   * Whether drag/drop reordering is disabled. Defaults to false.
   */
  readonly disableRearrange?: boolean;
  /**
   * Style configuration for the remove button. Defaults to stroked warn.
   */
  readonly removeButtonStyle?: DbxButtonStyle;
}

export const DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME = 'dbx-forge-array-field-element-wrapper' as const;

export interface DbxForgeArrayFieldElementWrapperDef<T = unknown> {
  readonly type: typeof DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME;
  readonly props?: DbxForgeArrayFieldElementWrapperProps<T>;
}
