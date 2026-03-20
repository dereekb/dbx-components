import { type FormlyFieldConfig } from '@ngx-formly/core';
import { textField, type TextFieldConfig } from './text.field';
import { cityField, type CityFieldConfig, countryField, type CountryFieldConfig, stateField, type StateFieldConfig, zipCodeField, type ZipCodeFieldConfig } from './text.additional.field';
import { flexLayoutWrapper, sectionWrapper } from '../../wrapper/wrapper';
import { type FieldConfig } from '../../field';
import { repeatArrayField } from '../array/array.field';
import { type DbxFormSectionConfig } from '../../wrapper/section.wrapper.component';
import { ADDRESS_LINE_MAX_LENGTH } from '@dereekb/model';

// MARK: Address Config
/**
 * Configuration for a group of address-related form fields (lines, city, state, zip, country).
 */
export interface AddressFormlyFieldsConfig {
  readonly line1Field?: CityFieldConfig;
  readonly line2Field?: CityFieldConfig;
  readonly cityField?: CityFieldConfig;
  readonly stateField?: StateFieldConfig;
  readonly zipCodeField?: ZipCodeFieldConfig;
  readonly countryField?: CountryFieldConfig;
  /**
   * Whether or not to make required fields required.
   *
   * True by default.
   */
  readonly required?: boolean;
  /**
   * Whether or not to include the second address line.
   *
   * True by default.
   */
  readonly includeLine2?: boolean;
  /**
   * Whether or not to include the country.
   *
   * True by default.
   */
  readonly includeCountry?: boolean;
}

/**
 * Configuration for a single address line field.
 */
export interface AddressLineFieldConfig extends Partial<TextFieldConfig> {
  /**
   * Address line number: 0 for single "Street" line, 1 for "Line 1", 2 for "Line 2".
   */
  readonly line?: 0 | 1 | 2;
}

/**
 * Creates a text field for a single address line with autocomplete support.
 *
 * @param config - Optional overrides; line number determines key and label
 * @returns A {@link FormlyFieldConfig} for address line input
 *
 * @example
 * ```typescript
 * const line1 = addressLineField({ line: 1, required: true });
 * const line2 = addressLineField({ line: 2 });
 * ```
 */
export function addressLineField(config: AddressLineFieldConfig = {}): FormlyFieldConfig {
  const { line = 1 } = config;
  const lineCode = Math.max(1, line); // minimum of line 1

  const { key = `line${lineCode}`, placeholder = '', label = line ? `Line ${line}` : 'Street', autocomplete = `address-line${lineCode}`, maxLength = ADDRESS_LINE_MAX_LENGTH, required = false } = config;
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

/**
 * Creates the full set of address form fields (lines, city, state, zip, and optionally country)
 * arranged in a flex layout.
 *
 * @param config - Address fields configuration
 * @returns Array of {@link FormlyFieldConfig} for a complete address form section
 *
 * @example
 * ```typescript
 * const fields = addressFormlyFields({ required: true, includeCountry: false });
 * ```
 */
export function addressFormlyFields(config: AddressFormlyFieldsConfig = {}): FormlyFieldConfig[] {
  const { required = true, includeLine2 = true, includeCountry = true } = config;

  const singleLineFields = [
    {
      field: cityField({ required, ...config.cityField })
    },
    {
      field: stateField({ required, ...config.stateField })
    },
    {
      field: zipCodeField({ required, ...config.zipCodeField })
    }
  ];

  if (includeCountry) {
    singleLineFields.push({
      field: countryField({ required, ...config.countryField })
    });
  }

  let lines: FormlyFieldConfig[];

  if (includeLine2) {
    lines = [addressLineField({ required, ...config.line1Field, line: 1 }), addressLineField({ ...config.line2Field, line: 2 })];
  } else {
    lines = [addressLineField({ required, ...config.line1Field, line: 0 })];
  }

  return [...lines, flexLayoutWrapper(singleLineFields, { size: 1, relative: true })];
}

// MARK: Address
/**
 * Configuration for a complete address section field wrapped in a form section.
 */
export interface AddressFieldConfig extends Readonly<FieldConfig>, DbxFormSectionConfig, AddressFormlyFieldsConfig {}

/**
 * Creates a section-wrapped address field group containing all address sub-fields.
 *
 * @param config - Optional overrides; defaults to key `'address'`, header `'Address'`
 * @returns A section-wrapped {@link FormlyFieldConfig} containing address fields
 *
 * @example
 * ```typescript
 * const field = addressField({ required: true, includeCountry: true });
 * ```
 */
export function addressField(config: Partial<AddressFieldConfig> = {}): FormlyFieldConfig {
  const { key = 'address', header = 'Address', hint, required = false } = config;

  return sectionWrapper(
    {
      ...config,
      key,
      fieldGroup: addressFormlyFields(config),
      required
    },
    {
      ...config,
      header,
      hint
    }
  );
}

// MARK: Address List
/**
 * Configuration for a repeatable list of address field groups.
 */
export interface AddressListFieldConfig extends Readonly<FieldConfig>, AddressFormlyFieldsConfig {
  /**
   * Maximum number of addresses allowed. Defaults to 6.
   */
  readonly maxAddresses?: number;
}

/**
 * Creates a repeat-array field that allows the user to add multiple addresses.
 *
 * @param config - Optional overrides; defaults to key `'addresses'`, max 6 entries
 * @returns A {@link FormlyFieldConfig} with repeat-array type for multiple addresses
 *
 * @example
 * ```typescript
 * const field = addressListField({ maxAddresses: 3, required: true });
 * ```
 */
export function addressListField(config: Partial<AddressListFieldConfig> = {}): FormlyFieldConfig {
  const { key = 'addresses', required = false, maxAddresses = 6 } = config;
  return repeatArrayField({
    key,
    required,
    label: 'Addresses',
    labelForField: 'Address',
    addText: 'Add Address',
    removeText: 'Remove Address',
    maxLength: maxAddresses,
    repeatFieldGroup: addressFormlyFields(config)
  });
}
