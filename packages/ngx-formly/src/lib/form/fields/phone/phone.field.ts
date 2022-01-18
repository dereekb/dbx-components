import { FormlyFieldConfig } from '@ngx-formly/core';
import { FieldConfig, formlyField } from '../field';
import { textField } from '../text';
import { flexLayoutWrapper } from '../wrappers/flex.wrapper.layout';
import { DbNgxInternationalPhoneFieldConfig, InternationalPhoneFormlyFieldConfig } from './phone.field.component';

export interface InternationalPhoneFieldConfig extends FieldConfig, DbNgxInternationalPhoneFieldConfig { }

export function internationalPhoneField({
  key, label = '', placeholder = '',
  required = false
}: Partial<InternationalPhoneFieldConfig>): InternationalPhoneFormlyFieldConfig {
  const fieldConfig: FormlyFieldConfig = formlyField({
    key,
    type: 'intphone',
    templateOptions: {
      label,
      placeholder,
      required
    }
  });

  // TODO: Add configuration...

  return fieldConfig;
}

export interface PhoneFormlyFieldsConfig {
  phoneLabelMaxLength: number;
}

export function phoneFormlyAndLabelFields({ phoneLabelMaxLength }: PhoneFormlyFieldsConfig): FormlyFieldConfig[] {
  return [
    flexLayoutWrapper([
      {
        field: internationalPhoneField({ key: 'phone' })
      },
      {
        field: textField({
          key: 'label',
          label: 'Label',
          placeholder: '',
          required: false,
          attributes: {
            autocomplete: 'phone-label',
          },
          maxLength: phoneLabelMaxLength
        })
      }
    ])
  ];
}

export function phoneAndLabelField({ key = 'phone', required = false, phoneLabelMaxLength = undefined as number }): FormlyFieldConfig {
  return {
    key,
    wrappers: ['section'],
    templateOptions: {
      label: 'Phone Number',
      placeholder: '',
      required
    },
    fieldGroup: phoneFormlyAndLabelFields({ phoneLabelMaxLength })
  };
}

export function phoneListField({ key = 'phones', required = false, maxPhones = 6, phoneLabelMaxLength = undefined as number }): FormlyFieldConfig {
  return {
    key,
    type: 'repeat',
    wrappers: ['section'],
    templateOptions: {
      label: 'Phone Numbers',
      placeholder: '',
      required,
      repeatSection: {
        addText: 'Add Phone Number',
        removeText: 'Remove Phone Number'
      },
      maxLength: maxPhones
    },
    fieldArray: {
      fieldGroup: phoneFormlyAndLabelFields({ phoneLabelMaxLength })
    }
  };
}
