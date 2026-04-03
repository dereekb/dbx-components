import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FieldValueIsAvailableValidatorConfig, fieldValueIsAvailableValidator } from '../../validator/available';
import { textField, type TextFieldConfig } from '../field/value/text/text.field';
import { workingWrapper } from '../field/wrapper/wrapper';

/**
 * Configuration for a text field that includes an async availability check.
 *
 * Extends {@link TextFieldConfig} with availability validation options, allowing consumers
 * to verify that a text value (e.g., a username) is available before submission.
 */
export interface TextAvailableFieldConfig extends TextFieldConfig, Omit<FieldValueIsAvailableValidatorConfig<string>, 'message'> {
  /**
   * Custom error message displayed when the value is not available.
   */
  readonly isNotAvailableErrorMessage?: string;
}

/**
 * Creates a text field with an async validator that checks whether the entered value is available.
 *
 * The field is wrapped in a working wrapper to display a loading indicator during the async check.
 *
 * @param config - Configuration for the text field and availability validation.
 * @returns A Formly field configuration with async availability validation.
 *
 * @example
 * ```ts
 * const usernameField = textIsAvailableField({
 *   key: 'username',
 *   label: 'Username',
 *   isAvailable: (value) => checkUsernameAvailable(value),
 *   isNotAvailableErrorMessage: 'Username is already taken'
 * });
 * ```
 */
export function formlyTextIsAvailableField(config: TextAvailableFieldConfig): FormlyFieldConfig {
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

// MARK: Deprecated Aliases
/** @deprecated Use formlyTextIsAvailableField instead. */
export const textIsAvailableField = formlyTextIsAvailableField;
