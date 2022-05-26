import { DescriptionFieldConfig } from './../field';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField, templateOptionsForFieldConfig } from '../field';
import { TextFieldLengthConfig } from '../value/text/text.field';

export interface TextEditorFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, TextFieldLengthConfig {}

export function textEditorField(config: TextEditorFieldConfig): FormlyFieldConfig {
  const { key, minLength, maxLength } = config;
  const fieldConfig: FormlyFieldConfig = formlyField({
    key,
    type: 'texteditor',
    defaultValue: '', // Set to always get a string as a result.
    modelOptions: {
      // https://formly.dev/examples/validation/async-validation-update-on
      // Set to trigger value update on blurs with the form. However, the value is set internally too.
      updateOn: 'blur'
    },
    ...templateOptionsForFieldConfig(config, {
      minLength,
      maxLength
    })
  });

  return fieldConfig;
}
