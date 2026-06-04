import { describe, it, expect, beforeEach } from 'vitest';
import { CliError, buildErrorOutput, configureCliSecretPatterns, DEFAULT_CLI_HTTP_TIMEOUT_MS, DEFAULT_CLI_SECRET_PATTERNS, getCliTimeoutMs, sanitizeString, setCliTimeoutMs, tracedFetch } from './output';

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

  describe('tracedFetch timeout', () => {
    beforeEach(() => {
      setCliTimeoutMs(undefined); // reset to the default between cases
    });

    it('defaults to DEFAULT_CLI_HTTP_TIMEOUT_MS when no explicit timeout is set', () => {
      expect(getCliTimeoutMs()).toBe(DEFAULT_CLI_HTTP_TIMEOUT_MS);
    });

    it('arms an abort signal by default (no --timeout flag)', async () => {
      let capturedSignal: AbortSignal | null | undefined;
      const fetcher = (async (_input: unknown, init?: RequestInit) => {
        capturedSignal = init?.signal;
        return new Response('ok');
      }) as typeof fetch;

      await tracedFetch(fetcher, 'http://localhost/api');
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
    });

    it('aborts a hanging request and throws a TIMEOUT CliError', async () => {
      setCliTimeoutMs(20);
      const hangingFetcher = ((_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })) as typeof fetch;

      await expect(tracedFetch(hangingFetcher, 'http://localhost/api')).rejects.toMatchObject({ code: 'TIMEOUT' });
    });

    it('does not arm an abort signal when the timeout is disabled with 0', async () => {
      setCliTimeoutMs(0);
      let capturedSignal: AbortSignal | null | undefined;
      const fetcher = (async (_input: unknown, init?: RequestInit) => {
        capturedSignal = init?.signal;
        return new Response('ok');
      }) as typeof fetch;

      await tracedFetch(fetcher, 'http://localhost/api');
      expect(capturedSignal).toBeUndefined();
    });
  });
});
