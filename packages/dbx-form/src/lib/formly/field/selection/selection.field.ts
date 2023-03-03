import { asObservable, ObservableOrValue } from '@dereekb/rxjs';
import { LabeledValue, Maybe } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { map } from 'rxjs';
import { DescriptionFieldConfig, formlyField, LabeledFieldConfig, MaterialFormFieldConfig, propsAndConfigForFieldConfig } from '../field';

export interface ValueSelectionOptionWithValue<T> extends LabeledValue<T> {
  disabled?: boolean;
}

export interface ValueSelectionOptionClear {
  label?: string;
  clear: true;
}

export type ValueSelectionOption<T> = ValueSelectionOptionWithValue<T> | ValueSelectionOptionClear;

export interface ValueSelectionFieldConfig<T> extends LabeledFieldConfig, DescriptionFieldConfig, MaterialFormFieldConfig {
  /**
   * Whether or not to use the native select.
   *
   * Be sure to import FormlyMatNativeSelectModule.
   */
  native?: boolean;
  /**
   * Whether or not to add a clear option to the input values. If using an observable, this
   */
  addClearOption?: string | boolean;
  /**
   * Values to select from.
   */
  options: ObservableOrValue<ValueSelectionOption<T>[]>;
  /**
   * Allow selecting multiple values and return an array.
   */
  multiple?: boolean;
  /**
   * The select all option configuration.
   */
  selectAllOption?: true | string;
}

export function valueSelectionField<T>(config: ValueSelectionFieldConfig<T>): FormlyFieldConfig {
  const { key, native = false, addClearOption = false, selectAllOption: inputSelectAllOption, options: inputOptions, materialFormField } = config;
  let selectAllOptionConfig: Maybe<{ selectAllOption: string }>;

  if (inputSelectAllOption) {
    selectAllOptionConfig = {
      selectAllOption: typeof inputSelectAllOption === 'boolean' ? 'Select All' : (inputSelectAllOption as string)
    };
  }

  const options = addClearOption ? asObservable(inputOptions).pipe(map(addValueSelectionOptionFunction(typeof addClearOption === 'string' ? addClearOption : undefined))) : inputOptions;

  return formlyField({
    key,
    type: native ? 'native-select' : 'select',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      options,
      multiple: config.multiple ?? false,
      ...selectAllOptionConfig
    })
  });
}

export function addValueSelectionOptionFunction<T>(label?: string | undefined): (options: ValueSelectionOption<T>[]) => ValueSelectionOption<T>[] {
  return (options: ValueSelectionOption<T>[]) => {
    const hasClear = options.findIndex((x) => (x as ValueSelectionOptionClear).clear) !== -1;

    if (hasClear) {
      return options;
    } else {
      return [{ label, clear: true }, ...options];
    }
  };
}
