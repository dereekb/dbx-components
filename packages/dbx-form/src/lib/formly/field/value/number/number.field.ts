import { ValidatorFn } from '@angular/forms';
import { concatArrays, TransformNumberFunctionConfigRef, transformNumberFunction, mapMaybeFunction } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { isDivisibleBy } from '../../../../validator';
import { AttributesFieldConfig, LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, DescriptionFieldConfig, validatorsForFieldConfig, FieldConfigParsersRef, FormlyValueParser, MaterialFormFieldConfig } from '../../field';

export interface NumberFieldNumberConfig {
  min?: number;
  max?: number;
  step?: number;
  enforceStep?: boolean;
}

export type NumberFieldInputType = 'number';

export interface NumberFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, NumberFieldNumberConfig, AttributesFieldConfig, Partial<TransformNumberFunctionConfigRef>, MaterialFormFieldConfig {
  inputType?: NumberFieldInputType;
}

export function numberFieldTransformParser(config: Partial<FieldConfigParsersRef> & Partial<TransformNumberFunctionConfigRef>) {
  const { parsers: inputParsers, transform } = config;
  let parsers: FormlyValueParser[] | undefined;

  if (inputParsers) {
    parsers = inputParsers;
  }

  if (transform) {
    const transformParser: FormlyValueParser = mapMaybeFunction(transformNumberFunction(transform));
    parsers = concatArrays([transformParser], parsers);
  }

  return parsers;
}

export function numberField(config: NumberFieldConfig): FormlyFieldConfig {
  const { key, min, max, step, enforceStep, inputType: type = 'number', materialFormField } = config;
  const parsers = numberFieldTransformParser(config);

  const validators: ValidatorFn[] = [];

  if (step && enforceStep) {
    validators.push(isDivisibleBy(step));
  }

  return formlyField({
    key,
    type: 'input',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      type,
      min,
      max,
      step
    }),
    ...validatorsForFieldConfig({
      validators
    }),
    parsers
  });
}

export type DollarAmountFieldConfig = Omit<NumberFieldConfig, 'roundToStep' | 'precision'>;

export function dollarAmountField(config: DollarAmountFieldConfig) {
  return numberField({ ...config, transform: { ...config.transform, precision: 2 } });
}
