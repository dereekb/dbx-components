import { type FormlyFieldConfig } from '@ngx-formly/core';
import { Validators, type AbstractControl } from '@angular/forms';
import { type TextFieldConfig, formlyTextField } from './text.field';
import { type LabeledFieldConfig, type DescriptionFieldConfig, validatorsForFieldConfig } from '../../field';
import { LAT_LNG_PATTERN, US_STATE_CODE_STRING_REGEX, ZIP_CODE_STRING_REGEX } from '@dereekb/util';
import { ADDRESS_CITY_MAX_LENGTH, ADDRESS_STATE_CODE_MAX_LENGTH, ADDRESS_STATE_MAX_LENGTH, ADDRESS_COUNTRY_MAX_LENGTH, ADDRESS_ZIP_MAX_LENGTH } from '@dereekb/model';

/**
 * Maximum character length for a phone label field.
 */
export const PHONE_LABEL_MAX_LENGTH = 100;

/**
 * Maximum character length for a generic label string field.
 */
export const LABEL_STRING_MAX_LENGTH = 100;
/**
 * Maximum character length for a search string field.
 */
export const SEARCH_STRING_MAX_LENGTH = 100;

// MARK: Name Field
/**
 * Creates a text field pre-configured for a person's full name.
 *
 * @param config - Optional overrides; defaults to key `'name'`, label `'Name'`
 * @returns A {@link FormlyFieldConfig} for name input
 *
 * @example
 * ```typescript
 * const field = nameField({ required: true });
 * ```
 */
