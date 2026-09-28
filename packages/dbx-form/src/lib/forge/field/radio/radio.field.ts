import type { MatRadioField } from '@ng-forge/dynamic-forms-material';
import { type Maybe } from '@dereekb/util';
import { dbxForgeFieldFunction, dbxForgeBuildFieldDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef } from '../field';
import type { DbxForgeField } from '../../form/forge.form';
import { configureDbxForgeFormFieldWrapper } from '../wrapper/formfield/formfield.wrapper';

/**
 * How the radio buttons of a {@link dbxForgeRadioField} are laid out.
 *
 * - `'horizontal'`: side by side, wrapping as needed (ng-forge's native layout)
 * - `'vertical'`: stacked in a single column
 */
export type DbxForgeRadioFieldLayout = 'horizontal' | 'vertical';

/**
 * CSS class added to a {@link dbxForgeRadioField} configured with the `'vertical'` layout.
 */
export const DBX_FORGE_RADIO_FIELD_VERTICAL_CLASS = 'dbx-forge-radio-field-vertical';

/**
 * Configuration for a forge radio group field.
 */
export interface DbxForgeRadioFieldConfig<T = unknown> extends DbxForgeFieldFunctionDef<MatRadioField<T>> {
  /**
   * How the radio buttons are laid out. Defaults to `'horizontal'`.
   */
  readonly layout?: Maybe<DbxForgeRadioFieldLayout>;
}

/**
 * Generic function type for dbxForgeRadioField to preserve caller generics.
 */
export type DbxForgeRadioFieldFunction = <T = unknown>(config: DbxForgeRadioFieldConfig<T>) => DbxForgeField<MatRadioField<T>>;

/**
 * Radio button group for picking exactly one value, wrapped in a form-field container. Use for small static option sets where every option should be visible at once.
 *
 * The wrapper provides the Material outlined form-field appearance (notched outline with floating label, hint/error subscript), matching the checkbox, toggle, and slider fields.
 *
 * Options are passed at the top level of the config, not inside `props`. A `null` option value can represent an "any"/"none" choice; the form omits the key from its output when that option is selected.
 * Set `nullable: true` alongside a `null` option, otherwise a `null` value (including `value: null` as the default) resolves to no selection instead of checking that option.
 *
 * @param config - Radio field configuration
 * @returns A {@link MatRadioField} with type `'radio'`, wrapped by the form-field wrapper
 *
 * @dbxFormField
 * @dbxFormSlug radio
 * @dbxFormTier field-factory
 * @dbxFormProduces T
 * @dbxFormArrayOutput no
 * @dbxFormNgFormType radio
 * @dbxFormWrapperPattern material-form-field-wrapped
 * @dbxFormConfigInterface DbxForgeRadioFieldConfig<T>
 * @dbxFormGeneric <T = unknown>
 *
 * @example
 * ```typescript
 * dbxForgeRadioField<number>({
 *   key: 'minPay',
 *   label: 'Minimum Pay Rate',
 *   layout: 'vertical',
 *   options: [
 *     { label: '$120+', value: 120 },
 *     { label: '$150+', value: 150 }
 *   ]
 * })
 * ```
 */
export const dbxForgeRadioField = dbxForgeFieldFunction<DbxForgeRadioFieldConfig>({
  type: 'radio' as const,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef<DbxForgeRadioFieldConfig>((x, config) => {
    // configure form field wrapper
    x.configure(configureDbxForgeFormFieldWrapper);

    if (config.layout === 'vertical') {
      config.className = config.className ? `${config.className} ${DBX_FORGE_RADIO_FIELD_VERTICAL_CLASS}` : DBX_FORGE_RADIO_FIELD_VERTICAL_CLASS;
    }

    // layout is only used to configure the field
    delete config.layout;
  })
}) as DbxForgeRadioFieldFunction;
