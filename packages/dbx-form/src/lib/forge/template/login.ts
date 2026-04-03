import type { MatInputField } from '@ng-forge/dynamic-forms-material';
import { forgeTextField, type ForgeTextFieldConfig } from '../field/value/text/text.field';
import { forgeEmailField, type ForgeEmailFieldConfig } from '../field/value/text/text.additional.field';

// MARK: Password Field
/**
 * Configuration for a forge password field.
 */
export interface ForgeTextPasswordFieldConfig extends Omit<ForgeTextFieldConfig, 'inputType' | 'key'>, Partial<Pick<ForgeTextFieldConfig, 'key'>> {}

/**
 * Creates a forge text password field with the input type set to `'password'`.
 *
 * Defaults to the key `'password'` and label `'Password'` unless overridden.
 *
 * @param config - Optional configuration for the password field
 * @returns A {@link MatInputField} with password input type
 *
 * @example
 * ```typescript
 * const field = forgeTextPasswordField();
 * ```
 */
export function forgeTextPasswordField(config?: ForgeTextPasswordFieldConfig): MatInputField {
  return forgeTextField({
    key: 'password',
    ...config,
    label: config?.label ?? 'Password',
    inputType: 'password',
    required: true
  });
}

/**
 * Creates a forge verify/confirm password field, typically used alongside a primary password field.
 *
 * Defaults to the key `'verifyPassword'` and label `'Verify Password'` unless overridden.
 *
 * @param config - Optional configuration for the verify password field
 * @returns A {@link MatInputField} with password input type
 *
 * @example
 * ```typescript
 * const field = forgeTextVerifyPasswordField();
 * ```
 */
export function forgeTextVerifyPasswordField(config?: ForgeTextPasswordFieldConfig): MatInputField {
  return forgeTextPasswordField({
    key: 'verifyPassword',
    label: 'Verify Password',
    ...config,
    required: true
  });
}

// MARK: Username Login Fields
/**
 * Configuration for the username field in a forge login form.
 */
export interface ForgeUsernameLoginFieldUsernameConfig {
  /**
   * Configuration for an email-based username field.
   */
  readonly email?: Omit<ForgeEmailFieldConfig, 'key'>;
  /**
   * Configuration for a plain text username field.
   */
  readonly username?: Omit<ForgeTextFieldConfig, 'key'>;
}

/**
 * Input type for the username field configuration.
 *
 * Can be the string `'email'` or `'username'` for quick defaults,
 * or a full {@link ForgeUsernameLoginFieldUsernameConfig} object for custom configuration.
 */
export type ForgeUsernameLoginFieldUsernameConfigInput = 'email' | 'username' | ForgeUsernameLoginFieldUsernameConfig;

/**
 * Configuration for forge username/password login fields.
 */
export interface ForgeUsernameLoginFieldsConfig {
  /**
   * Username field configuration. Use `'email'` or `'username'` for defaults,
   * or provide a custom config.
   */
  readonly username: ForgeUsernameLoginFieldUsernameConfigInput;
  /**
   * Optional configuration for the password field.
   */
  readonly password?: ForgeTextPasswordFieldConfig;
}

/**
 * Creates an array of forge field definitions for a username/password login form.
 *
 * @param config - Login fields configuration
 * @returns An array of forge field definitions for the login form
 *
 * @example
 * ```typescript
 * const fields = forgeUsernamePasswordLoginFields({ username: 'email' });
 * ```
 */
export function forgeUsernamePasswordLoginFields(config: ForgeUsernameLoginFieldsConfig): MatInputField[] {
  const usernameField = forgeUsernameLoginField(config.username);
  const passwordField = forgeTextPasswordField(config.password);

  return [usernameField, passwordField];
}

/**
 * Creates a single forge username field for a login form.
 *
 * Supports email or plain text input based on the provided configuration.
 *
 * @param username - Either `'email'`, `'username'`, or a full config object
 * @returns A forge field definition for the username input
 *
 * @example
 * ```typescript
 * const field = forgeUsernameLoginField('email');
 * ```
 */
export function forgeUsernameLoginField(username: ForgeUsernameLoginFieldUsernameConfigInput): MatInputField {
  let usernameFieldConfig: ForgeUsernameLoginFieldUsernameConfig = username as ForgeUsernameLoginFieldUsernameConfig;

  if (typeof username === 'string') {
    if (username === 'email') {
      usernameFieldConfig = { email: { required: true } };
    } else {
      usernameFieldConfig = { username: { required: true } };
    }
  }

  if (usernameFieldConfig.email) {
    return forgeEmailField({ ...usernameFieldConfig.email, key: 'username' });
  }

  return forgeTextField({ ...usernameFieldConfig.username, key: 'username', required: true });
}
