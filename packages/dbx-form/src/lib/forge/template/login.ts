import { capitalizeFirstLetter, type Maybe } from '@dereekb/util';
import type { ValidatorConfig } from '@ng-forge/dynamic-forms';
import { dbxForgeTextField, type DbxForgeTextFieldConfig } from '../field/value/text/text.field';
import { dbxForgeEmailField, type DbxForgeEmailFieldConfig } from '../field/value/text/text.additional.field';
import { MatInputField } from '@ng-forge/dynamic-forms-material';
import { DbxForgeField } from '../form';

/**
 * Validation kind used on the verify password field to indicate the passwords do not match.
 */
export const DBX_FORGE_PASSWORDS_MATCH_VALIDATION_KIND = 'passwordsMatch';

/**
 * Default validation message used when the passwords do not match.
 */
export const DBX_FORGE_DEFAULT_PASSWORDS_MATCH_VALIDATION_MESSAGE = 'The passwords do not match.';

/**
 * Default autocomplete value for password fields.
 */
export const DBX_FORGE_TEXT_PASSWORD_DEFAULT_AUTOCOMPLETE = 'current-password';

/**
 * Default autocomplete value for verify password fields.
 */
export const DBX_FORGE_TEXT_VERIFY_PASSWORD_DEFAULT_AUTOCOMPLETE = 'new-password';

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
 * const field = dbxForgeTextPasswordField();
 * ```
 */
export function dbxForgeTextPasswordField(config?: DbxForgeTextPasswordFieldConfig) {
  return dbxForgeTextField({
    key: 'password',
    autocomplete: DBX_FORGE_TEXT_PASSWORD_DEFAULT_AUTOCOMPLETE,
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
 * const field = dbxForgeTextVerifyPasswordField();
 * ```
 */
export function dbxForgeTextVerifyPasswordField(config?: DbxForgeTextPasswordFieldConfig) {
  return dbxForgeTextPasswordField({
    key: 'verifyPassword',
    label: 'Verify Password',
    autocomplete: DBX_FORGE_TEXT_VERIFY_PASSWORD_DEFAULT_AUTOCOMPLETE,
    ...config,
    required: true
  });
}

// MARK: Password With Verify Field
/**
 * Configuration for a forge password field group that includes a verification (confirm) password field.
 */
export interface DbxForgeTextPasswordWithVerifyFieldConfig {
  /**
   * Optional configuration for the primary password field.
   */
  readonly password?: DbxForgeTextPasswordFieldConfig;
  /**
   * Optional configuration for the verify/confirm password field.
   */
  readonly verifyPassword?: DbxForgeTextPasswordFieldConfig;
}

/**
 * Creates a forge password and verify password pair with a custom validator on the verify field
 * that ensures both values match.
 *
 * The verify password field uses an expression-based custom validator that compares the
 * verify field value against the primary password field's value via `formValue`.
 *
 * @param config - Configuration for the password and verify password fields
 * @returns A tuple of `[passwordField, verifyPasswordField]`
 *
 * @example
 * ```typescript
 * const [passwordField, verifyPasswordField] = dbxForgeTextPasswordWithVerifyField();
 * ```
 */
export function dbxForgeTextPasswordWithVerifyField(config?: DbxForgeTextPasswordWithVerifyFieldConfig) {
  /**
   * Utilize the verify password autocomplete if it is for a new password.
   */
  const passwordFieldAutocomplete = config?.password?.autocomplete ?? DBX_FORGE_TEXT_VERIFY_PASSWORD_DEFAULT_AUTOCOMPLETE;
  const passwordField = dbxForgeTextPasswordField({ ...config?.password, autocomplete: passwordFieldAutocomplete });
  const passwordKey = passwordField.key as string;
  const verifyPasswordKey = config?.verifyPassword?.key ?? `verify${capitalizeFirstLetter(passwordKey)}`;
  const verifyPasswordLabel = config?.verifyPassword?.label ?? `Verify ${passwordField.label ?? 'Password'}`;

  const matchValidator: ValidatorConfig = {
    type: 'custom',
    expression: `fieldValue === formValue.${passwordKey}`,
    kind: DBX_FORGE_PASSWORDS_MATCH_VALIDATION_KIND
  };

  const inputValidators = (config?.verifyPassword?.validators ?? []) as ValidatorConfig[];
  const inputValidationMessages = config?.verifyPassword?.validationMessages;

  const verifyPasswordField = dbxForgeTextVerifyPasswordField({
    ...config?.password,
    ...config?.verifyPassword,
    key: verifyPasswordKey,
    label: verifyPasswordLabel,
    validators: [...inputValidators, matchValidator],
    validationMessages: {
      [DBX_FORGE_PASSWORDS_MATCH_VALIDATION_KIND]: DBX_FORGE_DEFAULT_PASSWORDS_MATCH_VALIDATION_MESSAGE,
      ...inputValidationMessages
    }
  });

  return [passwordField, verifyPasswordField] as const;
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
  /**
   * Whether to include a verify password field, or a custom configuration for it.
   * Set to `true` for defaults, `false`/`undefined` to omit, or pass a config object.
   */
  readonly verifyPassword?: Maybe<boolean | DbxForgeTextPasswordFieldConfig>;
}

/**
 * Creates an array of forge field definitions for a username/password login form.
 *
 * When `verifyPassword` is provided, a second password field is added with a custom
 * validator that ensures both password values match.
 *
 * @param config - Login fields configuration
 * @returns An array of forge field definitions for the login form
 *
 * @example
 * ```typescript
 * const fields = dbxForgeUsernamePasswordLoginFields({ username: 'email' });
 * ```
 */
export function dbxForgeUsernamePasswordLoginFields(config: DbxForgeUsernameLoginFieldsConfig) {
  const { username, password, verifyPassword } = config;
  const usernameField = dbxForgeUsernameLoginField(username);

  let result: DbxForgeField<MatInputField>[];

  if (verifyPassword) {
    const [passwordField, verifyPasswordField] = dbxForgeTextPasswordWithVerifyField({
      password,
      verifyPassword: verifyPassword === true ? undefined : verifyPassword
    });

    result = [usernameField, passwordField, verifyPasswordField];
  } else {
    const passwordField = dbxForgeTextPasswordField(password);
    result = [usernameField, passwordField];
  }

  return result;
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
 * const field = dbxForgeUsernameLoginField('email');
 * ```
 */
export function dbxForgeUsernameLoginField(username: DbxForgeUsernameLoginFieldUsernameConfigInput) {
  let usernameFieldConfig: DbxForgeUsernameLoginFieldUsernameConfig = username as DbxForgeUsernameLoginFieldUsernameConfig;

  if (typeof username === 'string') {
    if (username === 'email') {
      usernameFieldConfig = { email: { required: true } };
    } else {
      usernameFieldConfig = { username: { required: true } };
    }
  }

  let result: DbxForgeField<MatInputField>;

  if (usernameFieldConfig.email) {
    result = dbxForgeEmailField({ ...usernameFieldConfig.email, key: 'username', autocomplete: 'email' });
  } else {
    result = dbxForgeTextField({ ...usernameFieldConfig.username, key: 'username', autocomplete: 'username', required: true });
  }

  return result;
}
