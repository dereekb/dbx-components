import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FieldValueIsAvailableValidatorConfig, fieldValueIsAvailableValidator } from '../../validator/available';
import { textField, type TextFieldConfig } from '../field/value/text/text.field';
import { workingWrapper } from '../field/wrapper/wrapper';

export interface TextAvailableFieldConfig extends TextFieldConfig, Omit<FieldValueIsAvailableValidatorConfig<string>, 'message'> {
  readonly isNotAvailableErrorMessage?: string;
}

export function textIsAvailableField(config: TextAvailableFieldConfig): FormlyFieldConfig {
  const field = textField(config);

  field.asyncValidators = {
    validation: [
      {
        expression: fieldValueIsAvailableValidator({
          ...config,
          message: config?.isNotAvailableErrorMessage
        })
      }
    ]
  };

  return workingWrapper(field, {});
}
