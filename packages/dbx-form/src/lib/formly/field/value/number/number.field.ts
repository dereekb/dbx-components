import { type ValidatorFn } from '@angular/forms';
import { concatArrays, type TransformNumberFunctionConfigRef, transformNumberFunction, mapMaybeFunction, DOLLAR_AMOUNT_PRECISION } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { isDivisibleBy } from '../../../../validator';
import { type AttributesFieldConfig, type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, type DescriptionFieldConfig, validatorsForFieldConfig, type FieldConfigParsersRef, type FieldValueParser, type MaterialFormFieldConfig } from '../../field';

// MARK: Number Field
/**
 * Numeric constraint configuration for number fields.
 */
export interface NumberFieldNumberConfig {
  readonly min?: number;
  readonly max?: number;
  /**
   * Step increment for the input.
   */
  readonly step?: number;
  /**
   * When true, adds a validator that enforces the value is divisible by `step`.
   */
  readonly enforceStep?: boolean;
}

/**
 * HTML input type for number fields.
 */
export type NumberFieldInputType = 'number';

/**
 * Full configuration for a numeric input field.
 *
 * Combines labeling, numeric constraints (min/max/step), number transformation,
 * and Material form field styling.
 */
export interface NumberFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, NumberFieldNumberConfig, AttributesFieldConfig, Partial<TransformNumberFunctionConfigRef>, MaterialFormFieldConfig {
  readonly inputType?: NumberFieldInputType;
}

/**
 * Builds an array of value parsers for a number field, incorporating any configured
 * number transformation (e.g., precision, rounding) as a parser prepended to existing parsers.
 *
 * @param config - Parser and transform configuration
 * @returns Array of value parsers, or undefined if none configured
 *
 * @example
 * ```typescript
 * const parsers = numberFieldTransformParser({ transform: { precision: 2 } });
 * ```
 */
export function formlyNumberFieldTransformParser(config: Partial<FieldConfigParsersRef> & Partial<TransformNumberFunctionConfigRef>) {
  const { parsers: inputParsers, transform } = config;
  let parsers: FieldValueParser[] | undefined;

  if (inputParsers) {
    parsers = inputParsers;
  }

  if (transform) {
    const transformParser: FieldValueParser = mapMaybeFunction(transformNumberFunction(transform));
    parsers = concatArrays([transformParser], parsers);
  }

  return parsers;
}

/**
 * Creates a Formly field configuration for a numeric input.
 *
 * Adds a divisibility validator when both `step` and `enforceStep` are set.
 *
 * @param config - Number field configuration
 * @returns A validated {@link FormlyFieldConfig} with type `'input'` and input type `'number'`
 *
 * @example
 * ```typescript
 * const field = numberField({ key: 'quantity', label: 'Quantity', min: 1, max: 100, step: 1 });
 * ```
 */
export function formlyNumberField(config: NumberFieldConfig): FormlyFieldConfig {
  const { key, min, max, step, enforceStep, inputType: type = 'number', materialFormField } = config;
  const parsers = formlyNumberFieldTransformParser(config);

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

// MARK: Number Slider
export interface NumberSliderFieldConfig extends NumberFieldConfig {
  /**
   * Max value. Required for the slider.
   */
  readonly max: number;
  /**
   * Whether or not to show the thumb label while sliding.
   *
   * Defaults to true.
   *
   * Corresponds to "discrete" in Material.
   */
  readonly thumbLabel?: boolean;
  /**
   * Whether or not to invert the selection line.
   */
  readonly invertSelectionColoring?: boolean;
  /**
   * Tick interval. If not provided defaults to the step value, if provided. If false, the ticks are disabled.
   *
   * The tick interval is the number of "steps" to show between ticks.
   *
   * For example, a tick interval of 5 show a tick every 5 steps. If steps are 10, it will show a tick at every number divisible by 50 (5 * 10).
   */
  readonly tickInterval?: false | number;
  /**
   * Custom display with function for the thumbLabel.
   */
  readonly displayWith?: (value: number) => string;
}

/**
 * Creates a Formly field configuration for a Material slider input.
 *
 * @param config - Slider field configuration including max (required), thumb label, and tick interval
 * @returns A validated {@link FormlyFieldConfig} with type `'slider'`
 *
 * @example
 * ```typescript
 * const field = numberSliderField({ key: 'rating', label: 'Rating', min: 0, max: 10, step: 1 });
 * ```
 */
export function formlyNumberSliderField(config: NumberSliderFieldConfig): FormlyFieldConfig {
  const { key, min, max, step, enforceStep, inputType: type = 'number', materialFormField, thumbLabel: inputThumbLabel, tickInterval: inputTickInterval, invertSelectionColoring: invertedSelectionColoring = false, displayWith } = config;
  const parsers = formlyNumberFieldTransformParser(config);

  const validators: ValidatorFn[] = [];
  let tickIntervalFromSteps: number | undefined;

  if (step) {
    tickIntervalFromSteps = 1;

    if (enforceStep) {
      validators.push(isDivisibleBy(step));
    }
  }

  const tickInterval: number | undefined = inputTickInterval === false ? undefined : (inputTickInterval ?? tickIntervalFromSteps ?? undefined);
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
      discrete: inputThumbLabel ?? true,
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

// MARK: Dollar Amount Field
/**
 * Configuration for a dollar amount field, which enforces cent-level precision.
 */
export type DollarAmountFieldConfig = Omit<NumberFieldConfig, 'roundToStep' | 'precision'>;

/**
 * Creates a number field pre-configured for dollar amount input with cent-level precision.
 *
 * @param config - Number field configuration (precision is overridden to dollar amount precision)
 * @returns A {@link FormlyFieldConfig} for dollar amount input
 *
 * @example
 * ```typescript
 * const field = dollarAmountField({ key: 'price', label: 'Price', min: 0, required: true });
 * ```
 */
export function formlyDollarAmountField(config: DollarAmountFieldConfig) {
  return formlyNumberField({ ...config, transform: { ...config.transform, precision: config.transform?.precision ?? DOLLAR_AMOUNT_PRECISION } }); // TODO: Add wrapper addon, addonLeft: { text: '$' }
}

// MARK: Deprecated Aliases
/**
 * @deprecated Use formlyNumberFieldTransformParser instead.
 */
export const numberFieldTransformParser = formlyNumberFieldTransformParser;
/**
 * @deprecated Use formlyNumberField instead.
 */
export const numberField = formlyNumberField;
/**
 * @deprecated Use formlyNumberSliderField instead.
 */
export const numberSliderField = formlyNumberSliderField;
/**
 * @deprecated Use formlyDollarAmountField instead.
 */
export const dollarAmountField = formlyDollarAmountField;
