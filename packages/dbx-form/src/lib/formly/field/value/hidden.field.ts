import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField } from '../field';

export type HiddenFieldConfig = Pick<LabeledFieldConfig, 'key' | 'required'>;

export function hiddenField({ key, required = false }: HiddenFieldConfig): FormlyFieldConfig {
  return formlyField({
    key,
    props: { required }
  });
}
