import { describe, it, expect } from 'vitest';
import { DBX_FORGE_DEFAULT_PASSWORDS_MATCH_VALIDATION_MESSAGE, DBX_FORGE_PASSWORDS_MATCH_VALIDATION_KIND, dbxForgeTextPasswordField, dbxForgeTextPasswordWithVerifyField, dbxForgeTextVerifyPasswordField, dbxForgeUsernamePasswordLoginFields, dbxForgeUsernameLoginField } from './login';

// MARK: dbxForgeTextPasswordField
describe('dbxForgeTextPasswordField()', () => {
  it('should create an input field', () => {
    const field = dbxForgeTextPasswordField();
    expect(field.type).toBe('input');
  });

  it('should default key to password', () => {
    const field = dbxForgeTextPasswordField();
    expect(field.key).toBe('password');
  });

  it('should default label to Password', () => {
    const field = dbxForgeTextPasswordField();
    expect(field.label).toBe('Password');
  });

  it('should use password input type', () => {
    const field = dbxForgeTextPasswordField();
    expect(field.props?.type).toBe('password');
  });

  it('should be required by default', () => {
    const field = dbxForgeTextPasswordField();
    expect(field.required).toBe(true);
  });

  it('should allow overriding the key', () => {
    const field = dbxForgeTextPasswordField({ key: 'pin' });
    expect(field.key).toBe('pin');
  });

  it('should allow overriding the label', () => {
    const field = dbxForgeTextPasswordField({ label: 'PIN' });
    expect(field.label).toBe('PIN');
  });
});

// MARK: dbxForgeTextVerifyPasswordField
describe('dbxForgeTextVerifyPasswordField()', () => {
  it('should create an input field', () => {
    const field = dbxForgeTextVerifyPasswordField();
    expect(field.type).toBe('input');
  });

  it('should default key to verifyPassword', () => {
    const field = dbxForgeTextVerifyPasswordField();
    expect(field.key).toBe('verifyPassword');
  });

  it('should default label to Verify Password', () => {
    const field = dbxForgeTextVerifyPasswordField();
    expect(field.label).toBe('Verify Password');
  });

  it('should use password input type', () => {
    const field = dbxForgeTextVerifyPasswordField();
    expect(field.props?.type).toBe('password');
  });

  it('should be required by default', () => {
    const field = dbxForgeTextVerifyPasswordField();
    expect(field.required).toBe(true);
  });

  it('should allow overriding the key', () => {
    const field = dbxForgeTextVerifyPasswordField({ key: 'confirmPin' });
    expect(field.key).toBe('confirmPin');
  });

  it('should allow overriding the label', () => {
    const field = dbxForgeTextVerifyPasswordField({ label: 'Confirm PIN' });
    expect(field.label).toBe('Confirm PIN');
  });
});

// MARK: dbxForgeUsernameLoginField
describe('dbxForgeUsernameLoginField()', () => {
  it('should create an email input field when configured with email string', () => {
    const field = dbxForgeUsernameLoginField('email');
    expect(field.type).toBe('input');
    expect(field.key).toBe('username');
    expect(field.props?.type).toBe('email');
  });

  it('should create a text input field when configured with username string', () => {
    const field = dbxForgeUsernameLoginField('username');
    expect(field.type).toBe('input');
    expect(field.key).toBe('username');
    expect(field.props?.type).toBe('text');
  });

  it('should set required when using email shorthand', () => {
    const field = dbxForgeUsernameLoginField('email');
    expect(field.required).toBe(true);
  });

  it('should set required when using username shorthand', () => {
    const field = dbxForgeUsernameLoginField('username');
    expect(field.required).toBe(true);
  });

  it('should use email config when provided as object', () => {
    const field = dbxForgeUsernameLoginField({ email: { required: true, label: 'Your Email' } });
    expect(field.key).toBe('username');
    expect(field.props?.type).toBe('email');
    expect(field.label).toBe('Your Email');
  });

  it('should use username config when provided as object', () => {
    const field = dbxForgeUsernameLoginField({ username: { required: true, label: 'Your Username' } });
    expect(field.key).toBe('username');
    expect(field.label).toBe('Your Username');
  });
});

