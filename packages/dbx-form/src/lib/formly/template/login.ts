import { TextFieldConfig, textField } from '../field/value/text/text.field';
import { EmailFieldConfig, emailField } from '../field/value/text/text.additional.field';
import { fieldValuesAreEqualValidator } from '../../validator/field';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { capitalizeFirstLetter, type Maybe } from '@dereekb/util';

/**
 * Convenience interface for the password parameters configuration for a TextPasswordField.
 */
export type TextPasswordFieldPasswordParameters = Partial<Pick<TextFieldConfig, 'maxLength' | 'minLength' | 'pattern'>>;

/**
 * textPasswordField() configuration.
 */
export interface TextPasswordFieldConfig extends Omit<TextFieldConfig, 'inputType' | 'key'>, Partial<Pick<TextFieldConfig, 'key' | 'materialFormField'>> {}

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
  readonly password?: TextPasswordFieldConfig;
  readonly verifyPassword?: TextPasswordFieldConfig;
}

export function textPasswordWithVerifyFieldGroup(config: TextPasswordWithVerifyFieldConfig): FormlyFieldConfig {
  const passwordFieldConfig = textPasswordField(config.password);
  const verifyPasswordFieldKey = config.verifyPassword?.key ?? `verify${capitalizeFirstLetter(String(passwordFieldConfig.key))}`;
  const verifyPasswordField = textVerifyPasswordField({
    ...config.password,
    ...config.verifyPassword,
    label: config.verifyPassword?.label ?? `Verify ${passwordFieldConfig.props?.label}`,
    key: verifyPasswordFieldKey
  });

  const validators = {
    validation: [
      {
        errorPath: verifyPasswordFieldKey,
        expression: fieldValuesAreEqualValidator({ keysFilter: [passwordFieldConfig.key, verifyPasswordField.key] as string[], message: 'The passwords do not match.' })
      }
    ]
  };

  const groupFieldConfig: FormlyFieldConfig = {
    validators,
    fieldGroup: [passwordFieldConfig, verifyPasswordField]
  };

  return groupFieldConfig;
}

export interface UsernameLoginFieldUsernameConfig {
  readonly email?: Omit<EmailFieldConfig, 'key'>;
  readonly username?: Omit<TextFieldConfig, 'key'>;
}

export type UsernameLoginFieldUsernameConfigInput = 'email' | 'username' | UsernameLoginFieldUsernameConfig;

/**
 * usernamePasswordLoginFields() configuration.
 */
export interface UsernameLoginFieldsConfig {
  readonly username: UsernameLoginFieldUsernameConfigInput;
  readonly password?: TextPasswordFieldConfig;
  readonly verifyPassword?: Maybe<boolean | TextPasswordFieldConfig>;
}

/**
 * Value type exported by usernameLoginFields()
 */
export interface DefaultUsernameLoginFieldsValue extends DefaultUsernameLoginFieldValue {
  readonly password: string;
  readonly verifyPassword?: string;
}

/**
 * Template for login field that takes in a username and password.
 *
 * @param param0
 * @returns
 */
export function usernamePasswordLoginFields({ username, password, verifyPassword }: UsernameLoginFieldsConfig): FormlyFieldConfig[] {
  const usernameField = usernameLoginField(username);
  const passwordField = verifyPassword ? textPasswordWithVerifyFieldGroup({ password, verifyPassword: verifyPassword === true ? undefined : verifyPassword }) : textPasswordField(password);

  return [usernameField, passwordField];
}

/**
 * Value type exported by usernameLoginField()
 */
export interface DefaultUsernameLoginFieldValue {
  readonly username: string;
}

export function usernameLoginField(username: UsernameLoginFieldUsernameConfigInput): FormlyFieldConfig {
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
    usernameField = emailField({ ...usernameFieldConfig.email, ...defaultUsernameFieldConfig });
  } else {
    usernameField = textField({ ...usernameFieldConfig.username, ...defaultUsernameFieldConfig });
  }

  return usernameField;
}
