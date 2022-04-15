import { TextFieldConfig, textField } from '../field/value/text/text.field';
import { FormlyFieldConfig } from "@ngx-formly/core";

/**
 * textPasswordField() configuration.
 */
export interface TextPasswordFieldConfig extends Omit<TextFieldConfig, 'inputType'> { }

/**
 * Configured simple text password field.
 * 
 * @param config 
 * @returns 
 */
export function textPasswordField(config: TextPasswordFieldConfig): FormlyFieldConfig {
  return textField({
    ...config,
    inputType: 'password'
  });
}

/**
 * loginFields() configuration.
 */
export interface LoginFieldsConfig {
  username: TextFieldConfig;
  password: TextPasswordFieldConfig;
}

/**
 * Template for login fields.
 * 
 * @param param0 
 * @returns 
 */
export function loginFields({ username, password }: LoginFieldsConfig): FormlyFieldConfig[] {
  return [textField(username), textPasswordField(password)]
}
