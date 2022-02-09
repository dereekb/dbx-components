import { FormlyFieldConfig } from '@ngx-formly/core/lib/core';
import { FieldConfig, formlyField } from '../field';

export interface HiddenFieldConfig extends Pick<FieldConfig, 'key' | 'required'> { }

export function hiddenField({ key, required = false }: HiddenFieldConfig): FormlyFieldConfig {
  return formlyField({
    key,
    templateOptions: { required }
  });
}
