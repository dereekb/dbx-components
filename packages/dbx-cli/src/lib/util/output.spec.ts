import { describe, it, expect, beforeEach } from 'vitest';
import { CliError, buildErrorOutput, configureCliSecretPatterns, DEFAULT_CLI_SECRET_PATTERNS, sanitizeString } from './output';

describe('output util', () => {
  beforeEach(() => {
    configureCliSecretPatterns([...DEFAULT_CLI_SECRET_PATTERNS]);
  });

  describe('sanitizeString', () => {
    it('redacts Bearer tokens', () => {
      expect(sanitizeString('header: Bearer abc.123.xyz')).toBe('header: [REDACTED]');
    });

    it('redacts access_token assignments', () => {
      expect(sanitizeString('access_token=secret-value')).toBe('[REDACTED]');
    });

    it('redacts refresh_token and client_secret', () => {
      expect(sanitizeString('refresh_token=r1 and client_secret=s1')).toBe('[REDACTED] and [REDACTED]');
    });

    it('passes through unrelated strings', () => {
      expect(sanitizeString('hello world')).toBe('hello world');
    });

    it('honors configured patterns', () => {
      configureCliSecretPatterns([/api_key=\S+/g]);
      expect(sanitizeString('api_key=abc Bearer xyz')).toBe('[REDACTED] Bearer xyz');
    });
  });

  describe('buildErrorOutput', () => {
    it('builds an envelope from a CliError', () => {
      const err = new CliError({ message: 'no env', code: 'NO_ACTIVE_ENV', suggestion: 'env use <name>' });
      expect(buildErrorOutput(err)).toEqual({ ok: false, error: 'no env', code: 'NO_ACTIVE_ENV', suggestion: 'env use <name>' });
    });

    it('builds an envelope from a plain Error', () => {
      const result = buildErrorOutput(new Error('boom'));
      expect(result).toEqual({ ok: false, error: 'boom', code: 'ERROR' });
    });

    it('builds an envelope from a non-Error value', () => {
      const result = buildErrorOutput('weird');
      expect(result).toEqual({ ok: false, error: 'weird', code: 'UNKNOWN_ERROR' });
    });
  });
});
