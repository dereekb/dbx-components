import { describe, it, expect } from 'vitest';
import { forgeTextPasswordField, forgeTextVerifyPasswordField, forgeUsernamePasswordLoginFields, forgeUsernameLoginField } from './login';

// MARK: forgeTextPasswordField
describe('forgeTextPasswordField()', () => {
  it('should create an input field', () => {
    const field = forgeTextPasswordField();
    expect(field.type).toBe('input');
  });

  it('should default key to password', () => {
    const field = forgeTextPasswordField();
    expect(field.key).toBe('password');
  });

  it('should default label to Password', () => {
    const field = forgeTextPasswordField();
    expect(field.label).toBe('Password');
  });

  it('should use password input type', () => {
    const field = forgeTextPasswordField();
    expect(field.props?.type).toBe('password');
  });

  it('should be required by default', () => {
    const field = forgeTextPasswordField();
    expect(field.required).toBe(true);
  });

  it('should allow overriding the key', () => {
    const field = forgeTextPasswordField({ key: 'pin' });
    expect(field.key).toBe('pin');
  });

  it('should allow overriding the label', () => {
    const field = forgeTextPasswordField({ label: 'PIN' });
    expect(field.label).toBe('PIN');
  });
});

// MARK: forgeTextVerifyPasswordField
describe('forgeTextVerifyPasswordField()', () => {
  it('should create an input field', () => {
    const field = forgeTextVerifyPasswordField();
    expect(field.type).toBe('input');
  });

  it('should default key to verifyPassword', () => {
    const field = forgeTextVerifyPasswordField();
    expect(field.key).toBe('verifyPassword');
  });

  it('should default label to Verify Password', () => {
    const field = forgeTextVerifyPasswordField();
    expect(field.label).toBe('Verify Password');
  });

  it('should use password input type', () => {
    const field = forgeTextVerifyPasswordField();
    expect(field.props?.type).toBe('password');
  });

  it('should be required by default', () => {
    const field = forgeTextVerifyPasswordField();
    expect(field.required).toBe(true);
  });

  it('should allow overriding the key', () => {
    const field = forgeTextVerifyPasswordField({ key: 'confirmPin' });
    expect(field.key).toBe('confirmPin');
  });

  it('should allow overriding the label', () => {
    const field = forgeTextVerifyPasswordField({ label: 'Confirm PIN' });
    expect(field.label).toBe('Confirm PIN');
  });
});

// MARK: forgeUsernameLoginField
describe('forgeUsernameLoginField()', () => {
  it('should create an email input field when configured with email string', () => {
    const field = forgeUsernameLoginField('email');
    expect(field.type).toBe('input');
    expect(field.key).toBe('username');
    expect(field.props?.type).toBe('email');
  });

  it('should create a text input field when configured with username string', () => {
    const field = forgeUsernameLoginField('username');
    expect(field.type).toBe('input');
    expect(field.key).toBe('username');
    expect(field.props?.type).toBe('text');
  });

  it('should set required when using email shorthand', () => {
    const field = forgeUsernameLoginField('email');
    expect(field.required).toBe(true);
  });

  it('should set required when using username shorthand', () => {
    const field = forgeUsernameLoginField('username');
    expect(field.required).toBe(true);
  });

  it('should use email config when provided as object', () => {
    const field = forgeUsernameLoginField({ email: { required: true, label: 'Your Email' } });
    expect(field.key).toBe('username');
    expect(field.props?.type).toBe('email');
    expect(field.label).toBe('Your Email');
  });

  it('should use username config when provided as object', () => {
    const field = forgeUsernameLoginField({ username: { required: true, label: 'Your Username' } });
    expect(field.key).toBe('username');
    expect(field.label).toBe('Your Username');
  });
});

// MARK: forgeUsernamePasswordLoginFields
describe('forgeUsernamePasswordLoginFields()', () => {
  it('should return an array of two fields', () => {
    const fields = forgeUsernamePasswordLoginFields({ username: 'email' });
    expect(fields.length).toBe(2);
  });

  it('should have the username field first and password field second', () => {
    const fields = forgeUsernamePasswordLoginFields({ username: 'email' });
    expect(fields[0].key).toBe('username');
    expect(fields[1].key).toBe('password');
  });

  it('should create email-based username when configured with email', () => {
    const fields = forgeUsernamePasswordLoginFields({ username: 'email' });
    expect(fields[0].props?.type).toBe('email');
  });

  it('should create text-based username when configured with username', () => {
    const fields = forgeUsernamePasswordLoginFields({ username: 'username' });
    expect(fields[0].props?.type).toBe('text');
  });

  it('should create a password field with password input type', () => {
    const fields = forgeUsernamePasswordLoginFields({ username: 'email' });
    expect(fields[1].props?.type).toBe('password');
  });

  it('should propagate password config', () => {
    const fields = forgeUsernamePasswordLoginFields({ username: 'email', password: { label: 'Secret' } });
    expect(fields[1].label).toBe('Secret');
  });
});
