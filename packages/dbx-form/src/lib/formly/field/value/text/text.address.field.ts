import { type FormlyFieldConfig } from '@ngx-formly/core';
import { textField, type TextFieldConfig } from './text.field';
import { cityField, type CityFieldConfig, countryField, type CountryFieldConfig, stateField, type StateFieldConfig, zipCodeField, type ZipCodeFieldConfig } from './text.additional.field';
import { flexLayoutWrapper, sectionWrapper } from '../../wrapper/wrapper';
import { type FieldConfig } from '../../field';
import { repeatArrayField } from '../array/array.field';
import { type DbxFormSectionConfig } from '../../wrapper/section.wrapper.component';
import { ADDRESS_LINE_MAX_LENGTH } from '@dereekb/model';

// MARK: Address Config
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

export interface AddressLineFieldConfig extends Partial<TextFieldConfig> {
  readonly line?: 0 | 1 | 2;
}

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
export interface AddressFieldConfig extends Readonly<FieldConfig>, DbxFormSectionConfig, AddressFormlyFieldsConfig {}

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
export interface AddressListFieldConfig extends Readonly<FieldConfig>, AddressFormlyFieldsConfig {
  readonly maxAddresses?: number;
}

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
