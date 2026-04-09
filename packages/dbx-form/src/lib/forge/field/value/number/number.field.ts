import type { FieldDef } from '@ng-forge/dynamic-forms';
import type { MatInputField, MatInputProps, MatSliderField, MatSliderProps } from '@ng-forge/dynamic-forms-material';
import { filterFromPOJO, DOLLAR_AMOUNT_PRECISION, type TransformNumberFunctionConfigRef } from '@dereekb/util';
import { forgeField } from '../../field';
import { forgeFormFieldWrapper, type ForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';

// MARK: Number Field
/**
 * Numeric constraint configuration for forge number fields.
 */
export interface ForgeNumberFieldNumberConfig {
  readonly min?: number;
  readonly max?: number;
  /**
   * Step increment for the input.
   */
  readonly step?: number;
}

/**
 * Full configuration for a numeric input field in forge.
 *
 * Combines labeling, numeric constraints (min/max/step), and number transformation.
 */
export interface ForgeNumberFieldConfig extends ForgeNumberFieldNumberConfig, Partial<TransformNumberFunctionConfigRef> {
  readonly key: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  readonly defaultValue?: number;
}

/**
 * Creates a forge field definition for a numeric input.
 *
 * @param config - Number field configuration
 * @returns A validated {@link MatInputField} with input type `'number'`
 *
 * @example
 * ```typescript
 * const field = forgeNumberField({ key: 'quantity', label: 'Quantity', min: 1, max: 100, step: 1 });
 * ```
 */
export function forgeNumberField(config: ForgeNumberFieldConfig): MatInputField {
  const { key, label, placeholder, required, readonly: isReadonly, description, min, max, step, defaultValue } = config;

  const props: Partial<MatInputProps> = filterFromPOJO({
    type: 'number' as const,
    hint: description,
    placeholder,
    min,
    max,
    step
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: 'input' as const,
      label: label ?? '',
      value: defaultValue,
      required,
      readonly: isReadonly,
      min,
      max,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as MatInputField
  );
}

// MARK: Number Slider Field
/**
 * Configuration for a forge Material slider field.
 */
export interface ForgeNumberSliderFieldConfig extends ForgeNumberFieldConfig {
  /**
   * Max value. Required for the slider.
   */
  readonly max: number;
  /**
   * Whether or not to show the thumb label while sliding.
   *
   * Defaults to true.
   */
  readonly thumbLabel?: boolean;
  /**
   * Tick interval. If not provided defaults to the step value, if provided.
   * If false, the ticks are disabled.
   */
  readonly tickInterval?: false | number;
}

/**
 * Creates a forge field definition for a Material slider wrapped in a form-field wrapper.
 *
 * The wrapper provides the Material outlined form-field appearance (notched outline with
 * floating label, hint/error subscript). The inner slider uses the ng-forge built-in
 * `slider` type. The wrapper key uses `_` prefix so `stripForgeInternalKeys` flattens
 * the child slider's value into the parent form.
 *
 * @param config - Slider field configuration including max (required), thumb label, and tick interval
 * @returns A {@link ForgeFormFieldWrapperFieldDef} wrapping a slider field
 *
 * @example
 * ```typescript
 * const field = forgeNumberSliderField({ key: 'rating', label: 'Rating', min: 0, max: 10, step: 1 });
 * ```
 */
export function forgeNumberSliderField(config: ForgeNumberSliderFieldConfig): ForgeFormFieldWrapperFieldDef<MatSliderField> {
  const { key, label, required, readonly: isReadonly, description, min, max, step, defaultValue, thumbLabel: inputThumbLabel, tickInterval: inputTickInterval } = config;

  let tickIntervalFromSteps: number | undefined;

  if (step) {
    tickIntervalFromSteps = 1;
  }

  const tickInterval: number | undefined = inputTickInterval === false ? undefined : (inputTickInterval ?? tickIntervalFromSteps ?? undefined);

  // Create the inner slider using ng-forge built-in 'slider' type.
  // Label and hint are omitted here — the wrapper provides those.
  const sliderProps: Partial<MatSliderProps> = filterFromPOJO({
    min,
    max,
    step,
    thumbLabel: inputThumbLabel ?? true,
    tickInterval
  });

  const sliderField: MatSliderField = forgeField(
    filterFromPOJO({
      key,
      type: 'slider' as const,
      label: '',
      value: defaultValue,
      required,
      readonly: isReadonly,
      min,
      max,
      props: Object.keys(sliderProps).length > 0 ? sliderProps : undefined
    }) as MatSliderField
  );

  return forgeFormFieldWrapper<MatSliderField>({
    label: label ?? '',
    hint: description,
    fields: [sliderField as unknown as FieldDef<unknown>]
  });
}

// MARK: Dollar Amount Field
/**
 * Configuration for a forge dollar amount field, which enforces cent-level precision.
 */
export type ForgeDollarAmountFieldConfig = Omit<ForgeNumberFieldConfig, 'roundToStep' | 'precision'>;

/**
 * Creates a forge number field pre-configured for dollar amount input with cent-level precision.
 *
 * @param config - Number field configuration (precision is overridden to dollar amount precision)
 * @returns A {@link MatInputField} for dollar amount input
 *
 * @example
 * ```typescript
 * const field = forgeDollarAmountField({ key: 'price', label: 'Price', min: 0, required: true });
 * ```
 */
export function forgeDollarAmountField(config: ForgeDollarAmountFieldConfig): MatInputField {
  return forgeNumberField({
    ...config,
    transform: {
      ...config.transform,
      precision: config.transform?.precision ?? DOLLAR_AMOUNT_PRECISION
    }
  });
}
