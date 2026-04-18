import { LAT_LNG_PATTERN, US_STATE_CODE_STRING_REGEX, ZIP_CODE_STRING_REGEX } from '@dereekb/util';
import { ADDRESS_CITY_MAX_LENGTH, ADDRESS_STATE_CODE_MAX_LENGTH, ADDRESS_STATE_MAX_LENGTH, ADDRESS_COUNTRY_MAX_LENGTH, ADDRESS_ZIP_MAX_LENGTH } from '@dereekb/model';
import { type DbxForgeTextFieldConfig, dbxForgeTextField } from './text.field';
import type { FieldAutocompleteAttributeOption } from '../../../../field/field.autocomplete';

// MARK: Name Field
/**
 * Creates a forge text field pre-configured for a person's full name.
 *
 * @param config - Optional overrides; defaults to key `'name'`, label `'Name'`
 * @returns A {@link MatInputField} for name input
 *
 * @example
 * ```typescript
 * const field = forgeNameField({ required: true });
 * ```
 */
export function dbxForgeNameField(config: Partial<DbxForgeTextFieldConfig> = {}) {
  const { key = 'name', label = 'Name', placeholder = 'John Doe', required = false, minLength, maxLength } = config;

  return dbxForgeTextField({
    ...config,
    key,
    label,
    placeholder,
    required,
    minLength,
    maxLength
  });
}

// MARK: Email Field
/**
 * Configuration for a forge email address input field.
 */
export interface DbxForgeEmailFieldConfig {
  readonly key?: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Sets the autocomplete attribute on the input. Pass `false` to disable browser autofill.
   */
  readonly autocomplete?: FieldAutocompleteAttributeOption;
}

/**
 * Creates a forge text field pre-configured for email address input.
 *
 * Uses the `'email'` input type for built-in browser validation.
 *
 * @param config - Optional overrides; defaults to key `'email'`, label `'Email Address'`
 * @returns A {@link MatInputField} with email input type
 *
 * @example
 * ```typescript
 * const field = forgeEmailField({ required: true });
 * ```
 */
export function dbxForgeEmailField(config: DbxForgeEmailFieldConfig = {}) {
  const { key = 'email', label = 'Email Address', placeholder = 'you@example.com', required, readonly: isReadonly, description, autocomplete } = config;

  return dbxForgeTextField({
    key,
    label,
    placeholder,
    required,
    readonly: isReadonly,
    description,
    autocomplete,
    inputType: 'email'
  });
}

// MARK: City Field
/**
 * Configuration for a forge city input field.
 */
export type DbxForgeCityFieldConfig = Partial<DbxForgeTextFieldConfig>;

/**
 * Creates a forge text field pre-configured for city name input.
 *
 * @param config - Optional overrides; defaults to key `'city'`, label `'City'`
 * @returns A {@link MatInputField} for city input
 *
 * @example
 * ```typescript
 * const field = forgeCityField({ required: true });
 * ```
 */
export function dbxForgeCityField(config: DbxForgeCityFieldConfig = {}) {
  const { key = 'city', placeholder = '', label = 'City', maxLength = ADDRESS_CITY_MAX_LENGTH, required = false } = config;

  return dbxForgeTextField({
    ...config,
    key,
    placeholder,
    label,
    required,
    maxLength
  });
}

// MARK: State Field
/**
 * Configuration for a forge US state input field.
 */
export interface DbxForgeStateFieldConfig extends Partial<DbxForgeTextFieldConfig> {
  /**
   * When true, validates and formats as a 2-letter state code (e.g., `'CA'`).
   */
  readonly asCode?: boolean;
}

/**
 * Creates a forge text field pre-configured for US state input with optional state code validation.
 *
 * When `asCode` is true, enforces the 2-letter state code pattern and auto-uppercases input.
 *
 * @param config - Optional overrides; defaults to key `'state'`, label `'State'`
 * @returns A {@link MatInputField} for state input
 *
 * @example
 * ```typescript
 * const field = forgeStateField({ asCode: true, required: true });
 * ```
 */
