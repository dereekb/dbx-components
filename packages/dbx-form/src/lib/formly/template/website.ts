import { FormlyFieldConfig } from '@ngx-formly/core';
import { TextFieldConfig, textField } from '../field/value/text';
import { validatorsForFieldConfig } from '../field/field';
import { ValidatorFn } from '@angular/forms';
import { isWebsiteUrlValidator, IsWebsiteUrlValidatorConfig } from '../../validator/website';

/**
 * websiteUrlField() configuration.
 */
export interface WebsiteUrlFieldConfig extends Omit<TextFieldConfig, 'inputType' | 'key'>, Partial<Pick<TextFieldConfig, 'key' | 'materialFormField'>>, IsWebsiteUrlValidatorConfig {}

/**
 * Configured simple text password field.
 *
 * @param config
 * @returns
 */
export function websiteUrlField(config?: WebsiteUrlFieldConfig): FormlyFieldConfig {
  const validators: ValidatorFn[] = [isWebsiteUrlValidator(config)];

  const field = {
    ...textField({
      key: 'website',
      ...config,
      label: config?.label ?? 'Website Url',
      inputType: 'text'
    }),
    ...validatorsForFieldConfig({
      validators
    })
  };

  return field;
}
