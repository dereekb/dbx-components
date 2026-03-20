import { type Maybe } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type MaterialFormFieldConfig, textField } from '../field';

export interface DbxFormSearchFormFieldsValue {
  readonly search: string;
}

export interface DbxFormSearchFormFieldsConfig extends MaterialFormFieldConfig {
  readonly label?: string;
  readonly placeholder?: string;
}

/**
 * Creates a Formly field array for a simple search form with a single text input.
 *
 * @param config - Optional search field configuration with label and placeholder
 * @returns An array of Formly field configs for the search form
 */
export function dbxFormSearchFormFields(config: Maybe<DbxFormSearchFormFieldsConfig>): FormlyFieldConfig[] {
  const { label, placeholder = 'Search', materialFormField } = config || {};

  return [
    textField({
      key: 'search',
      label,
      placeholder,
      autocomplete: false,
      materialFormField: {
        ...materialFormField,
        hideLabel: !label
      }
    })
  ];
}
