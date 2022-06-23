import { AsyncValidatorFn, ValidatorFn } from '@angular/forms';
import { mergeObjects, filterFromPOJO, mergeObjectsFunction, filterFromPOJOFunction, FilterKeyValueTuplesInput, GeneralFilterFromPOJOFunction, ArrayOrValue, Maybe, asArray, objectHasNoKeys } from '@dereekb/util';
import { FormlyFieldConfig, FormlyFieldProps } from '@ngx-formly/core';
import { ValidationMessageOption } from '@ngx-formly/core/lib/models';

export interface FieldConfig {
  key: string;
  required?: boolean;
  readonly?: boolean;
}

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

export interface DefaultValueFieldConfig<T = unknown> {
  defaultValue?: T;
}

export interface AttributesFieldConfig {
  attributes?: {
    [key: string]: string | number;
  };
}

export interface DescriptionFieldConfig {
  description?: string;
}

export type PartialPotentialFieldConfig = Partial<FieldConfig> & Partial<LabeledFieldConfig> & Partial<AttributesFieldConfig> & Partial<DescriptionFieldConfig>;

/**
 * Validates the configuration on the input field.
 */
export function formlyField<T extends FormlyFieldConfig = FormlyFieldConfig>(fieldConfig: T): T {
  if (!fieldConfig.key) {
    console.error(fieldConfig);
    throw new Error(`Field had a null key.`);
  }

  return fieldConfig;
}

export function propsForFieldConfig<O extends object = object>(fieldConfig: Partial<FieldConfig> & Partial<LabeledFieldConfig> & Partial<AttributesFieldConfig> & Partial<DescriptionFieldConfig>, override?: PartialPotentialFieldConfig & O) {
  const props = propsValueForFieldConfig(fieldConfig, override);

  return {
    props
  };
}

export const partialPotentialFieldConfigKeys: (keyof PartialPotentialFieldConfig)[] = ['label', 'placeholder', 'required', 'readonly', 'description', 'autocomplete'];
export const partialPotentialFieldConfigKeysFilter: FilterKeyValueTuplesInput<PartialPotentialFieldConfig> = {
  keysFilter: partialPotentialFieldConfigKeys
};

export const mergePropsValueObjects = mergeObjectsFunction<PartialPotentialFieldConfig>(partialPotentialFieldConfigKeysFilter);

export const filterPartialPotentialFieldConfigValuesFromObject = filterFromPOJOFunction<PartialPotentialFieldConfig>({
  filter: partialPotentialFieldConfigKeysFilter
}) as GeneralFilterFromPOJOFunction<PartialPotentialFieldConfig>;

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
 */
export function disableFormlyFieldAutofillAttributes(): { name: string; autocomplete: string } {
  // https://stackoverflow.com/questions/15738259/disabling-chrome-autofill
  return {
    name: 'password',
    autocomplete: 'off'
  };
}

export type FormlyMessageProperties = {
  [messageProperties: string]: ValidationMessageOption['message'];
};

export interface ValidatorsForFieldConfigInput {
  validators?: ArrayOrValue<ValidatorFn>;
  asyncValidators?: ArrayOrValue<AsyncValidatorFn>;
  messages?: Maybe<FormlyMessageProperties>;
}

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
