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
export interface DbxForgeArrayFieldConfig<T = unknown> extends DbxForgeFieldFunctionDef<Omit<ArrayField, 'props' | 'label' | 'fields'>> {
  readonly fields: ContainerField['fields'];
  readonly props?: DbxForgeArrayFieldWrapperProps<T>;
  readonly elementProps?: DbxForgeArrayFieldElementWrapperProps<T>;
}

export type DbxForgeArrayFieldFunction = <T = unknown>(config: DbxForgeArrayFieldConfig<T>) => DbxForgeField<ArrayField>;

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
    const { props, elementProps, fields } = config;

    // Add the outer array wrapper for label/hint chrome
    x.addWrappers({
      type: DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME,
      props
    });

    // Flow per-element defaults from outer wrapper props; elementProps overrides
    const resolvedElementProps = {
      removeText: props?.removeText,
      allowRemove: props?.allowRemove,
      disableRearrange: props?.disableRearrange,
      removeButtonStyle: props?.removeButtonStyle,
      ...elementProps
    };

    // Wrap template fields in a ContainerField with the element wrapper
    (config as any).fields = [
      {
        type: 'container',
        fields,
        wrappers: [
          {
            type: DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME,
            props: resolvedElementProps
          }
        ] as ContainerField['wrappers']
      }
    ] as any; // need any, as there is a back and forth typing issue otherwise
  })
}) as DbxForgeArrayFieldFunction;
