import { mergeObjects, filterFromPOJO } from '@dereekb/util';
import { FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';

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
    [key: string]: string | number
  }
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

export function templateOptionsForFieldConfig<O extends object = object>(fieldConfig: Partial<FieldConfig> & Partial<LabeledFieldConfig> & Partial<AttributesFieldConfig> & Partial<DescriptionFieldConfig>, override?: PartialPotentialFieldConfig & O) {
  const templateOptions = templateOptionsValueForFieldConfig(fieldConfig, override);

  return {
    templateOptions
  };
}

export function templateOptionsValueForFieldConfig<T extends FormlyTemplateOptions, O extends object = object>(fieldConfig: PartialPotentialFieldConfig, override?: PartialPotentialFieldConfig & O): Partial<T> {
  const { label, placeholder, required, readonly, description, autocomplete } = mergeObjects<PartialPotentialFieldConfig>([fieldConfig, override], { keysFilter: ['label', 'placeholder', 'required', 'readonly', 'description', 'autocomplete'] });
  const attributes = mergeObjects([fieldConfig.attributes, override?.attributes]);

  const result = filterFromPOJO({
    ...override,
    label,
    placeholder,
    required,
    readonly,
    description,
    attributes
  }) as T;

  // Apply autocomplete
  if (autocomplete != null) {
    if (autocomplete === false) {
      result.attributes = {
        ...result.attributes,
        ...disableFormlyFieldAutofillAttributes()
      }
    } else {
      (result.attributes as {
        [key: string]: string | number;
      })['autocomplete'] = autocomplete;
    }
  }

  return result;
}

/**
 * Returns configuration for a formlyField that will disable autofill/autocomplete for a field.
 */
export function disableFormlyFieldAutofillAttributes(): { name: string, autocomplete: string } {
  // https://stackoverflow.com/questions/15738259/disabling-chrome-autofill
  return {
    name: 'password',
    autocomplete: 'off'
  };
}
