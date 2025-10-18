import { type DescriptionFieldConfig, type MaterialFormFieldConfig, type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig } from './../field';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type TextFieldLengthConfig } from '../value/text/text.field';

export interface TextEditorFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, TextFieldLengthConfig, MaterialFormFieldConfig {}

export function textEditorField(config: TextEditorFieldConfig): FormlyFieldConfig {
  const { key, minLength, maxLength, materialFormField } = config;
  const fieldConfig: FormlyFieldConfig = formlyField({
    key,
    type: 'texteditor',
    defaultValue: '', // Set to always get a string as a result.
    modelOptions: {
      // https://formly.dev/examples/validation/async-validation-update-on
      // Set to trigger value update on blurs with the form. However, the value is set internally too.
      updateOn: 'blur'
    },
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      minLength,
      maxLength
    })
  });

  return fieldConfig;
}
