import { Maybe } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DescriptionFieldConfig, formlyField, LabeledFieldConfig, propsForFieldConfig } from '../field';

export interface ValueSelectionOption<T> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface ValueSelectionFieldConfig<T> extends LabeledFieldConfig, DescriptionFieldConfig {
  native?: boolean;
  options: ValueSelectionOption<T>[];
  multiple?: boolean;
  selectAllOption?: true | string;
}

export function valueSelectionField<T>(config: ValueSelectionFieldConfig<T>): FormlyFieldConfig {
  const { key, native = false, selectAllOption: inputSelectAllOption } = config;
  let selectAllOptionConfig: Maybe<{ selectAllOption: string }>;

  if (inputSelectAllOption) {
    selectAllOptionConfig = {
      selectAllOption: typeof inputSelectAllOption === 'boolean' ? 'Select All' : (inputSelectAllOption as string)
    };
  }

  return formlyField({
    key,
    type: native ? 'native-select' : 'select',
    ...propsForFieldConfig(config, {
      options: config.options,
      multiple: config.multiple ?? false,
      ...selectAllOptionConfig
    })
  });
}
