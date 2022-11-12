import { FormlyFieldConfig } from '@ngx-formly/core';
import { textField, TextFieldConfig } from './text.field';
import { cityField, CityFieldConfig, countryField, CountryFieldConfig, stateField, StateFieldConfig, zipCodeField, ZipCodeFieldConfig } from './text.additional.field';
import { flexLayoutWrapper, sectionWrapper } from '../../wrapper/wrapper';
import { FieldConfig } from '../../field';
import { repeatArrayField } from '../array/array.field';
import { DbxFormSectionConfig } from '../../wrapper/section.wrapper.component';
import { ADDRESS_LINE_MAX_LENGTH } from '@dereekb/model';

export interface AddressFormlyFieldsConfig {
  line1Field?: CityFieldConfig;
  line2Field?: CityFieldConfig;
  cityField?: CityFieldConfig;
  stateField?: StateFieldConfig;
  zipCodeField?: ZipCodeFieldConfig;
  countryField?: CountryFieldConfig;
  /**
   * Whether or not to make required fields required.
   *
   * True by default.
   */
  requiredFields?: boolean;
  /**
   * Whether or not to include the second address line.
   *
   * True by default.
   */
  includeLine2?: boolean;
  /**
   * Whether or not to include the country.
   *
   * True by default.
   */
  includeCountry?: boolean;
}

export interface AddressLineFieldConfig extends Partial<TextFieldConfig> {
  line?: 0 | 1 | 2;
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
  const { requiredFields = true, includeLine2 = true, includeCountry = true } = config;

  const singleLineFields = [
    {
      field: cityField({ required: requiredFields, ...config.cityField })
    },
    {
      field: stateField({ required: requiredFields, ...config.stateField })
    },
    {
      field: zipCodeField({ required: requiredFields, ...config.zipCodeField })
    }
  ];

  if (includeCountry) {
    singleLineFields.push({
      field: countryField({ required: requiredFields, ...config.countryField })
    });
  }

  let lines: FormlyFieldConfig[];

  if (includeLine2) {
    lines = [addressLineField({ required: requiredFields, ...config.line1Field, line: 1 }), addressLineField({ ...config.line2Field, line: 2 })];
  } else {
    lines = [addressLineField({ required: requiredFields, ...config.line1Field, line: 0 })];
  }

  return [...lines, flexLayoutWrapper(singleLineFields, { size: 1, relative: true })];
}

export interface AddressFieldConfig extends FieldConfig, DbxFormSectionConfig, AddressFormlyFieldsConfig {}

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

export interface AddressListFieldConfig extends FieldConfig, AddressFormlyFieldsConfig {
  maxAddresses?: number;
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
