import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type TextFieldConfig, textField } from '../field/value/text';
import { validatorsForFieldConfig } from '../field/field';
import { type ValidatorFn } from '@angular/forms';
import { isWebsiteUrlValidator, type IsWebsiteUrlValidatorConfig } from '../../validator/website';

/**
 * Configuration for a website URL text field.
 *
 * Extends {@link TextFieldConfig} with URL validation options from {@link IsWebsiteUrlValidatorConfig}.
 */
export interface WebsiteUrlFieldConfig extends Omit<TextFieldConfig, 'inputType' | 'key'>, Partial<Pick<TextFieldConfig, 'key' | 'materialFormField'>>, IsWebsiteUrlValidatorConfig {}

/**
 * Creates a text field configured for website URL input with URL validation.
 *
 * Defaults to the key `'website'` and label `'Website Url'` unless overridden in the config.
 *
 * @param config - Optional configuration for the website URL field.
 * @returns A Formly field configuration with website URL validation.
 */
export function formlyWebsiteUrlField(config?: WebsiteUrlFieldConfig): FormlyFieldConfig {
  const validators: ValidatorFn[] = [isWebsiteUrlValidator(config)];

  return {
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
}

// MARK: Deprecated Aliases
/** @deprecated Use formlyWebsiteUrlField instead. */
export const websiteUrlField = formlyWebsiteUrlField;