// MARK: dbxForgeUsernamePasswordLoginFields
describe('dbxForgeUsernamePasswordLoginFields()', () => {
  it('should return an array of two fields', () => {
    const fields = dbxForgeUsernamePasswordLoginFields({ username: 'email' });
    expect(fields.length).toBe(2);
  });

  it('should have the username field first and password field second', () => {
    const fields = dbxForgeUsernamePasswordLoginFields({ username: 'email' });
    expect(fields[0].key).toBe('username');
    expect(fields[1].key).toBe('password');
  });

  it('should create email-based username when configured with email', () => {
    const fields = dbxForgeUsernamePasswordLoginFields({ username: 'email' });
    expect(fields[0].props?.type).toBe('email');
  });

  it('should create text-based username when configured with username', () => {
    const fields = dbxForgeUsernamePasswordLoginFields({ username: 'username' });
    expect(fields[0].props?.type).toBe('text');
  });

  it('should create a password field with password input type', () => {
    const fields = dbxForgeUsernamePasswordLoginFields({ username: 'email' });
    expect(fields[1].props?.type).toBe('password');
  });

  it('should propagate password config', () => {
    const fields = dbxForgeUsernamePasswordLoginFields({ username: 'email', password: { label: 'Secret' } });
    expect(fields[1].label).toBe('Secret');
  });

  it('should include a verify password field when verifyPassword is true', () => {
    const fields = dbxForgeUsernamePasswordLoginFields({ username: 'email', verifyPassword: true });
    expect(fields.length).toBe(3);
    expect(fields[2].key).toBe('verifyPassword');
    expect(fields[2].props?.type).toBe('password');
  });

  it('should include a verify password field when verifyPassword is an object', () => {
    const fields = dbxForgeUsernamePasswordLoginFields({ username: 'email', verifyPassword: { label: 'Confirm' } });
    expect(fields.length).toBe(3);
    expect(fields[2].label).toBe('Confirm');
  });

  it('should not include a verify password field when verifyPassword is not set', () => {
    const fields = dbxForgeUsernamePasswordLoginFields({ username: 'email' });
    expect(fields.length).toBe(2);
  });
});

// MARK: dbxForgeTextPasswordWithVerifyField
describe('dbxForgeTextPasswordWithVerifyField()', () => {
  it('should return a tuple of password and verify password fields', () => {
    const [passwordField, verifyPasswordField] = dbxForgeTextPasswordWithVerifyField();
    expect(passwordField.key).toBe('password');
    expect(verifyPasswordField.key).toBe('verifyPassword');
  });

  it('should add a match validator to the verify password field', () => {
    const [, verifyPasswordField] = dbxForgeTextPasswordWithVerifyField();
    const validators = verifyPasswordField.validators ?? [];
    const matchValidator = validators.find((v) => v.type === 'custom' && (v as { kind?: string }).kind === DBX_FORGE_PASSWORDS_MATCH_VALIDATION_KIND);
    expect(matchValidator).toBeDefined();
    expect((matchValidator as { expression?: string }).expression).toBe('fieldValue === formValue.password');
  });

  it('should reference the custom password key in the match validator expression', () => {
    const [, verifyPasswordField] = dbxForgeTextPasswordWithVerifyField({ password: { key: 'pin' } });
    const validators = verifyPasswordField.validators ?? [];
    const matchValidator = validators.find((v) => v.type === 'custom' && (v as { kind?: string }).kind === DBX_FORGE_PASSWORDS_MATCH_VALIDATION_KIND);
    expect((matchValidator as { expression?: string }).expression).toBe('fieldValue === formValue.pin');
  });

  it('should derive the verify password key and label from the password key and label', () => {
    const [passwordField, verifyPasswordField] = dbxForgeTextPasswordWithVerifyField({ password: { key: 'pin', label: 'PIN' } });
    expect(passwordField.key).toBe('pin');
    expect(verifyPasswordField.key).toBe('verifyPin');
    expect(verifyPasswordField.label).toBe('Verify PIN');
  });

  it('should register a default validation message for the match kind', () => {
    const [, verifyPasswordField] = dbxForgeTextPasswordWithVerifyField();
    expect(verifyPasswordField.validationMessages?.[DBX_FORGE_PASSWORDS_MATCH_VALIDATION_KIND]).toBe(DBX_FORGE_DEFAULT_PASSWORDS_MATCH_VALIDATION_MESSAGE);
  });
});
