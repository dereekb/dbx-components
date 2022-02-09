import { FormlyFieldConfig } from '@ngx-formly/core';
import { cityField, countryField, stateField, textField, zipCodeField } from './text.field';
import { flexLayoutWrapper } from '../../wrapper/flex.wrapper.layout';

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
    }])
  ];
}

export function addressField({ key = 'address', required = false }): FormlyFieldConfig {
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

export function addressListField({ key = 'addresses', required = false, maxAddresses = 6 }): FormlyFieldConfig {
  return {
    key,
    type: 'repeat',
    wrappers: ['section'],
    templateOptions: {
      label: 'Addresses',
      placeholder: '',
      required,
      repeatSection: {
        addText: 'Add Address',
        removeText: 'Remove Address'
      },
      maxLength: maxAddresses
    },
    fieldArray: {
      fieldGroup: addressFormlyFields()
    }
  };
}
