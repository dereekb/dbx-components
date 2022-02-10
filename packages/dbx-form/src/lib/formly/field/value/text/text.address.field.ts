import { FormlyFieldConfig } from '@ngx-formly/core';
import { textField } from './text.field';
import { cityField, countryField, stateField, zipCodeField } from './text.additional.field';
import { flexLayoutWrapper } from '../../wrapper/wrapper';
import { FieldConfig } from '../../field';
import { repeatArrayField } from '..';

export const ADDRESS_LINE_MAX_LENGTH = 100;

export function addressFormlyFields(): FormlyFieldConfig[] {
  return [
    textField({
      key: 'line1',
      label: 'Line 1',
      placeholder: '',
      required: false,
      autocomplete: 'address-line1',
      maxLength: ADDRESS_LINE_MAX_LENGTH
    }),
    textField({
      key: 'line2',
      label: 'Line 2',
      placeholder: '',
      required: false,
      autocomplete: 'address-line2',
      maxLength: ADDRESS_LINE_MAX_LENGTH
    }),
    flexLayoutWrapper([{
      field: cityField({})
    }, {
      field: stateField({})
    }, {
      field: zipCodeField({})
    }, {
      field: countryField({})
    }], { size: 1, relative: true })
  ];
}

export interface AddressFieldConfig extends FieldConfig { }

export function addressField({ key = 'address', required = false }: Partial<AddressFieldConfig> = {}): FormlyFieldConfig {
  return {
    key,
    wrappers: ['section'],
    templateOptions: {
      label: 'Address',
      placeholder: '',
      required
    },
    fieldGroup: addressFormlyFields()
  };
}

export interface AddressListFieldConfig extends FieldConfig {
  maxAddresses?: number;
}

export function addressListField({ key = 'addresses', required = false, maxAddresses = 6 }: Partial<AddressListFieldConfig> = {}): FormlyFieldConfig {
  return repeatArrayField({
    key,
    label: 'Addresses',
    labelForField: 'Address',
    addText: 'Add Address',
    removeText: 'Remove Address',
    maxLength: maxAddresses,
    repeatFieldGroup: addressFormlyFields()
  });
}
