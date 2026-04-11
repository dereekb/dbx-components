import { type TextFieldConfig, formlyTextField } from '../field/value/text/text.field';
import { type EmailFieldConfig, formlyEmailField } from '../field/value/text/text.additional.field';
import { fieldValuesAreEqualValidator } from '../../validator/field';
import { type FormlyFieldConfig } from '@ngx-formly/core';
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
 * Creates a simple text password field with the input type set to `'password'`.
 *
 * Defaults to the key `'password'` and label `'Password'` unless overridden.
 *
 * @param config - Optional configuration for the password field.
 * @returns A Formly field configuration for a password input.
 */
export function formlyTextPasswordField(config?: TextPasswordFieldConfig): FormlyFieldConfig {
  return formlyTextField({
    key: 'password',
    ...config,
    label: config?.label ?? 'Password',
    inputType: 'password',
    required: true
  });
}

/**
 * Creates a verify/confirm password field, typically used alongside a primary password field.
 *
 * Defaults to the key `'verifyPassword'` and label `'Verify Password'` unless overridden.
 *
 * @param config - Optional configuration for the verify password field.
 * @returns A Formly field configuration for a verify password input.
 */
export function formlyTextVerifyPasswordField(config?: TextPasswordFieldConfig): FormlyFieldConfig {
  return formlyTextPasswordField({
    key: 'verifyPassword',
    label: 'Verify Password',
    ...config,
    required: true
  });
}

/**
 * Configuration for a password field group that includes a verification (confirm) password field.
 */
export interface TextPasswordWithVerifyFieldConfig {
  /**
   * Optional configuration for the primary password field.
   */
  readonly password?: TextPasswordFieldConfig;
  /**
   * Optional configuration for the verify/confirm password field.
   */
  readonly verifyPassword?: TextPasswordFieldConfig;
}

/**
 * Creates a Formly field group containing a password field and a verify password field
 * with a cross-field validator that ensures both values match.
 *
 * @param config - Configuration for the password and verify password fields.
 * @returns A Formly field group configuration with password matching validation.
 */
export function formlyTextPasswordWithVerifyFieldGroup(config: TextPasswordWithVerifyFieldConfig): FormlyFieldConfig {
  const passwordFieldConfig = formlyTextPasswordField(config.password);
  const verifyPasswordFieldKey = config.verifyPassword?.key ?? `verify${capitalizeFirstLetter(String(passwordFieldConfig.key))}`;
  const verifyPasswordField = formlyTextVerifyPasswordField({
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

/**
 * Configuration for the username field in a login form, supporting either email or text input.
 */
export interface UsernameLoginFieldUsernameConfig {
  /**
   * Configuration for an email-based username field.
   */
  readonly email?: Omit<EmailFieldConfig, 'key'>;
  /**
   * Configuration for a plain text username field.
   */
  readonly username?: Omit<TextFieldConfig, 'key'>;
}

/**
 * Input type for the username field configuration.
 *
 * Can be the string `'email'` or `'username'` for quick defaults, or a full {@link UsernameLoginFieldUsernameConfig} object for custom configuration.
 */
export type UsernameLoginFieldUsernameConfigInput = 'email' | 'username' | UsernameLoginFieldUsernameConfig;

/**
 * usernamePasswordLoginFields() configuration.
 */
export interface UsernameLoginFieldsConfig {
  /**
   * Username field configuration. Use `'email'` or `'username'` for defaults, or provide a custom config.
   */
  readonly username: UsernameLoginFieldUsernameConfigInput;
  /**
   * Optional configuration for the password field.
   */
  readonly password?: TextPasswordFieldConfig;
  /**
   * Whether to include a verify password field, or a custom configuration for it.
   * Set to `true` for defaults, `false`/`undefined` to omit, or pass a config object.
   */
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
 * @param param0 - Login fields configuration
 * @param param0.username - Optional username field configuration
 * @param param0.password - Optional password field configuration
 * @param param0.verifyPassword - Optional verify-password field configuration, or `true` to use defaults
 * @returns An array of Formly field configs for the login form
 */
export function formlyUsernamePasswordLoginFields({ username, password, verifyPassword }: UsernameLoginFieldsConfig): FormlyFieldConfig[] {
  const usernameField = formlyUsernameLoginField(username);
  const passwordField = verifyPassword ? formlyTextPasswordWithVerifyFieldGroup({ password, verifyPassword: verifyPassword === true ? undefined : verifyPassword }) : formlyTextPasswordField(password);

  return [usernameField, passwordField];
}

/**
 * Value type exported by usernameLoginField()
 */
export interface DefaultUsernameLoginFieldValue {
  readonly username: string;
}

/**
 * Creates a single username field for a login form. Supports email or plain text input
 * based on the provided configuration.
 *
 * @param username - Either `'email'`, `'username'`, or a full {@link UsernameLoginFieldUsernameConfig}.
 * @returns A Formly field configuration for the username input.
 */
export function formlyUsernameLoginField(username: UsernameLoginFieldUsernameConfigInput): FormlyFieldConfig {
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
    usernameField = formlyEmailField({ ...usernameFieldConfig.email, ...defaultUsernameFieldConfig });
  } else {
    usernameField = formlyTextField({ ...usernameFieldConfig.username, ...defaultUsernameFieldConfig });
  }

  return usernameField;
}

// MARK: Deprecated Aliases
/**
 * @deprecated Use formlyTextPasswordField instead.
 */
export const textPasswordField = formlyTextPasswordField;
/**
 * @deprecated Use formlyTextVerifyPasswordField instead.
 */
export const textVerifyPasswordField = formlyTextVerifyPasswordField;
/**
 * @deprecated Use formlyTextPasswordWithVerifyFieldGroup instead.
 */
export const textPasswordWithVerifyFieldGroup = formlyTextPasswordWithVerifyFieldGroup;
/**
 * @deprecated Use formlyUsernamePasswordLoginFields instead.
 */
export const usernamePasswordLoginFields = formlyUsernamePasswordLoginFields;
/**
 * @deprecated Use formlyUsernameLoginField instead.
 */
export const usernameLoginField = formlyUsernameLoginField;
