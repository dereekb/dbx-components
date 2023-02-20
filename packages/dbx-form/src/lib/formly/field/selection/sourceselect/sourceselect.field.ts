import { PrimativeKey } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, DescriptionFieldConfig, MaterialFormFieldConfig } from '../../field';
import { SourceSelectFieldProps } from './sourceselect.field.component';

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
