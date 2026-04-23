import { type DynamicText, type EvaluationContext } from '@ng-forge/dynamic-forms';
import { type IndexNumber } from '@dereekb/util';
import { type DbxChipDisplay, type DbxButtonDisplayStylePair, type DbxButtonStyle } from '@dereekb/dbx-web';

/**
 * Predicate/factory that receives an {@link EvaluationContext} for the current array item.
 *
 * - `fieldValue` / `formValue` are scoped to the item.
 * - `arrayIndex` / `arrayPath` identify the item within its array.
 */
export type DbxForgeArrayItemEvaluationFn<TResult, TItem = unknown> = (ctx: EvaluationContext<TItem>) => TResult;

/**
 * Props for the dbx-forge-array-field-element wrapper.
 *
 * Controls per-item rendering: drag handle, item label, and remove button
 * for each array entry.
 */
export interface DbxForgeArrayFieldElementWrapperProps<T = unknown> {
  /**
   * Label for each array item. Can be a static value or a function that receives
   * an {@link EvaluationContext} scoped to the current item.
   */
  readonly labelForEntry?: DynamicText | DbxForgeArrayItemEvaluationFn<DynamicText, T>;
  /**
   * Whether to show the index chip. Defaults to true.
   */
  readonly showIndexChip?: boolean;
  /**
   * Customizes the display of the index chip.
   *
   * By default, is small with a grey color.
   */
  readonly indexChipDisplay?: DbxForgeArrayItemEvaluationFn<DbxChipDisplay, T>;
  /**
   * Text for the remove button. Defaults to 'Remove'.
   */
  readonly removeText?: DynamicText;
  /**
   * Whether items can be removed. Can be a boolean or a function that receives an
   * {@link EvaluationContext} scoped to the current item. Defaults to `true`.
   */
  readonly allowRemove?: boolean | DbxForgeArrayItemEvaluationFn<boolean, T>;
  /**
   * Controls whether items can be duplicated. Defaults to `false`.
   *
   * - `true` — show the duplicate button; the duplicate is inserted immediately after the source item.
   * - `false` — no duplicate button.
   * - Function returning `boolean` — evaluated per-item; `true` shows the button with default placement.
   * - Function returning {@link IndexNumber} — shows the button; the returned index is
   *   the position at which the duplicate will be inserted.
   */
  readonly allowDuplicate?: boolean | DbxForgeArrayItemEvaluationFn<boolean | IndexNumber, T>;
  /**
   * Display and style for the duplicate button.
   *
   * Defaults to stroked primary with the text 'Duplicate'.
   */
  readonly duplicateButton?: DbxButtonDisplayStylePair | DbxForgeArrayItemEvaluationFn<DbxButtonDisplayStylePair, T>;
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
