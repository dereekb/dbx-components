import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { CliError, CliHttpError, buildErrorOutput, cliCollectionPickApplier, configureCliSecretPatterns, configureOutputOptions, DEFAULT_CLI_HTTP_TIMEOUT_MS, DEFAULT_CLI_SECRET_PATTERNS, getCliTimeoutMs, outputResult, sanitizeString, setCliTimeoutMs, tracedFetch } from './output';

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

  describe('outputResult pick', () => {
    function captureOutput(fn: () => void): any {
      const original = console.log;
      let captured = '';
      console.log = (value: string) => {
        captured = value;
      };

      try {
        fn();
      } finally {
        console.log = original;
      }

      return JSON.parse(captured);
    }

    afterEach(() => {
      configureOutputOptions({});
    });

    it('picks top-level fields when the command supplies no applyPick', () => {
      configureOutputOptions({ pick: 'a' });
      const output = captureOutput(() => outputResult({ a: 1, b: 2 }));
      expect(output.data).toEqual({ a: 1 });
    });

    it('routes the pick into the document payload of a { key, data } read envelope', () => {
      configureOutputOptions({ pick: 'n' });
      const result = { key: 'pr/abc', data: { uid: 'abc', n: 'Name', extra: 'drop-me' } };
      const output = captureOutput(() => outputResult(result, undefined, { applyPick: (r, pick) => ({ ...r, data: pick(r.data) }) }));

      // The wrapper survives and the document is reduced — picking document fields against the
      // wrapper would have emitted `{}`, which reads as an empty document.
      expect(output.data.key).toBe('pr/abc');
      expect(output.data.data).toEqual({ n: 'Name' });
    });

    it('routes the pick into every entry of a { results, errors } read envelope', () => {
      configureOutputOptions({ pick: 'n' });
      const result = {
        results: [
          { key: 'pr/a', data: { uid: 'a', n: 'A', extra: 1 } },
          { key: 'pr/b', data: { uid: 'b', n: 'B', extra: 2 } }
        ],
        errors: [{ key: 'pr/c', error: 'nope' }]
      };
      const output = captureOutput(() => outputResult(result, undefined, { applyPick: (r, pick) => ({ ...r, results: r.results.map((entry) => ({ ...entry, data: pick(entry.data) })) }) }));

      expect(output.data.results).toEqual([
        { key: 'pr/a', data: { n: 'A' } },
        { key: 'pr/b', data: { n: 'B' } }
      ]);
      expect(output.data.errors).toEqual([{ key: 'pr/c', error: 'nope' }]);
    });

    it('leaves the result untouched when no pick is configured', () => {
      configureOutputOptions({});
      const result = { key: 'pr/abc', data: { uid: 'abc', n: 'Name' } };
      const output = captureOutput(() => outputResult(result, undefined, { applyPick: (r, pick) => ({ ...r, data: pick(r.data) }) }));
      expect(output.data).toEqual(result);
    });

    describe('cliCollectionPickApplier', () => {
      const page = {
        '@odata.context': 'c',
        value: [
          { id: '1', subject: 's' },
          { id: '2', subject: 't' }
        ],
        '@odata.nextLink': 'n'
      };

      it('picks each item under the items key and keeps the page fields', () => {
        configureOutputOptions({ pick: 'id' });
        const output = captureOutput(() => outputResult(page, undefined, { applyPick: cliCollectionPickApplier('value') }));
        expect(output.data).toEqual({ '@odata.context': 'c', value: [{ id: '1' }, { id: '2' }], '@odata.nextLink': 'n' });
      });

      it('picks at the top level when the items key holds no array', () => {
        configureOutputOptions({ pick: 'id' });
        const output = captureOutput(() => outputResult({ id: '1', subject: 's', value: 'x' }, undefined, { applyPick: cliCollectionPickApplier('value') }));
        expect(output.data).toEqual({ id: '1' });
      });

      it('maps a bare array per item', () => {
        configureOutputOptions({ pick: 'id' });
        const output = captureOutput(() => outputResult([{ id: '1', subject: 's' }], undefined, { applyPick: cliCollectionPickApplier('value') }));
        expect(output.data).toEqual([{ id: '1' }]);
      });
    });

    describe('no-match warning', () => {
      function captureWarning(fn: () => void): { readonly output: any; readonly warnings: string[] } {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
          const output = captureOutput(fn);
          return { output, warnings: spy.mock.calls.map((x) => String(x[0])) };
        } finally {
          spy.mockRestore();
        }
      }

      it('warns on stderr, naming the available fields, when the pick matches nothing', () => {
        configureOutputOptions({ pick: 'nope' });
        const { output, warnings } = captureWarning(() => outputResult({ a: 1 }));
        expect(output.data).toEqual({});
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('matched no fields');
        expect(warnings[0]).toContain('a');
      });

      it('warns when the pick matches no field of any collection item', () => {
        configureOutputOptions({ pick: 'nope' });
        const { warnings } = captureWarning(() => outputResult({ value: [{ id: '1' }] }, undefined, { applyPick: cliCollectionPickApplier('value') }));
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('id');
      });

      it('does not warn when the pick matches', () => {
        configureOutputOptions({ pick: 'a' });
        expect(captureWarning(() => outputResult({ a: 1, b: 2 })).warnings).toHaveLength(0);
      });

      it('does not warn for an empty array, primitives, or no pick', () => {
        configureOutputOptions({ pick: 'a' });
        expect(captureWarning(() => outputResult([])).warnings).toHaveLength(0);
        expect(captureWarning(() => outputResult('text')).warnings).toHaveLength(0);
        configureOutputOptions({});
        expect(captureWarning(() => outputResult({ a: 1 })).warnings).toHaveLength(0);
      });

      it('leaves meta untouched', () => {
        configureOutputOptions({ pick: 'a' });
        const { output } = captureWarning(() => outputResult({ a: 1, b: 2 }, { count: 2 }));
        expect(output.meta).toEqual({ count: 2 });
      });
    });
  });

  describe('serverCode and data in the error envelope', () => {
    it('prints serverCode and data for a CliError carrying them', () => {
      const output = buildErrorOutput(new CliError({ message: 'm', code: 'AUTH_FORBIDDEN', serverCode: 'SERVER_CODE', suggestion: 's', data: { report: true } }));
      expect(output).toEqual({ ok: false, error: 'm', code: 'AUTH_FORBIDDEN', serverCode: 'SERVER_CODE', suggestion: 's', data: { report: true } });
      expect(Object.keys(output)).toEqual(['ok', 'error', 'code', 'serverCode', 'suggestion', 'data']);
    });

    it('omits serverCode and data when unset', () => {
      const output = buildErrorOutput(new CliError({ message: 'm', code: 'X' }));
      expect(output).not.toHaveProperty('serverCode');
      expect(output).not.toHaveProperty('data');
    });

    it('a CliHttpError keeps its status and prints its serverCode', () => {
      const error = new CliHttpError({ message: 'm', code: 'AUTH_FORBIDDEN', status: 403, serverCode: 'MISSING_ENDPOINT_OIDC_SCOPE_ERROR' });
      expect(error.status).toBe(403);
      expect(error.serverCode).toBe('MISSING_ENDPOINT_OIDC_SCOPE_ERROR');
      expect(buildErrorOutput(error)).toMatchObject({ code: 'AUTH_FORBIDDEN', serverCode: 'MISSING_ENDPOINT_OIDC_SCOPE_ERROR' });
    });
  });
});