export function formlyNameField(config: Partial<TextFieldConfig> = {}): FormlyFieldConfig {
  const { key = 'name', label = 'Name', placeholder = 'John Doe', required = false, minLength, maxLength, attributes } = config;

  return formlyTextField({
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

// MARK: Email Field
/**
 * Configuration for an email address input field.
 */
export interface EmailFieldConfig extends Partial<LabeledFieldConfig>, DescriptionFieldConfig {
  readonly rows?: number;
}

/**
 * Creates a text field pre-configured for email address input with built-in email validation.
 *
 * @param config - Optional overrides; defaults to key `'email'`, label `'Email Address'`
 * @returns A {@link FormlyFieldConfig} with email validation
 *
 * @example
 * ```typescript
 * const field = emailField({ required: true });
 * ```
 */
export function formlyEmailField(config: EmailFieldConfig = {}): FormlyFieldConfig {
  const { key = 'email', label = 'Email Address', placeholder = 'you@example.com' } = config;
  const emailFieldConfig = formlyTextField({
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

// MARK: City Field
/**
 * Configuration for a city input field.
 */
export type CityFieldConfig = Partial<TextFieldConfig>;

/**
 * Creates a text field pre-configured for city name input with autocomplete support.
 *
 * @param config - Optional overrides; defaults to key `'city'`, label `'City'`
 * @returns A {@link FormlyFieldConfig} for city input
 *
 * @example
 * ```typescript
 * const field = cityField({ required: true });
 * ```
 */
export function formlyCityField(config: CityFieldConfig = {}): FormlyFieldConfig {
  const { key = 'city', placeholder = '', label = 'City', autocomplete = 'city', maxLength = ADDRESS_CITY_MAX_LENGTH, required = false } = config;
  return formlyTextField({
    ...config,
    key,
    placeholder,
    label,
    autocomplete,
    required,
    maxLength
  });
}

// MARK: State Field
/**
 * Configuration for a US state input field.
 */
export interface StateFieldConfig extends Partial<TextFieldConfig> {
  /**
   * When true, validates and formats as a 2-letter state code (e.g., `'CA'`).
   */
  readonly asCode?: boolean;
}

/**
 * Creates a text field pre-configured for US state input with optional state code validation.
 *
 * When `asCode` is true, enforces the 2-letter state code pattern and auto-uppercases input.
 *
 * @param config - Optional overrides; defaults to key `'state'`, label `'State'`
 * @returns A {@link FormlyFieldConfig} for state input
 *
 * @example
 * ```typescript
 * const field = stateField({ asCode: true, required: true });
 * ```
 */
export function formlyStateField(config: StateFieldConfig = {}): FormlyFieldConfig {
  const { asCode = false, pattern = asCode ? US_STATE_CODE_STRING_REGEX : undefined, key = 'state', placeholder = '', label = 'State', autocomplete = 'state', maxLength = asCode ? ADDRESS_STATE_CODE_MAX_LENGTH : ADDRESS_STATE_MAX_LENGTH, transform, required = false } = config;
  return formlyTextField({
    ...config,
    key,
    placeholder,
    label,
    pattern,
    autocomplete,
    required,
    maxLength,
    transform: {
      ...transform,
      toUppercase: asCode || transform?.toUppercase
    }
  });
}

// MARK: Country Field
/**
 * Configuration for a country input field.
 */
export type CountryFieldConfig = Partial<TextFieldConfig>;

/**
 * Creates a text field pre-configured for country name input with autocomplete support.
 *
 * @param config - Optional overrides; defaults to key `'country'`, label `'Country'`
 * @returns A {@link FormlyFieldConfig} for country input
 *
 * @example
 * ```typescript
 * const field = countryField({ required: true });
 * ```
 */
export function formlyCountryField(config: CountryFieldConfig = {}): FormlyFieldConfig {
  const { key = 'country', placeholder = '', label = 'Country', autocomplete = 'country', maxLength = ADDRESS_COUNTRY_MAX_LENGTH, required = false } = config;
  return formlyTextField({
    ...config,
    key,
    placeholder,
    label,
    autocomplete,
    required,
    maxLength
  });
}

// MARK: Zip Code Field
/**
 * Configuration for a zip/postal code input field.
 */
export type ZipCodeFieldConfig = Partial<TextFieldConfig>;

/**
 * Creates a text field pre-configured for US zip code input with pattern validation.
 *
 * @param config - Optional overrides; defaults to key `'zip'`, label `'Zip Code'`
 * @returns A {@link FormlyFieldConfig} for zip code input
 *
 * @example
 * ```typescript
 * const field = zipCodeField({ required: true });
 * ```
 */
export function formlyZipCodeField(config: ZipCodeFieldConfig = {}): FormlyFieldConfig {
  const { key = 'zip', placeholder = '', label = 'Zip Code', autocomplete = 'postal-code', pattern = ZIP_CODE_STRING_REGEX, maxLength = ADDRESS_ZIP_MAX_LENGTH, required = false } = config;
  return formlyTextField({
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

// MARK: LatLng Text Field
/**
 * Default placeholder text for a latitude/longitude text field.
 */
export const DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER = '12.345,-67.8910';
/**
 * Default validation error message for invalid coordinate input.
 */
export const DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE = `Invalid/unknown coordinates`;

/**
 * Creates a text field pre-configured for latitude/longitude coordinate input with pattern validation.
 *
 * @param config - Optional overrides; defaults to key `'latLng'`
 * @param config.key - The form model key; defaults to `'latLng'`
 * @returns A {@link FormlyFieldConfig} for coordinate input
 *
 * @example
 * ```typescript
 * const field = latLngTextField();
 * ```
 */
export function formlyLatLngTextField({ key = 'latLng' }: Partial<TextFieldConfig> = {}): FormlyFieldConfig {
  return {
    ...formlyTextField({
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
}

// MARK: Deprecated Aliases
/** @deprecated Use formlyNameField instead. */
export const nameField = formlyNameField;
/** @deprecated Use formlyEmailField instead. */
export const emailField = formlyEmailField;
/** @deprecated Use formlyCityField instead. */
export const cityField = formlyCityField;
/** @deprecated Use formlyStateField instead. */
export const stateField = formlyStateField;
/** @deprecated Use formlyCountryField instead. */
export const countryField = formlyCountryField;
/** @deprecated Use formlyZipCodeField instead. */
export const zipCodeField = formlyZipCodeField;
/** @deprecated Use formlyLatLngTextField instead. */
export const latLngTextField = formlyLatLngTextField;
