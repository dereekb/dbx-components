import { FormlyFieldConfig } from '@ngx-formly/core';
import { textField } from './text';

export function companyFields(): FormlyFieldConfig[] {
  return [
    textField({
      key: 'company',
      label: 'Company',
      placeholder: '',
      required: false,
    }),
    textField({
      key: 'job',
      label: 'Job Title',
      placeholder: '',
      required: false,
    })
  ];
}

export function companyField({ key = 'company', required = false }): FormlyFieldConfig {
  return {
    key,
    wrappers: ['section'],
    templateOptions: {
      label: 'Company',
      placeholder: '',
      required
    },
    fieldGroup: companyFields()
  };
}
