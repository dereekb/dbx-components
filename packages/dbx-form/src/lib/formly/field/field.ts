import { type AsyncValidatorFn, type ValidatorFn } from '@angular/forms';
import { mergeObjects, filterFromPOJO, mergeObjectsFunction, filterFromPOJOFunction, type FilterKeyValueTuplesInput, type GeneralFilterFromPOJOFunction, type ArrayOrValue, type Maybe, asArray, objectHasNoKeys, type MapFunction } from '@dereekb/util';
import { type FormlyFieldConfig, type FormlyFieldProps } from '@ngx-formly/core';
import { type ValidationMessageOption } from '../type';
import { type FormlyFieldProps as MaterialFormlyFormFieldProps } from '@ngx-formly/material/form-field';

/**
 * A value parser function that transforms a form field's value from one type to another.
 */
export type FormlyValueParser<I = any, O = any> = MapFunction<I, O>;

/**
 * Reference to an array of value parsers applied to a field's value.
 */
export interface FieldConfigParsersRef {
  parsers: FormlyValueParser[];
}

/**
 * Base configuration for a Formly field, providing the key, required/readonly flags,
 * expressions, and optional value parsers.
 */
export interface FieldConfig extends Pick<FormlyFieldConfig, 'expressions' | 'parsers'>, Partial<FieldConfigParsersRef> {
  key: string;
  required?: boolean;
  readonly?: boolean;
}

/**
 * Optional reference to value parsers for a field.
 */
export interface FieldConfigWithParsers {
  parsers?: FormlyValueParser[];
}

/**
 * Sentinel type to disable autocomplete on a field. Pass `false` to the autocomplete property.
 */
export type DisableAutocompleteForField = false;

export interface LabeledFieldConfig extends FieldConfig {
  key: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  readonly?: boolean;
  /**
   * Sets the autocomplete values.
   */
  autocomplete?: string | DisableAutocompleteForField;
}

/**
 * Configuration mixin that provides a default value for a form field.
 */
export interface DefaultValueFieldConfig<T = unknown> {
  defaultValue?: T;
}

/**
 * Configuration mixin for arbitrary HTML attributes on a form field element.
 */
export interface AttributesFieldConfig {
  attributes?: {
    [key: string]: string | number;
  };
}

/**
 * Configuration mixin for a field description/help text.
 */
export interface DescriptionFieldConfig {
  description?: string;
}

/**
 * Union of all partial field config types, used as a generic input type
 * for functions that accept any combination of field properties.
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
