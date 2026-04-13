import type { FieldDef } from '@ng-forge/dynamic-forms';
import { ADDRESS_LINE_MAX_LENGTH } from '@dereekb/model';
import { forgeTextField, type DbxForgeTextFieldConfig } from './text.field';
import { forgeCityField, type DbxForgeCityFieldConfig, forgeCountryField, type DbxForgeCountryFieldConfig, forgeStateField, type DbxForgeStateFieldConfig, forgeZipCodeField, type DbxForgeZipCodeFieldConfig } from './text.additional.field';
import { forgeRow } from '../../wrapper/wrapper';
import { forgeDbxSectionFieldWrapper, type DbxForgeSectionFieldDef } from '../../wrapper/section/section.field';
import { forgeArrayField, type DbxForgeArrayFieldDef } from '../array/array.field';

// MARK: Address Config
/**
 * Configuration for a group of address-related form fields (lines, city, state, zip, country).
 */
export interface DbxForgeAddressFieldsConfig {
  readonly line1Field?: DbxForgeCityFieldConfig;
  readonly line2Field?: DbxForgeCityFieldConfig;
  readonly cityField?: DbxForgeCityFieldConfig;
  readonly stateField?: DbxForgeStateFieldConfig;
  readonly zipCodeField?: DbxForgeZipCodeFieldConfig;
  readonly countryField?: DbxForgeCountryFieldConfig;
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
export interface DbxForgeAddressLineFieldConfig extends Partial<DbxForgeTextFieldConfig> {
  /**
   * Address line number: 0 for single "Street" line, 1 for "Line 1", 2 for "Line 2".
   */
  readonly line?: 0 | 1 | 2;
}

/**
 * Creates a forge text field for a single address line.
 *
 * @param config - Optional overrides; line number determines key and label
 * @returns A {@link MatInputField} for address line input
 *
 * @example
 * ```typescript
 * const line1 = forgeAddressLineField({ line: 1, required: true });
 * const line2 = forgeAddressLineField({ line: 2 });
 * ```
 */
export function forgeAddressLineField(config: DbxForgeAddressLineFieldConfig = {}) {
  const { line = 1 } = config;
  const lineCode = Math.max(1, line); // minimum of line 1

  const { key = `line${lineCode}`, placeholder = '', label = line ? `Line ${line}` : 'Street', maxLength = ADDRESS_LINE_MAX_LENGTH, required = false } = config;

  return forgeTextField({
    ...config,
    key,
    placeholder,
    label,
    required,
    maxLength
  });
}

/**
 * Creates the full set of address form fields (lines, city, state, zip, and optionally country)
 * arranged in a flex row layout.
 *
 * @param config - Address fields configuration
 * @returns Array of forge field definitions for a complete address form section
 *
 * @example
 * ```typescript
 * const fields = forgeAddressFields({ required: true, includeCountry: false });
 * ```
 */
export function forgeAddressFields(config: DbxForgeAddressFieldsConfig = {}): FieldDef<unknown>[] {
  const { required = true, includeLine2 = true, includeCountry = true } = config;

  // City and country are full-width on their own rows since names can be long
  const cityField = forgeCityField({ required, ...config.cityField });

  // State and zip share a row
  const stateZipRow = forgeRow({
    fields: [
      { ...forgeStateField({ required, ...config.stateField }), col: 6 },
      { ...forgeZipCodeField({ required, ...config.zipCodeField }), col: 6 }
    ]
  });

  let lines: FieldDef<unknown>[];

  if (includeLine2) {
    lines = [forgeAddressLineField({ required, ...config.line1Field, line: 1 }), forgeAddressLineField({ ...config.line2Field, line: 2 })];
  } else {
    lines = [forgeAddressLineField({ required, ...config.line1Field, line: 0 })];
  }

  const fields: FieldDef<unknown>[] = [...lines, cityField, stateZipRow];

  if (includeCountry) {
    fields.push(forgeCountryField({ required, ...config.countryField }));
  }

  return fields;
}

// MARK: Address
/**
 * Configuration for a complete address section field wrapped in a forge section group.
 */
export interface DbxForgeAddressFieldConfig extends DbxForgeAddressFieldsConfig {
  readonly key?: string;
  /**
   * Optional section header text. Defaults to `'Address'`.
   */
  readonly header?: string;
  /**
   * Optional hint text displayed below the header.
   */
  readonly hint?: string;
}

/**
 * Creates a section-wrapped address field group containing all address sub-fields.
 *
 * @param config - Optional overrides; defaults to key `'address'`, header `'Address'`
 * @returns A {@link GroupField} containing address fields
 *
 * @example
 * ```typescript
 * const field = forgeAddressField({ required: true, includeCountry: true });
 * ```
 */
export function forgeAddressField(config: Partial<DbxForgeAddressFieldConfig> = {}): DbxForgeSectionFieldDef {
  const { key = 'address', header = 'Address', hint } = config;

  return forgeDbxSectionFieldWrapper({
    key,
    header,
    hint,
    fields: forgeAddressFields(config)
  });
}

// MARK: Address List
/**
 * Configuration for a repeatable list of address field groups.
 */
export interface DbxForgeAddressListFieldConfig extends DbxForgeAddressFieldsConfig {
  readonly key?: string;
  /**
   * Maximum number of addresses allowed. Defaults to 6.
   */
  readonly maxAddresses?: number;
}

/**
 * Creates a draggable repeat-array field that allows the user to add, remove,
 * and reorder multiple addresses.
 *
 * @param config - Optional overrides; defaults to key `'addresses'`, max 6 entries
 * @returns A {@link DbxForgeArrayFieldDef} for multiple addresses
 *
 * @example
 * ```typescript
 * const field = forgeAddressListField({ maxAddresses: 3, required: true });
 * ```
 */
export function forgeAddressListField(config: Partial<DbxForgeAddressListFieldConfig> = {}): DbxForgeArrayFieldDef {
  const { key = 'addresses', maxAddresses = 6 } = config;

  return forgeArrayField({
    key,
    labelForField: 'Address',
    template: forgeAddressFields(config),
    maxLength: maxAddresses,
    addText: 'Add Address',
    removeText: 'Remove Address'
  });
}
