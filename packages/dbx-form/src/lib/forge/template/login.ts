import { forgeTextField, type DbxForgeTextFieldConfig } from '../field/value/text/text.field';
import { forgeEmailField, type DbxForgeEmailFieldConfig } from '../field/value/text/text.additional.field';

// MARK: Password Field
/**
 * Configuration for a forge password field.
 */
export interface DbxForgeTextPasswordFieldConfig extends Omit<DbxForgeTextFieldConfig, 'inputType' | 'key'>, Partial<Pick<DbxForgeTextFieldConfig, 'key'>> {}

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
export function forgeTextPasswordField(config?: DbxForgeTextPasswordFieldConfig) {
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
export function forgeTextVerifyPasswordField(config?: DbxForgeTextPasswordFieldConfig) {
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
export interface DbxForgeUsernameLoginFieldUsernameConfig {
  /**
   * Configuration for an email-based username field.
   */
  readonly email?: Omit<DbxForgeEmailFieldConfig, 'key'>;
  /**
   * Configuration for a plain text username field.
   */
  readonly username?: Omit<DbxForgeTextFieldConfig, 'key'>;
}

/**
 * Input type for the username field configuration.
 *
 * Can be the string `'email'` or `'username'` for quick defaults,
 * or a full {@link DbxForgeUsernameLoginFieldUsernameConfig} object for custom configuration.
 */
export type DbxForgeUsernameLoginFieldUsernameConfigInput = 'email' | 'username' | DbxForgeUsernameLoginFieldUsernameConfig;

/**
 * Configuration for forge username/password login fields.
 */
export interface DbxForgeUsernameLoginFieldsConfig {
  /**
   * Username field configuration. Use `'email'` or `'username'` for defaults,
   * or provide a custom config.
   */
  readonly username: DbxForgeUsernameLoginFieldUsernameConfigInput;
  /**
   * Optional configuration for the password field.
   */
  readonly password?: DbxForgeTextPasswordFieldConfig;
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
export function forgeUsernamePasswordLoginFields(config: DbxForgeUsernameLoginFieldsConfig) {
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
export function forgeUsernameLoginField(username: DbxForgeUsernameLoginFieldUsernameConfigInput) {
  let usernameFieldConfig: DbxForgeUsernameLoginFieldUsernameConfig = username as DbxForgeUsernameLoginFieldUsernameConfig;

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
