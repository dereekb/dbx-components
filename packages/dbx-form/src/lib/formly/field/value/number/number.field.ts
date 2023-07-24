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

export interface NumberSliderFieldConfig extends NumberFieldConfig {
  /**
   * Max value. Required for the slider.
   */
  max: number;
  /**
   * Whether or not to show the thumb label while sliding. Defaults to true.
   */
  thumbLabel?: boolean;
  /**
   * Whether or not to invert the selection line.
   */
  invertSelectionColoring?: boolean;
  /**
   * Tick interval. If not provided defaults to the step value, if provided. If false, the ticks are disabled.
   *
   * The tick interval is the number of "steps" to show between ticks.
   *
   * For example, a tick interval of 5 show a tick every 5 steps. If steps are 10, it will show a tick at every number divisible by 50 (5 * 10).
   */
  tickInterval?: false | number;
  /**
   * Custom display with function for the thumbLabel.
   */
  displayWith?: (value: number) => string;
}

export function numberSliderField(config: NumberSliderFieldConfig): FormlyFieldConfig {
  const { key, min, max, step, enforceStep, inputType: type = 'number', materialFormField, thumbLabel: inputThumbLabel, tickInterval: inputTickInterval, invertSelectionColoring: invertedSelectionColoring = false, displayWith } = config;
  const parsers = numberFieldTransformParser(config);

  const validators: ValidatorFn[] = [];
  let tickIntervalFromSteps: number | undefined;

  if (step) {
    tickIntervalFromSteps = 1;

    if (enforceStep) {
      validators.push(isDivisibleBy(step));
    }
  }

  const tickInterval: number | undefined = inputTickInterval === false ? undefined : inputTickInterval ?? tickIntervalFromSteps ?? undefined;

  return formlyField({
    key,
    type: 'slider',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      type,
      min,
      max,
      step,
      inverted: invertedSelectionColoring,
      thumbLabel: inputThumbLabel ?? true,
      showTickMarks: Boolean(tickInterval),
      tickInterval,
      displayWith
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
