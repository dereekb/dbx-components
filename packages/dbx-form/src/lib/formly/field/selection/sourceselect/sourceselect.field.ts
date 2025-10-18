import { type PrimativeKey } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, type DescriptionFieldConfig, type MaterialFormFieldConfig } from '../../field';
import { type SourceSelectFieldProps } from './sourceselect.field.component';

// MARK: Text
export interface SourceSelectFieldConfig<T extends PrimativeKey = PrimativeKey, M = unknown> extends LabeledFieldConfig, DescriptionFieldConfig, MaterialFormFieldConfig, SourceSelectFieldProps<T, M> {}

export function sourceSelectField<T extends PrimativeKey = PrimativeKey, M = unknown>(config: SourceSelectFieldConfig<T, M>): FormlyFieldConfig {
  const { key, materialFormField } = config;
  return formlyField({
    key,
    type: 'sourceselectfield',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      ...config,
      autocomplete: false
    })
  });
}
