import { type DynamicText } from '@ng-forge/dynamic-forms';
import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type DbxButtonStyle } from '@dereekb/dbx-web';
import { DbxForgeFieldHintValueRef } from '../../field';

export const DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME = 'dbx-forge-array-field-wrapper' as const;

export interface DbxForgeArrayFieldWrapperProps<T = unknown> extends DbxForgeFieldHintValueRef<DynamicText> {
  /**
   * The label for the array field itself.
   */
  readonly label?: DynamicText;
  /**
   * Text for the add button. Defaults to 'Add'.
   */
  readonly addText?: DynamicText;
  /**
   * Text for the remove button. Defaults to 'Remove'.
   */
  readonly removeText?: DynamicText;
  /**
   * Whether the add button is shown. Defaults to true.
   */
  readonly allowAdd?: boolean;
  /**
   * Whether items can be removed. Defaults to true.
   */
  readonly allowRemove?: boolean;
  /**
   * Whether drag/drop reordering is disabled. Defaults to false.
   */
  readonly disableRearrange?: boolean;
  /**
   * Style configuration for the add button. Defaults to raised primary.
   */
  readonly addButtonStyle?: DbxButtonStyle;
  /**
   * Style configuration for the remove button. Defaults to stroked warn.
   */
  readonly removeButtonStyle?: DbxButtonStyle;
}

export interface DbxForgeArrayFieldWrapperDef {
  readonly type: typeof DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME;
  readonly props?: DbxForgeArrayFieldWrapperProps;
}
