import { Maybe } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { MaterialFormFieldConfig, textField } from '../field';

export interface DbxFormSearchFormFieldsValue {
  search: string;
}

export interface DbxFormSearchFormFieldsConfig extends MaterialFormFieldConfig {
  label?: string;
  placeholder?: string;
}

export function dbxFormSearchFormFields(config: Maybe<DbxFormSearchFormFieldsConfig>): FormlyFieldConfig[] {
  const { label = ' ', placeholder = 'Search', materialFormField } = config || {};

  return [
    textField({
      key: 'search',
      label,
      placeholder,
      autocomplete: false,
      materialFormField
    })
  ];
}
