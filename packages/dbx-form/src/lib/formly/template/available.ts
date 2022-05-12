import { FormlyFieldConfig } from '@ngx-formly/core/lib/core';
import { FieldValueIsAvailableValidatorConfig, fieldValueIsAvailableValidator } from '../../validator/available';
import { textField, TextFieldConfig } from '../field/value/text/text.field';

export interface TextAvailableFieldConfig extends TextFieldConfig, Omit<FieldValueIsAvailableValidatorConfig<string>, 'message'> {
  isNotAvailableErrorMessage?: string;
}

export function textIsAvailableField(config: TextAvailableFieldConfig): FormlyFieldConfig {
  const field = textField(config);

  field.asyncValidators = {
    validation: [{
      expression: fieldValueIsAvailableValidator({
        ...config,
        message: config?.isNotAvailableErrorMessage
      }),
    }]
  };

  return field;
}
