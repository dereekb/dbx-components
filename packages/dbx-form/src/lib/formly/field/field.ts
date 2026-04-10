import { type AsyncValidatorFn, type ValidatorFn } from '@angular/forms';
import { mergeObjects, filterFromPOJO, mergeObjectsFunction, filterFromPOJOFunction, type FilterKeyValueTuplesInput, type GeneralFilterFromPOJOFunction, type ArrayOrValue, type Maybe, asArray, objectHasNoKeys } from '@dereekb/util';
import { type FormlyFieldConfig, type FormlyFieldProps } from '@ngx-formly/core';
import { type ValidationMessageOption } from '../type';
import { type FormlyFieldProps as MaterialFormlyFormFieldProps } from '@ngx-formly/material/form-field';

// Re-export shared field config types for backward compatibility
export { type FieldValueParser, type FormlyValueParser, type FieldConfigParsersRef, type FieldConfigWithParsers, type BaseFieldConfig, type DisableAutocompleteForField, type DefaultValueFieldConfig, type AttributesFieldConfig, type DescriptionFieldConfig, type BasePartialPotentialFieldConfig } from '../../field';
import { type BaseFieldConfig, type FieldConfigParsersRef, type AttributesFieldConfig, type DescriptionFieldConfig } from '../../field';

/**
 * Configuration for a Formly field, extending the shared {@link BaseFieldConfig} with
 * Formly-specific expressions and value parsers.
 */
export interface FieldConfig extends BaseFieldConfig, Pick<FormlyFieldConfig, 'expressions' | 'parsers'>, Partial<FieldConfigParsersRef> {}

/**
 * Labeled Formly field configuration with label, placeholder, and autocomplete support.
 *
 * Extends the Formly-specific {@link FieldConfig} to include expressions and parsers.
 */
export interface LabeledFieldConfig extends FieldConfig {
  label?: string;
  placeholder?: string;
  /**
   * Sets the autocomplete values. Pass `false` to disable autocomplete.
   */
  autocomplete?: string | false;
}

/**
 * Union of all partial Formly field config types, used as a generic input type
 * for functions that accept any combination of field properties.
 *
 * This is the Formly-specific version that includes expressions and parsers.
 */
export type PartialPotentialFieldConfig = Partial<FieldConfig> & Partial<LabeledFieldConfig> & Partial<AttributesFieldConfig> & Partial<DescriptionFieldConfig>;

/**
 * Validates the configuration on the input field.
 *
 * @param fieldConfig - The Formly field configuration to validate
 * @returns The validated field configuration
 *
 * @param fieldConfig - The Formly field configuration to validate
 */
export function formlyField<T extends FormlyFieldConfig = FormlyFieldConfig>(fieldConfig: T): T {
  if (!fieldConfig.key) {
    console.error(fieldConfig);
    throw new Error(`Field had a null key.`);
  }

  return fieldConfig;
}

/**
 * Creates an object with propers, expressions, and parsers properly configured from the input FieldConfig.
 *
 * @param fieldConfig
 * @param override
 * @returns
 */
export function propsAndConfigForFieldConfig<O extends object = object>(fieldConfig: Partial<FieldConfig> & Partial<LabeledFieldConfig> & Partial<AttributesFieldConfig> & Partial<DescriptionFieldConfig>, override?: PartialPotentialFieldConfig & O) {
  const { expressions, parsers } = fieldConfig;
  const props = propsValueForFieldConfig(fieldConfig, override);

  return {
    props,
    expressions,
    parsers
  };
}

/**
 * Keys from {@link PartialPotentialFieldConfig} that are merged into Formly props.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const partialPotentialFieldConfigKeys: (keyof PartialPotentialFieldConfig)[] = ['label', 'placeholder', 'required', 'readonly', 'description', 'autocomplete'];
/**
 * Filter configuration for extracting field config keys from objects.
 */
export const partialPotentialFieldConfigKeysFilter: FilterKeyValueTuplesInput<PartialPotentialFieldConfig> = {
  keysFilter: partialPotentialFieldConfigKeys
};

/**
 * Merge function that combines multiple partial field configs, picking only the recognized keys.
 */
export const mergePropsValueObjects = mergeObjectsFunction<PartialPotentialFieldConfig>(partialPotentialFieldConfigKeysFilter);

/**
 * Filter function that extracts only the recognized field config keys from an object.
 */
