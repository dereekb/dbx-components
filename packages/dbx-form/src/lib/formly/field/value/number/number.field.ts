import { FormlyFieldConfig } from '@ngx-formly/core';
import { AttributesFieldConfig, LabeledFieldConfig, formlyField, propsForFieldConfig, DescriptionFieldConfig } from '../../field';

export interface NumberFieldLengthConfig {
  min?: number;
  max?: number;
}

export type NumberFieldInputType = 'number';

export interface NumberFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, NumberFieldLengthConfig, AttributesFieldConfig {
  inputType?: NumberFieldInputType;
}

export function numberField(config: NumberFieldConfig): FormlyFieldConfig {
  const { key, min, max, inputType: type = 'number' } = config;
  return formlyField({
    key,
    type: 'input',
    ...propsForFieldConfig(config, {
      type,
      min,
      max
    })
  });
}
