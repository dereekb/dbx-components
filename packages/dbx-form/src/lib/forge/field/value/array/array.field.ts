import type { ArrayField, ContainerField } from '@ng-forge/dynamic-forms';
import { dbxForgeBuildFieldDef, dbxForgeFieldFunction, type DbxForgeFieldFunctionDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';
import { DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME, type DbxForgeArrayFieldWrapperProps } from '../../wrapper/array-field/array-field.wrapper';
import { DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME, type DbxForgeArrayFieldElementWrapperProps } from '../../wrapper/array-field/array-field.element.wrapper';

// MARK: Config
/**
 * Configuration for creating a forge array field.
 *
 * The outer array wrapper provides label/hint header chrome.
 * Each template item is wrapped in a ContainerField with the element wrapper
 * to provide per-item drag handle, label, and remove button.
 */
export interface DbxForgeArrayFieldConfig extends DbxForgeFieldFunctionDef<Omit<ArrayField, 'props' | 'label' | 'fields'>> {
  /**
   * Template defining the fields for each array item.
   * Each item is wrapped in a ContainerField with the element wrapper
   * for per-item drag handle, label, and remove button.
   *
   * The array starts empty — items are added via the add button.
   */
  readonly template: ContainerField['fields'];
  readonly props?: Omit<DbxForgeArrayFieldWrapperProps, 'itemTemplate'>;
  readonly elementProps?: DbxForgeArrayFieldElementWrapperProps;
}

export type DbxForgeArrayFieldFunction = (config: DbxForgeArrayFieldConfig) => DbxForgeField<ArrayField>;

// MARK: Internal
/**
 * Creates a forge array field with add/remove controls and per-item rendering.
 *
 * Wraps the array with {@link DbxForgeArrayFieldWrapperComponent} for label/hint,
 * and wraps each template item in a ContainerField with
 * {@link DbxForgeArrayFieldElementWrapperComponent} for per-item drag handle,
 * label, and remove button.
 *
 * @param config - Array field configuration
 * @returns A {@link DbxForgeField}
 *
 * @example
 * ```typescript
 * const field = dbxForgeArrayField({
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
export const dbxForgeArrayField = dbxForgeFieldFunction<DbxForgeArrayFieldConfig>({
  type: 'array',
  buildFieldDef: dbxForgeBuildFieldDef((x, config) => {
    const { props, elementProps, template } = config;

    // Flow per-element defaults from outer wrapper props; elementProps overrides
    const resolvedElementProps = {
      removeText: props?.removeText,
      allowRemove: props?.allowRemove,
      disableRearrange: props?.disableRearrange,
      removeButtonStyle: props?.removeButtonStyle,
      ...elementProps
    };

    // Build the container field that wraps each array item with the element wrapper.
    // The key is required by FieldDef but does not affect the value shape for containers.
    const containerFieldItemTemplate: ContainerField = {
      key: `${config.key}-container`,
      type: 'container',
      fields: template ?? [],
      wrappers: [
        {
          type: DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME,
          props: resolvedElementProps
        }
      ]
    };

    // Add the outer array wrapper for label/hint chrome + cdkDropList + state service.
    // Passes the containerField as itemTemplate so the add button can create new items.
    x.addWrappers({
      type: DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME,
      props: {
        ...props,
        itemTemplate: [containerFieldItemTemplate]
      }
    });

    delete (config as any).props; // clear props too
    // delete (config as any).template;    // template should be unset

    console.log({
      config
    });
  })
}) as DbxForgeArrayFieldFunction;
