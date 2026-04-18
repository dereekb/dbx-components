import type { ArrayField, DynamicText, FieldDef } from '@ng-forge/dynamic-forms';
import { dbxForgeBuildFieldDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';
import { DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME, DbxForgeArrayFieldWrapperProps } from '../../wrapper/array-field/array-field.wrapper';
import { DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME, DbxForgeArrayFieldElementWrapperProps } from '../../wrapper/array-field/array-field.element.wrapper';

// MARK: Config
/**
 * Configuration for creating a forge drag array field.
 */
export interface DbxForgeArrayFieldConfig<T = unknown> extends DbxForgeFieldFunctionDef<Omit<ArrayField, 'props' | 'label' | 'fields'>>, Partial<DbxForgeArrayFieldWrapperProps<T>> {
  /**
   * Label for the array field section.
   *
   * Re-declared because ArrayField sets `label?: never` which prevents string values
   * through the DbxForgeFieldFunctionDef conditional type.
   */
  readonly label?: DynamicText;
  /**
   * Hint text displayed alongside the array field label.
   *
   * Re-declared because ArrayField extends FieldDef<never> which causes the
   * conditional hint type in DbxForgeFieldFunctionDef to resolve to `never`.
   */
  readonly hint?: string;
  /**
   * Description text, converted to hint at build time.
   */
  readonly description?: string;
  /**
   * Template field definitions for each array item.
   */
  readonly template?: FieldDef<unknown>[];
  readonly props?: DbxForgeArrayFieldWrapperProps<T>;
  readonly elementProps?: DbxForgeArrayFieldElementWrapperProps<T>;
}

export type DbxForgeArrayFieldFunction = <T = unknown>(config: DbxForgeArrayFieldConfig<T>) => DbxForgeField<ArrayField>;

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
 * @returns A {@link DbxForgeArrayFieldDef}
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
export const dbxForgeArrayField = dbxForgeFieldFunction<DbxForgeArrayFieldConfig>({
  type: 'array',
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x, config) => {
    x.addWrappers([
      {
        type: DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME,
        props: config.props
      },
      {
        type: DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME,
        props: config.elementProps
      }
    ]);
  })
}) as DbxForgeArrayFieldFunction;
