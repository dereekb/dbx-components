import type { GroupField } from '@ng-forge/dynamic-forms';
import { ADDRESS_LINE_MAX_LENGTH } from '@dereekb/model';
import { dbxForgeTextField, type DbxForgeTextFieldConfig } from './text.field';
import { dbxForgeCityField, type DbxForgeCityFieldConfig, dbxForgeCountryField, type DbxForgeCountryFieldConfig, dbxForgeStateField, type DbxForgeStateFieldConfig, dbxForgeZipCodeField, type DbxForgeZipCodeFieldConfig } from './text.additional.field';
import { dbxForgeGroup, dbxForgeRow } from '../../wrapper/wrapper';
import { dbxForgeArrayField } from '../array/array.field';
import { type MatInputField } from '@ng-forge/dynamic-forms-material';
import { type DbxForgeField } from '../../../form/forge.form';

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
 * const line1 = dbxForgeAddressLineField({ line: 1, required: true });
 * const line2 = dbxForgeAddressLineField({ line: 2 });
 * ```
 */
export function dbxForgeAddressLineField(config: DbxForgeAddressLineFieldConfig = {}) {
  const { line = 1 } = config;
  const lineCode = Math.max(1, line); // minimum of line 1

  const { key = `line${lineCode}`, placeholder = '', label = line ? `Line ${line}` : 'Street', maxLength = ADDRESS_LINE_MAX_LENGTH, required = false } = config;

  return dbxForgeTextField({
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
 * const fields = dbxForgeAddressFields({ required: true, includeCountry: false });
 * ```
 */
export function dbxForgeAddressFields(config: DbxForgeAddressFieldsConfig = {}) {
  const { required = true, includeLine2 = true, includeCountry = true } = config;

  // City and country are full-width on their own rows since names can be long
  const cityField = dbxForgeCityField({ required, ...config.cityField });

  // State and zip share a row
  const stateZipRow = dbxForgeRow({
    fields: [
      { ...dbxForgeStateField({ required, ...config.stateField }), col: 6 },
      { ...dbxForgeZipCodeField({ required, ...config.zipCodeField }), col: 6 }
    ]
  });

  let lines: DbxForgeField<MatInputField>[];

  if (includeLine2) {
    lines = [dbxForgeAddressLineField({ required, ...config.line1Field, line: 1 }), dbxForgeAddressLineField({ ...config.line2Field, line: 2 })];
  } else {
    lines = [dbxForgeAddressLineField({ required, ...config.line1Field, line: 0 })];
  }

  const fields = [...lines, cityField, stateZipRow];

  if (includeCountry) {
    fields.push(dbxForgeCountryField({ required, ...config.countryField }));
  }

  return fields;
}

// MARK: Address
/**
 * Configuration for a complete address group composite.
 */
export interface DbxForgeAddressGroupConfig extends DbxForgeAddressFieldsConfig {
  readonly key?: string;
}

/**
 * Composite builder that wraps the full set of address sub-fields in a group.
 *
 * @param config - Optional overrides; defaults to key `'address'`
 * @returns A {@link GroupField} containing address fields
 *
 * @example
 * ```typescript
 * const group = dbxForgeAddressGroup({ required: true, includeCountry: true });
 * ```
 */
export function dbxForgeAddressGroup(config: Partial<DbxForgeAddressGroupConfig> = {}): GroupField {
  const { key = 'address' } = config;

  return dbxForgeGroup({
    key,
    fields: dbxForgeAddressFields(config)
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
 * const field = dbxForgeAddressListField({ maxAddresses: 3, required: true });
 * ```
 */
export function dbxForgeAddressListField(config: Partial<DbxForgeAddressListFieldConfig> = {}) {
  const { key = 'addresses', maxAddresses = 6 } = config;

  return dbxForgeArrayField({
    key,
    // labelForField: 'Address',
    props: {
      addText: 'Add Address',
      removeText: 'Remove Address'
    },
    template: dbxForgeAddressFields(config),
    maxLength: maxAddresses
  });
}
