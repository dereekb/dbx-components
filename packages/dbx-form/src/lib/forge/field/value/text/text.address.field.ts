import type { FieldDef, GroupField } from '@ng-forge/dynamic-forms';
import { ADDRESS_LINE_MAX_LENGTH } from '@dereekb/model';
import { dbxForgeTextField, type DbxForgeTextFieldConfig } from './text.field';
import { dbxForgeCityField, type DbxForgeCityFieldConfig, dbxForgeCountryField, type DbxForgeCountryFieldConfig, dbxForgeStateField, type DbxForgeStateFieldConfig, dbxForgeZipCodeField, type DbxForgeZipCodeFieldConfig } from './text.additional.field';
import { dbxForgeGroup } from '../../wrapper/wrapper';
import { dbxForgeFlexLayout } from '../../wrapper/flex/flex.wrapper';
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
 * Street address line input. The `line` prop controls which line (1 or 2) — it affects key and label generation.
 *
 * @param config - Optional overrides; line number determines key and label
 * @returns A {@link MatInputField} for address line input
 *
 * @dbxFormField
 * @dbxFormSlug address-line
 * @dbxFormProduces string
 * @dbxFormArrayOutput no
 * @dbxFormFieldDerivative text
 * @dbxFormConfigInterface DbxForgeAddressLineFieldConfig
 * @example
 * ```typescript
 * dbxForgeAddressLineField({ line: 2 })
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
 * Flat array of address fields (line(s), city, state, zip, optional country) with a sensible flex layout. Drop directly into a parent `fields: []`.
 *
 * @param config - Address fields configuration
 * @returns Array of forge field definitions for a complete address form section
 *
 * @dbxFormField
 * @dbxFormSlug address-fields
 * @dbxFormProduces FieldDef[]
 * @dbxFormArrayOutput no
 * @dbxFormFieldTemplate address-line, city, state, zip-code, country
 * @dbxFormConfigInterface DbxForgeAddressFieldsConfig
 * @example
 * ```typescript
 * dbxForgeAddressFields({ required: true, includeCountry: false })
 * ```
 */
export function dbxForgeAddressFields(config: DbxForgeAddressFieldsConfig = {}) {
  const { required = true, includeLine2 = true, includeCountry = true } = config;

  // City, state, zip, and country share a single relative-sized flex row to match formly parity.
  const singleLineFields: FieldDef<unknown>[] = [dbxForgeCityField({ required, ...config.cityField }) as unknown as FieldDef<unknown>, dbxForgeStateField({ required, ...config.stateField }) as unknown as FieldDef<unknown>, dbxForgeZipCodeField({ required, ...config.zipCodeField }) as unknown as FieldDef<unknown>];

  if (includeCountry) {
    singleLineFields.push(dbxForgeCountryField({ required, ...config.countryField }) as unknown as FieldDef<unknown>);
  }

  const singleLineRow = dbxForgeFlexLayout({ size: 1, relative: true, fields: singleLineFields });

  let lines: DbxForgeField<MatInputField>[];

  if (includeLine2) {
    lines = [dbxForgeAddressLineField({ required, ...config.line1Field, line: 1 }), dbxForgeAddressLineField({ ...config.line2Field, line: 2 })];
  } else {
    lines = [dbxForgeAddressLineField({ required, ...config.line1Field, line: 0 })];
  }

  // TODO: tighten the array element type once a future/updated version of ng-forge exports `RowWrapper` so the inferred ContainerField return type can be named.
  const fields: any[] = [...lines, singleLineRow];

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
 * Wraps `address-fields` in a `GroupField` so the address is stored as a nested object under one key. Prefer this when the rest of the form doesn't want address fields flattened.
 *
 * @param config - Optional overrides; defaults to key `'address'`
 * @returns A {@link GroupField} containing address fields
 *
 * @dbxFormField
 * @dbxFormSlug address-group
 * @dbxFormTier composite-builder
 * @dbxFormSuffix Group
 * @dbxFormProduces GroupField
 * @dbxFormArrayOutput no
 * @dbxFormConfigInterface DbxForgeAddressGroupConfig
 * @dbxFormComposesFrom address-fields, group
 * @example
 * ```typescript
 * dbxForgeAddressGroup({ key: 'billingAddress' })
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
 * Repeatable array of addresses built on top of `array-field` + `address-group`. Keeps the `Field` suffix because it returns a single composite field whose value is an array of addresses.
 *
 * @param config - Optional overrides; defaults to key `'addresses'`, max 6 entries
 * @returns A {@link DbxForgeArrayFieldDef} for multiple addresses
 *
 * @dbxFormField
 * @dbxFormSlug address-list
 * @dbxFormTier composite-builder
 * @dbxFormSuffix Field
 * @dbxFormProduces ArrayField
 * @dbxFormArrayOutput yes
 * @dbxFormConfigInterface DbxForgeAddressListFieldConfig
 * @dbxFormComposesFrom address-group, array-field
 * @example
 * ```typescript
 * dbxForgeAddressListField({ maxAddresses: 3 })
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