export const filterPartialPotentialFieldConfigValuesFromObject = filterFromPOJOFunction<PartialPotentialFieldConfig>({
  filter: partialPotentialFieldConfigKeysFilter
}) as GeneralFilterFromPOJOFunction<PartialPotentialFieldConfig>;

/**
 * Builds a Formly props object from a field config and optional overrides.
 *
 * Merges label, placeholder, required, readonly, description, attributes, and autocomplete
 * settings. When autocomplete is `false`, disables browser autofill via special attributes.
 *
 * @param fieldConfig - Base field configuration
 * @param override - Optional property overrides
 * @returns Merged props object suitable for use in a {@link FormlyFieldConfig}
 */
export function propsValueForFieldConfig<T extends FormlyFieldProps, O extends object = object>(fieldConfig: PartialPotentialFieldConfig, override?: PartialPotentialFieldConfig & O): Partial<T> & O {
  const { label, placeholder, required, readonly, description, autocomplete } = mergePropsValueObjects([fieldConfig, override]);
  const attributes = mergeObjects([fieldConfig.attributes, override?.attributes]);

  const result = filterFromPOJO({
    ...override,
    label,
    placeholder,
    required,
    readonly,
    description,
    attributes
  }) as T & O;

  // Apply autocomplete
  if (autocomplete != null) {
    if (autocomplete === false) {
      result.attributes = {
        ...result.attributes,
        ...disableFormlyFieldAutofillAttributes()
      };
    } else {
      (
        result.attributes as {
          [key: string]: string | number;
        }
      )['autocomplete'] = autocomplete;
    }
  }

  return result;
}

/**
 * Returns configuration for a formlyField that will disable autofill/autocomplete for a field.
 *
 * @returns An attributes object that disables browser autofill
 */
export function disableFormlyFieldAutofillAttributes(): { name: string; autocomplete: string } {
  // https://stackoverflow.com/questions/15738259/disabling-chrome-autofill
  return {
    name: 'password',
    autocomplete: 'off'
  };
}

/**
 * Map of validation message keys to their message strings or functions.
 */
export type FormlyMessageProperties = {
  [messageProperties: string]: ValidationMessageOption['message'];
};

/**
 * Input for building a Formly-compatible validator configuration from Angular validators
 * and custom validation messages.
 */
export interface ValidatorsForFieldConfigInput {
  validators?: ArrayOrValue<ValidatorFn>;
  asyncValidators?: ArrayOrValue<AsyncValidatorFn>;
  messages?: Maybe<FormlyMessageProperties>;
}

/**
 * Formly-compatible validator configuration structure with validators, async validators,
 * and validation messages.
 */
export type ValidatorsForFieldConfig = {
  validation?: {
    messages?: FormlyMessageProperties;
  };
  validators?: {
    validation: ValidatorFn[];
  };
  asyncValidators?: {
    validation: AsyncValidatorFn[];
  };
};

/**
 * Converts Angular validators, async validators, and validation messages into the
 * Formly-compatible validator configuration format.
 *
 * @param input - Validators, async validators, and messages to convert
 * @returns A Formly-compatible validator config, or undefined if no validators provided
 *
 * @example
 * ```typescript
 * const config = validatorsForFieldConfig({
 *   validators: [Validators.required],
 *   messages: { required: 'This field is required' }
 * });
 * ```
 */
export function validatorsForFieldConfig(input: ValidatorsForFieldConfigInput): Maybe<ValidatorsForFieldConfig> {
  const validators: ValidatorFn[] = asArray(input.validators);
  const asyncValidators: AsyncValidatorFn[] = asArray(input.asyncValidators);
  const messages: Maybe<FormlyMessageProperties> = input.messages;
  let config: Maybe<ValidatorsForFieldConfig>;

  if (messages || validators.length || asyncValidators.length) {
    config = {};

    if (validators.length) {
      config.validators = {
        validation: validators
      };
    }

    if (asyncValidators.length) {
      config.validators = {
        validation: asyncValidators
      };
    }

    if (messages && !objectHasNoKeys(messages)) {
      config.validation = {
        messages
      };
    }
  }

  return config;
}

// MARK: Material
/**
 * Configuration mixin for Material form field styling options (prefix, suffix, appearance, etc.).
 */
export interface MaterialFormFieldConfig {
  readonly materialFormField?: Partial<Pick<MaterialFormlyFormFieldProps, 'prefix' | 'suffix' | 'hideLabel' | 'hideRequiredMarker' | 'hideFieldUnderline' | 'floatLabel' | 'appearance' | 'color' | 'hintStart' | 'hintEnd'>>;
}
