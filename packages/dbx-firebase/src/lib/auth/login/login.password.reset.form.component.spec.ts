import { describe, expect, it } from 'vitest';
import { DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PATTERN, DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PLACEHOLDER } from './login.password.reset.form.component';

describe('DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PATTERN', () => {
  it('should match a six-digit code joined to a 28-character Firebase uid', () => {
    expect(DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PATTERN.test('482910-GLYl47OtfiYHlxh0293i8VLlbRx1')).toBe(true);
  });

  it('should match the default placeholder', () => {
    expect(DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PATTERN.test(DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PLACEHOLDER)).toBe(true);
  });

  it('should reject the code on its own', () => {
    expect(DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PATTERN.test('482910')).toBe(false);
  });

  it('should reject the uid on its own', () => {
    expect(DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PATTERN.test('GLYl47OtfiYHlxh0293i8VLlbRx1')).toBe(false);
  });

  it('should reject a non-numeric code', () => {
    expect(DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PATTERN.test('48291a-GLYl47OtfiYHlxh0293i8VLlbRx1')).toBe(false);
  });

  it('should reject surrounding whitespace', () => {
    expect(DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PATTERN.test(' 482910-GLYl47OtfiYHlxh0293i8VLlbRx1 ')).toBe(false);
  });
});
