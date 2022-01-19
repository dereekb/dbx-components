import { FormlyFieldConfig } from '@ngx-formly/core';
import { FieldConfig, FieldConfigWithDescription, formlyField } from '../field';
import { EnumValueFieldOption } from './enum';

export interface StaticEnumFieldConfig<T> extends FieldConfigWithDescription {
  /**
   * Whether or not multiple values can be selected.
   */
  multiple?: boolean;
  /**
   * Options
   */
  options: EnumValueFieldOption<T>[];
}

export function staticEnumField<T = any>({
  key, label = '', placeholder = '',
  description,
  multiple = false,
  required = false,
  options
}: StaticEnumFieldConfig<T>): FormlyFieldConfig {
  const fieldConfig: FormlyFieldConfig = formlyField({
    key,
    type: 'select',
    templateOptions: {
      label,
      description,
      placeholder,
      required,
      multiple,
      selectAllOption: 'Select All',
      options
    },
  });

  return fieldConfig;
}
