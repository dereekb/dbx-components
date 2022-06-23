import { ValidatorFn } from '@angular/forms';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { isDivisibleBy } from '../../../../validator';
import { AttributesFieldConfig, LabeledFieldConfig, formlyField, propsForFieldConfig, DescriptionFieldConfig, validatorsForFieldConfig } from '../../field';

export interface NumberFieldNumberConfig {
  min?: number;
  max?: number;
  step?: number;
  enforceStep?: boolean;
}

export type NumberFieldInputType = 'number';

export interface NumberFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, NumberFieldNumberConfig, AttributesFieldConfig {
  inputType?: NumberFieldInputType;
}

export function numberField(config: NumberFieldConfig): FormlyFieldConfig {
  const { key, min, max, step, enforceStep, inputType: type = 'number' } = config;

  const validators: ValidatorFn[] = [];

  if (step && enforceStep) {
    validators.push(isDivisibleBy(step));
  }

  return formlyField({
    key,
    type: 'input',
    ...propsForFieldConfig(config, {
      type,
      min,
      max,
      step
    }),
    ...validatorsForFieldConfig({
      validators
    })
  });
}
