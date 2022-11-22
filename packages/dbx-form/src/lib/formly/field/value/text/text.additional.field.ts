import { FormlyFieldConfig } from '@ngx-formly/core';
import { Validators, AbstractControl } from '@angular/forms';
import { TextFieldConfig, textField } from './text.field';
import { LabeledFieldConfig, DescriptionFieldConfig, validatorsForFieldConfig } from '../../field';
import { LAT_LNG_PATTERN, US_STATE_CODE_STRING_REGEX, ZIP_CODE_STRING_REGEX } from '@dereekb/util';
import { ADDRESS_CITY_MAX_LENGTH, ADDRESS_STATE_CODE_MAX_LENGTH, ADDRESS_STATE_MAX_LENGTH, ADDRESS_COUNTRY_MAX_LENGTH, ADDRESS_ZIP_MAX_LENGTH } from '@dereekb/model';

export const PHONE_LABEL_MAX_LENGTH = 100;

export const LABEL_STRING_MAX_LENGTH = 100;
export const SEARCH_STRING_MAX_LENGTH = 100;

export function nameField(config: Partial<TextFieldConfig> = {}): FormlyFieldConfig {
  const { key = 'name', label = 'Name', placeholder = 'John Doe', required = false, minLength, maxLength, attributes } = config;

  return textField({
    ...config,
    key,
    label,
    placeholder,
    required,
    minLength,
    maxLength,
    attributes
  });
}

export interface EmailFieldConfig extends Partial<LabeledFieldConfig>, DescriptionFieldConfig {
  rows?: number;
}

export function emailField(config: EmailFieldConfig = {}): FormlyFieldConfig {
  const { key = 'email', label = 'Email Address', placeholder = 'you@example.com' } = config;
  const emailFieldConfig = textField({
    ...config,
    key,
    label,
    placeholder,
    inputType: 'email'
  });

  emailFieldConfig.validators = {
    email: {
      expression: (c: AbstractControl) => !Validators.email(c),
      message: () => `Not a valid email address.`
    }
  };

  return emailFieldConfig;
}

export type CityFieldConfig = Partial<TextFieldConfig>;

export function cityField(config: CityFieldConfig = {}): FormlyFieldConfig {
  const { key = 'city', placeholder = '', label = 'City', autocomplete = 'city', maxLength = ADDRESS_CITY_MAX_LENGTH, required = false } = config;
  return textField({
    ...config,
    key,
    placeholder,
    label,
    autocomplete,
    required,
    maxLength
  });
}

export interface StateFieldConfig extends Partial<TextFieldConfig> {
  asCode?: boolean;
}

export function stateField(config: StateFieldConfig = {}): FormlyFieldConfig {
  const { asCode = false, pattern = asCode ? US_STATE_CODE_STRING_REGEX : undefined, key = 'state', placeholder = '', label = 'State', autocomplete = 'state', maxLength = asCode ? ADDRESS_STATE_CODE_MAX_LENGTH : ADDRESS_STATE_MAX_LENGTH, required = false } = config;
  return textField({
    ...config,
    key,
    placeholder,
    label,
    pattern,
    autocomplete,
    required,
    maxLength,
    transform: {
      toUppercase: true
    }
  });
}

export type CountryFieldConfig = Partial<TextFieldConfig>;

export function countryField(config: CountryFieldConfig = {}): FormlyFieldConfig {
  const { key = 'country', placeholder = '', label = 'Country', autocomplete = 'country', maxLength = ADDRESS_COUNTRY_MAX_LENGTH, required = false } = config;
  return textField({
    ...config,
    key,
    placeholder,
    label,
    autocomplete,
    required,
    maxLength
  });
}

export type ZipCodeFieldConfig = Partial<TextFieldConfig>;

export function zipCodeField(config: ZipCodeFieldConfig = {}): FormlyFieldConfig {
  const { key = 'zip', placeholder = '', label = 'Zip Code', autocomplete = 'postal-code', pattern = ZIP_CODE_STRING_REGEX, maxLength = ADDRESS_ZIP_MAX_LENGTH, required = false } = config;
  return textField({
    ...config,
    key,
    placeholder,
    label,
    pattern,
    autocomplete,
    required,
    maxLength
  });
}

export const DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER = '12.345,-67.8910';
export const DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE = `Invalid/unknown coordinates`;

export function latLngTextField({ key = 'latLng' }: Partial<TextFieldConfig> = {}): FormlyFieldConfig {
  const field = {
    ...textField({
      key,
      label: 'Coordinates',
      placeholder: DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER,
      pattern: LAT_LNG_PATTERN,
      autocomplete: false
    }),
    ...validatorsForFieldConfig({
      messages: {
        pattern: DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE
      }
    })
  };

  return field;
}
