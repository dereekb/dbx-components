import { asObservable, type ObservableOrValue } from '@dereekb/rxjs';
import { convertMaybeToArray, firstValue, type LabeledValue, type Maybe } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { map } from 'rxjs';
import { type DescriptionFieldConfig, formlyField, type FormlyValueParser, type LabeledFieldConfig, type MaterialFormFieldConfig, propsAndConfigForFieldConfig } from '../field';

/**
 * A selectable option with a value, label, and optional disabled state.
 */
export interface ValueSelectionOptionWithValue<T> extends LabeledValue<T> {
  disabled?: boolean;
}

/**
 * A special "clear" option that resets the selection when chosen.
 */
export interface ValueSelectionOptionClear {
  label?: string;
  clear: true;
}

/**
 * A selectable option: either a value option or a clear option.
 */
export type ValueSelectionOption<T> = ValueSelectionOptionWithValue<T> | ValueSelectionOptionClear;

export interface ValueSelectionFieldConfig<T> extends LabeledFieldConfig, DescriptionFieldConfig, MaterialFormFieldConfig {
  /**
   * Whether or not to use the native select.
   *
   * Be sure to import FormlyMatNativeSelectModule.
   */
  readonly native?: boolean;
  /**
   * Whether or not to add a clear option to the input values.
   */
  readonly addClearOption?: string | boolean;
  /**
   * Values to select from.
   */
  readonly options: ObservableOrValue<ValueSelectionOption<T>[]>;
  /**
   * Allow selecting multiple values and return an array.
   */
  readonly multiple?: boolean;
  /**
   * The select all option configuration.
   */
  readonly selectAllOption?: true | string;
}

/**
 * Creates a Formly select field configuration with support for native/material select,
 * clear option, multiple selection, and "select all".
 *
 * @param config - Selection field configuration
 * @returns A validated {@link FormlyFieldConfig} with type `'select'` or `'native-select'`
 *
 * @example
 * ```typescript
 * const field = formlyValueSelectionField({
 *   key: 'color',
 *   label: 'Color',
 *   options: [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }]
 * });
 * ```
 */
export function formlyValueSelectionField<T>(config: ValueSelectionFieldConfig<T>): FormlyFieldConfig {
  const { key, native = false, addClearOption = false, selectAllOption: inputSelectAllOption, options: inputOptions, materialFormField } = config;
  let selectAllOptionConfig: Maybe<{ selectAllOption: string }>;

  if (inputSelectAllOption) {
    selectAllOptionConfig = {
      selectAllOption: typeof inputSelectAllOption === 'boolean' ? 'Select All' : (inputSelectAllOption as string)
    };
  }

  const options = addClearOption ? asObservable(inputOptions).pipe(map(formlyAddValueSelectionOptionFunction(typeof addClearOption === 'string' ? addClearOption : undefined))) : inputOptions;
  let parsers: FormlyValueParser[] | undefined = undefined;

  parsers = config.multiple !== true ? [firstValue] : [convertMaybeToArray];

  return formlyField({
    key,
    type: native ? 'native-select' : 'select',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      options,
      multiple: config.multiple,
      ...selectAllOptionConfig
    }),
    parsers
  });
}

/**
 * Creates a function that prepends a "clear" option to the selection options array
 * if one doesn't already exist.
 *
 * @param label - Optional label for the clear option
 * @returns A function that transforms selection options by prepending a clear option
 */
export function formlyAddValueSelectionOptionFunction<T>(label?: string | undefined): (options: ValueSelectionOption<T>[]) => ValueSelectionOption<T>[] {
  return (options: ValueSelectionOption<T>[]) => {
    const hasClear = options.some((x) => (x as ValueSelectionOptionClear).clear);

    if (hasClear) {
      return options;
    } else {
      return [{ label, clear: true }, ...options];
    }
  };
}

// MARK: Deprecated
/** @deprecated Use formlyValueSelectionField instead. */
export const valueSelectionField = formlyValueSelectionField;
/** @deprecated Use formlyAddValueSelectionOptionFunction instead. */
export const addValueSelectionOptionFunction = formlyAddValueSelectionOptionFunction;