export function dbxForgeStateField(config: DbxForgeStateFieldConfig = {}) {
  const { asCode = false, pattern = asCode ? US_STATE_CODE_STRING_REGEX : undefined, key = 'state', placeholder = '', label = 'State', maxLength = asCode ? ADDRESS_STATE_CODE_MAX_LENGTH : ADDRESS_STATE_MAX_LENGTH, idempotentTransform: transform, required = false } = config;

  return dbxForgeTextField({
    ...config,
    key,
    placeholder,
    label,
    pattern,
    required,
    maxLength,
    idempotentTransform: {
      ...transform,
      toUppercase: asCode || transform?.toUppercase
    }
  });
}

// MARK: Country Field
/**
 * Configuration for a forge country input field.
 */
export type DbxForgeCountryFieldConfig = Partial<DbxForgeTextFieldConfig>;

/**
 * Creates a forge text field pre-configured for country name input.
 *
 * @param config - Optional overrides; defaults to key `'country'`, label `'Country'`
 * @returns A {@link MatInputField} for country input
 *
 * @example
 * ```typescript
 * const field = forgeCountryField({ required: true });
 * ```
 */
export function dbxForgeCountryField(config: DbxForgeCountryFieldConfig = {}) {
  const { key = 'country', placeholder = '', label = 'Country', maxLength = ADDRESS_COUNTRY_MAX_LENGTH, required = false } = config;

  return dbxForgeTextField({
    ...config,
    key,
    placeholder,
    label,
    required,
    maxLength
  });
}

// MARK: Zip Code Field
/**
 * Configuration for a forge zip/postal code input field.
 */
export type DbxForgeZipCodeFieldConfig = Partial<DbxForgeTextFieldConfig>;

/**
 * Creates a forge text field pre-configured for US zip code input with pattern validation.
 *
 * @param config - Optional overrides; defaults to key `'zip'`, label `'Zip Code'`
 * @returns A {@link MatInputField} for zip code input
 *
 * @example
 * ```typescript
 * const field = forgeZipCodeField({ required: true });
 * ```
 */
export function dbxForgeZipCodeField(config: DbxForgeZipCodeFieldConfig = {}) {
  const { key = 'zip', placeholder = '', label = 'Zip Code', pattern = ZIP_CODE_STRING_REGEX, maxLength = ADDRESS_ZIP_MAX_LENGTH, required = false } = config;

  return dbxForgeTextField({
    ...config,
    key,
    placeholder,
    label,
    pattern,
    required,
    maxLength
  });
}

// MARK: LatLng Text Field
/**
 * Default placeholder text for a forge latitude/longitude text field.
 */
export const DEFAULT_FORGE_LAT_LNG_TEXT_FIELD_PLACEHOLDER = '12.345,-67.8910';

/**
 * Creates a forge text field pre-configured for latitude/longitude coordinate input with pattern validation.
 *
 * @param config - Optional overrides; defaults to key `'latLng'`
 * @returns A {@link MatInputField} for coordinate input
 *
 * @example
 * ```typescript
 * const field = forgeLatLngTextField();
 * ```
 */
export function dbxForgeLatLngTextField(config: Partial<DbxForgeTextFieldConfig> = {}) {
  const { key = 'latLng' } = config;

  return dbxForgeTextField({
    key,
    label: 'Coordinates',
    placeholder: DEFAULT_FORGE_LAT_LNG_TEXT_FIELD_PLACEHOLDER,
    pattern: LAT_LNG_PATTERN
  });
}

// MARK: Deprecated
/** @deprecated Use {@link dbxForgeNameField} instead. */
export const forgeNameField = dbxForgeNameField;
/** @deprecated Use {@link dbxForgeEmailField} instead. */
export const forgeEmailField = dbxForgeEmailField;
/** @deprecated Use {@link dbxForgeCityField} instead. */
export const forgeCityField = dbxForgeCityField;
/** @deprecated Use {@link dbxForgeStateField} instead. */
export const forgeStateField = dbxForgeStateField;
/** @deprecated Use {@link dbxForgeCountryField} instead. */
export const forgeCountryField = dbxForgeCountryField;
/** @deprecated Use {@link dbxForgeZipCodeField} instead. */
export const forgeZipCodeField = dbxForgeZipCodeField;
/** @deprecated Use {@link dbxForgeLatLngTextField} instead. */
export const forgeLatLngTextField = dbxForgeLatLngTextField;
