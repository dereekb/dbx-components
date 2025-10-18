import { asObservable, type ObservableOrValue } from '@dereekb/rxjs';
import { convertMaybeToArray, firstValue, type LabeledValue, type Maybe } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { map } from 'rxjs';
import { type DescriptionFieldConfig, formlyField, type FormlyValueParser, type LabeledFieldConfig, type MaterialFormFieldConfig, propsAndConfigForFieldConfig } from '../field';

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

export function valueSelectionField<T>(config: ValueSelectionFieldConfig<T>): FormlyFieldConfig {
  const { key, native = false, addClearOption = false, selectAllOption: inputSelectAllOption, options: inputOptions, materialFormField } = config;
  let selectAllOptionConfig: Maybe<{ selectAllOption: string }>;

  if (inputSelectAllOption) {
    selectAllOptionConfig = {
      selectAllOption: typeof inputSelectAllOption === 'boolean' ? 'Select All' : (inputSelectAllOption as string)
    };
  }

  const options = addClearOption ? asObservable(inputOptions).pipe(map(addValueSelectionOptionFunction(typeof addClearOption === 'string' ? addClearOption : undefined))) : inputOptions;
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
