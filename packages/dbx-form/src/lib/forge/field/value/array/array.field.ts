import type { FieldTypeDefinition, BaseValueField, ArrayAllowedChildren, FieldDef } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { filterFromPOJO, type FactoryWithRequiredInput } from '@dereekb/util';
import { type DbxButtonStyle } from '@dereekb/dbx-web';
import { forgeField } from '../../field';

// MARK: Types
/**
 * Any field type accepted as a drag array template item.
 * Includes both ng-forge built-in fields and custom FieldDef types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ForgeArrayTemplateField = ArrayAllowedChildren | FieldDef<any>;

// MARK: Field Type
export const FORGE_ARRAY_FIELD_TYPE_NAME = 'dbx-forge-array' as const;

/**
 * Pair representing an array item with its index and optional value.
 */
export interface ForgeArrayItemPair<T = unknown> {
  readonly index: number;
  readonly value?: T;
}

/**
 * Props interface for the forge drag array field.
 */
export interface ForgeArrayFieldProps<T = unknown> {
  /**
   * Template defining the structure of a single array item.
   */
  readonly template: ForgeArrayTemplateField | readonly ForgeArrayTemplateField[];
  /**
   * Label for each array item. Can be a static string or a function.
   */
  readonly labelForField?: string | FactoryWithRequiredInput<string, ForgeArrayItemPair<T>>;
  /**
   * Text for the add button. Defaults to 'Add'.
   */
  readonly addText?: string;
  /**
   * Text for the remove button. Defaults to 'Remove'.
   */
  readonly removeText?: string;
  /**
   * Text for the duplicate button.
   */
  readonly duplicateText?: string;
  /**
   * Whether the add button is shown. Defaults to true.
   */
  readonly allowAdd?: boolean;
  /**
   * Whether items can be removed. Defaults to true.
   */
  readonly allowRemove?: boolean;
  /**
   * Whether items can be duplicated. Defaults to false.
   */
  readonly allowDuplicate?: boolean;
  /**
   * Whether drag/drop reordering is disabled. Defaults to false.
   */
  readonly disableRearrange?: boolean;
  /**
   * Whether duplicated items go to the end. Defaults to false.
   */
  readonly addDuplicateToEnd?: boolean;
  /**
   * Maximum number of items. No limit when undefined.
   */
  readonly maxLength?: number;
  /**
   * Minimum number of items. No minimum when undefined.
   */
  readonly minLength?: number;
  /**
   * Style configuration for the add button. Defaults to raised primary.
   */
  readonly addButtonStyle?: DbxButtonStyle;
  /**
   * Style configuration for the remove button. Defaults to stroked warn.
   */
  readonly removeButtonStyle?: DbxButtonStyle;
  /**
   * Style configuration for the duplicate button. Defaults to stroked primary.
   */
  readonly duplicateButtonStyle?: DbxButtonStyle;
}

/**
 * Forge field definition for a drag-and-drop array.
 */
export interface ForgeArrayFieldDef<T = unknown> extends BaseValueField<ForgeArrayFieldProps<T>, unknown[]> {
  readonly type: typeof FORGE_ARRAY_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the drag array field.
 */
export const DBX_FORGE_ARRAY_FIELD_TYPE: FieldTypeDefinition<ForgeArrayFieldDef> = {
  name: FORGE_ARRAY_FIELD_TYPE_NAME,
  loadComponent: () => import('./array.field.component').then((m) => m.ForgeArrayFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Config
/**
 * Configuration for creating a forge drag array field.
 */
export interface ForgeArrayFieldConfig<T = unknown> {
  /**
   * Key for the array field.
   */
  readonly key: string;
  /**
   * Optional label for the array section.
   */
  readonly label?: string;
  /**
   * Optional description text.
   */
  readonly description?: string;
  /**
   * Template defining the structure of a single array item.
   *
   * - Single field for primitive array items
   * - Array of fields for object array items
   */
  readonly template: ForgeArrayTemplateField | readonly ForgeArrayTemplateField[];
  /**
   * Initial array values.
   */
  readonly value?: readonly unknown[];
  /**
   * Label for each item. Static string or function receiving index/value.
   */
  readonly labelForField?: string | FactoryWithRequiredInput<string, ForgeArrayItemPair<T>>;
  /**
   * Add button text. Defaults to 'Add'.
   */
  readonly addText?: string;
  /**
   * Remove button text. Defaults to 'Remove'.
   */
  readonly removeText?: string;
  /**
   * Duplicate button text.
   */
  readonly duplicateText?: string;
  /**
   * Whether the add button is shown. Defaults to true.
   */
  readonly allowAdd?: boolean;
  /**
   * Whether items can be removed. Defaults to true.
   */
  readonly allowRemove?: boolean;
  /**
   * Whether items can be duplicated. Defaults to false.
   */
  readonly allowDuplicate?: boolean;
  /**
   * Whether drag/drop reordering is disabled. Defaults to false.
   */
  readonly disableRearrange?: boolean;
  /**
   * Whether duplicated items go to the end. Defaults to false.
   */
  readonly addDuplicateToEnd?: boolean;
  /**
   * Maximum number of items.
   */
  readonly maxLength?: number;
  /**
   * Minimum number of items.
   */
  readonly minLength?: number;
  /**
   * Style configuration for the add button. Defaults to raised primary.
   */
  readonly addButtonStyle?: DbxButtonStyle;
  /**
   * Style configuration for the remove button. Defaults to stroked warn.
   */
  readonly removeButtonStyle?: DbxButtonStyle;
  /**
   * Style configuration for the duplicate button. Defaults to stroked primary.
   */
  readonly duplicateButtonStyle?: DbxButtonStyle;
}

/**
 * Creates a forge drag-and-drop array field with CDK drag/drop reordering,
 * add/remove/duplicate controls, and per-item labeling.
 *
 * Each array item renders as a nested mini dynamic form using the provided template.
 * Items can be reordered via drag/drop handles, added, removed, and duplicated.
 *
 * This is the forge equivalent of the formly `formlyRepeatArrayField` with
 * `DbxFormRepeatArrayTypeComponent`.
 *
 * @param config - Drag array field configuration
 * @returns A {@link ForgeArrayFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgeArrayField({
 *   key: 'phones',
 *   label: 'Phone Numbers',
 *   addText: 'Add Phone',
 *   template: [
 *     forgeTextField({ key: 'number', label: 'Number' }),
 *     forgeTextField({ key: 'label', label: 'Label' })
 *   ]
 * });
 * ```
 */
export function forgeArrayField<T = unknown>(config: ForgeArrayFieldConfig<T>): ForgeArrayFieldDef<T> {
  const { key, label, description, template, value, labelForField, addText, removeText, duplicateText, allowAdd, allowRemove, allowDuplicate, disableRearrange, addDuplicateToEnd, maxLength, minLength, addButtonStyle, removeButtonStyle, duplicateButtonStyle } = config;

  return forgeField(
    filterFromPOJO({
      key,
      type: FORGE_ARRAY_FIELD_TYPE_NAME,
      label: label ?? '',
      ...(description != null && { description }),
      value: value ?? ([] as unknown[]),
      props: filterFromPOJO({
        template,
        labelForField,
        addText,
        removeText,
        duplicateText,
        allowAdd,
        allowRemove,
        allowDuplicate,
        disableRearrange,
        addDuplicateToEnd,
        maxLength,
        minLength,
        addButtonStyle,
        removeButtonStyle,
        duplicateButtonStyle
      }) as ForgeArrayFieldProps<T>
    }) as ForgeArrayFieldDef<T>
  );
}
