import { textField, TextFieldConfig } from '../text/text.field';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField } from '../../field';
import { flexLayoutWrapper } from '../../wrapper/wrapper';
import { DbxInternationalPhoneFieldConfig, InternationalPhoneFormlyFieldConfig } from './phone.field.component';

export interface InternationalPhoneFieldConfig extends LabeledFieldConfig, DbxInternationalPhoneFieldConfig { }

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
  phoneField?: InternationalPhoneFieldConfig;
  labelField?: TextFieldConfig;
}

export function phoneAndLabelFields({ phoneField: phone, labelField: label }: PhoneFormlyFieldsConfig): FormlyFieldConfig[] {
  return [
    flexLayoutWrapper([
      {
        field: internationalPhoneField({ key: 'phone', ...phone })
      },
      {
        field: textField({
          key: 'label',
          label: 'Label',
          autocomplete: 'phone-label',
          ...label
        })
      }
    ])
  ];
}

export interface PhoneAndLabelFieldGroupConfig extends PhoneFormlyFieldsConfig {
  key?: string;
  label?: string;
  required?: boolean;
}

export function phoneAndLabelFieldGroup({ key = 'phone', label = 'Phone Number', required, phoneField, labelField }: PhoneAndLabelFieldGroupConfig): FormlyFieldConfig {
  return {
    key,
    wrappers: ['section'],
    templateOptions: {
      label,
      required
    },
    fieldGroup: phoneAndLabelFields({ phoneField, labelField })
  };
}

export interface PhoneListFieldConfig extends PhoneAndLabelFieldGroupConfig {
  maxPhones?: number;
  repeatSection?: {
    addText: string
    removeText: string
  }
}

export function phoneListField({ key = 'phones', label = 'Phone Numbers', repeatSection, required = false, maxPhones = 6, phoneField, labelField }: PhoneListFieldConfig): FormlyFieldConfig {
  return {
    key,
    type: 'repeat',
    wrappers: ['section'],
    templateOptions: {
      label,
      required,
      repeatSection: repeatSection ?? {
        addText: 'Add Phone Number',
        removeText: 'Remove Phone Number'
      },
      maxLength: maxPhones
    },
    fieldArray: {
      fieldGroup: phoneAndLabelFields({ phoneField, labelField })
    }
  };
}
