import { TextFieldConfig, textField } from '../field/value/text/text.field';
import { EmailFieldConfig, emailField } from '../field/value/text/text.additional.field';
import { fieldValuesAreEqualValidator } from '../../validator/field';
import { FormlyFieldConfig } from "@ngx-formly/core";
import { capitalizeFirstLetter, Maybe } from '@dereekb/util';

/**
 * Convenience interface for the password parameters configuration for a TextPasswordField.
 */
export type TextPasswordFieldPasswordParameters = Partial<Pick<TextFieldConfig, 'maxLength' | 'minLength' | 'pattern'>>;

/**
 * textPasswordField() configuration.
 */
export interface TextPasswordFieldConfig extends Omit<TextFieldConfig, 'inputType' | 'key'>, Partial<Pick<TextFieldConfig, 'key'>> { }

/**
 * Configured simple text password field.
 * 
 * @param config 
 * @returns 
 */
export function textPasswordField(config?: TextPasswordFieldConfig): FormlyFieldConfig {
  return textField({
    key: 'password',
    ...config,
    label: config?.label ?? 'Password',
    inputType: 'password',
    required: true
  });
}

/**
 * Configured verify field for a password.
 * @param config 
 * @returns 
 */
export function textVerifyPasswordField(config?: TextPasswordFieldConfig): FormlyFieldConfig {
  return textPasswordField({
    key: 'verifyPassword',
    label: 'Verify Password',
    ...config,
    required: true
  });
}

export interface TextPasswordWithVerifyFieldConfig {
  password?: TextPasswordFieldConfig;
  verifyPassword?: TextPasswordFieldConfig;
}

export function textPasswordWithVerifyFieldGroup(config: TextPasswordWithVerifyFieldConfig): FormlyFieldConfig {
  const passwordFieldConfig = textPasswordField(config.password);
  const verifyPasswordFieldKey = config.verifyPassword?.key ?? `verify${capitalizeFirstLetter(String(passwordFieldConfig.key))}`;
  const verifyPasswordField = textVerifyPasswordField({
    ...config.password,
    ...config.verifyPassword,
    label: (config.verifyPassword?.label) ?? `Verify ${passwordFieldConfig.templateOptions?.label}`,
    key: verifyPasswordFieldKey
  });

  const validators = {
    validation: [{
      errorPath: verifyPasswordFieldKey,
      expression: fieldValuesAreEqualValidator({ keysFilter: [passwordFieldConfig.key, verifyPasswordField.key] as string[], message: 'The passwords do not match.' })
    }]
  };

  const groupFieldConfig: FormlyFieldConfig = {
    validators,
    fieldGroup: [passwordFieldConfig, verifyPasswordField]
  };

  return groupFieldConfig;
}

export interface UsernameLoginFieldUsernameConfig {
  email?: Omit<EmailFieldConfig, 'key'>;
  username?: Omit<TextFieldConfig, 'key'>;
};

/**
 * usernamePasswordLoginFields() configuration.
 */
export interface UsernameLoginFieldsConfig {
  username: 'email' | 'username' | UsernameLoginFieldUsernameConfig;
  password?: TextPasswordFieldConfig;
  verifyPassword?: Maybe<boolean | TextPasswordFieldConfig>;
}

/**
 * Value type exported by usernameLoginFields()
 */
export interface DefaultUsernameLoginFieldsValue {
  username: string;
  password: string;
  verifyPassword?: string;
}

/**
 * Template for login field that takes in a username and password.
 * 
 * @param param0 
 * @returns 
 */
export function usernamePasswordLoginFields({ username, password, verifyPassword }: UsernameLoginFieldsConfig): FormlyFieldConfig[] {
  let usernameField: FormlyFieldConfig;
  let usernameFieldConfig: UsernameLoginFieldUsernameConfig = username as UsernameLoginFieldUsernameConfig;
  const defaultUsernameFieldConfig = { key: 'username', required: true };

  if (typeof username === 'string') {
    if (username === 'email') {
      usernameFieldConfig = {
        email: defaultUsernameFieldConfig
      };
    } else {
      usernameFieldConfig = {
        username: defaultUsernameFieldConfig
      };
    }
  }

  if (usernameFieldConfig.email) {
    usernameField = emailField({ ...usernameFieldConfig.username, ...defaultUsernameFieldConfig });
  } else {
    usernameField = textField({ ...usernameFieldConfig.username, ...defaultUsernameFieldConfig });
  }

  const passwordField = (verifyPassword) ? (textPasswordWithVerifyFieldGroup({ password, verifyPassword: (verifyPassword === true) ? undefined : verifyPassword })) : textPasswordField(password);

  return [
    usernameField,
    passwordField
  ];
}
