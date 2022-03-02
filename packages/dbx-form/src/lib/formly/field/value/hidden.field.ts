import { FormlyFieldConfig } from '@ngx-formly/core/lib/core';
import { LabeledFieldConfig, formlyField } from '../field';

export interface HiddenFieldConfig extends Pick<LabeledFieldConfig, 'key' | 'required'> { }

export function hiddenField({ key, required = false }: HiddenFieldConfig): FormlyFieldConfig {
  return formlyField({
    key,
    templateOptions: { required }
  });
}
