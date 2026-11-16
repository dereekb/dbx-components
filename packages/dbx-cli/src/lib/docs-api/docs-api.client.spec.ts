import { describe, expect, it, vi } from 'vitest';
import { DOCS_NOT_FOUND_ERROR_CODE, DOCS_SECTION_NOT_FOUND_ERROR_CODE } from '@dereekb/firebase';
import { MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '../auth/auth-failure.hint';
import { CliError, CliHttpError } from '../util/output';
import { DOCS_API_NOT_AVAILABLE_ERROR_CODE, type DocsApiClientInput, describeDocsApiFailureSuggestion, listDocsOverHttp, readDocOverHttp, searchDocsOverHttp } from './docs-api.client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function clientInput(fetcher: typeof fetch, overrides?: Partial<DocsApiClientInput>): DocsApiClientInput {
  return { apiBaseUrl: 'http://localhost/api/', accessToken: 'cli-access-token', cliName: 'demo-cli', envName: 'local', fetcher, ...overrides };
}

async function captureError(promise: Promise<unknown>): Promise<CliError> {
  return (await promise.then(
    () => undefined,
    (e: unknown) => e
  )) as CliError;
}

describe('docs API client', () => {
  describe('requests', () => {
    it('lists the docs at <apiBaseUrl>/docs with the bearer header', async () => {
      const fetcher = vi.fn(async () => jsonResponse({ docs: [] }));
      const result = await listDocsOverHttp(clientInput(fetcher as unknown as typeof fetch));

      expect(result).toEqual({ docs: [] });
      const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('http://localhost/api/docs');
      expect(init.method).toBe('GET');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer cli-access-token');
    });

    it('searches with q and limit', async () => {
      const fetcher = vi.fn(async () => jsonResponse({ total: 0, results: [] }));
      await searchDocsOverHttp({ ...clientInput(fetcher as unknown as typeof fetch), query: 'guestbook signing', limit: 3 });

      const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('http://localhost/api/docs/search?q=guestbook+signing&limit=3');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer cli-access-token');
    });

    it('reads an id containing a slash, and a section', async () => {
      const fetcher = vi.fn(async () => jsonResponse({ id: 'guestbook/signing', title: 'Signing', content: '## Overview' }));
      await readDocOverHttp({ ...clientInput(fetcher as unknown as typeof fetch), id: 'guestbook/signing', section: 'overview' });

      const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('http://localhost/api/docs/read?id=guestbook%2Fsigning&section=overview');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer cli-access-token');
    });
  });

  describe('failures', () => {
    const scopeBody = { statusCode: 403, message: 'Missing required OIDC scope for /api/docs: hellosubs', code: MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE };

    it('rethrows a missing scope 403 as a plain CliError with a login suggestion', async () => {
      const fetcher = (async () => jsonResponse(scopeBody, 403)) as typeof fetch;
      const error = await captureError(listDocsOverHttp(clientInput(fetcher, { scope: 'openid profile' })));

      expect(error).toBeInstanceOf(CliError);
      expect(error).not.toBeInstanceOf(CliHttpError);
      expect(error.code).toBe('AUTH_FORBIDDEN');
      expect(error.serverCode).toBe(MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE);
      expect(error.message).toContain('hellosubs');
      expect(error.suggestion).toContain('It carries `openid profile`.');
      expect(error.suggestion).toContain('--env local');
      expect(error.suggestion).toContain('demo-cli auth login --env local');
    });

    it('suggests re-minting a handoff credential on a missing scope 403', async () => {
      const fetcher = (async () => jsonResponse(scopeBody, 403)) as typeof fetch;
      const error = await captureError(listDocsOverHttp(clientInput(fetcher, { credential: { handoff: true, refreshable: false } })));

      expect(error.suggestion).toContain('auth handoff <code> --env local');
      expect(error.suggestion).toContain('`scopes` unset');
    });

    it('explains audiences on a DOCS_NOT_FOUND 404', async () => {
      const fetcher = (async () => jsonResponse({ statusCode: 404, message: 'No doc with id "x".', code: DOCS_NOT_FOUND_ERROR_CODE }, 404)) as typeof fetch;
      const error = await captureError(readDocOverHttp({ ...clientInput(fetcher), id: 'x' }));

      expect(error).not.toBeInstanceOf(CliHttpError);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.serverCode).toBe(DOCS_NOT_FOUND_ERROR_CODE);
      expect(error.suggestion).toContain('audience');
      expect(error.suggestion).toContain('demo-cli docs list');
    });

    it('names the doc on a DOCS_SECTION_NOT_FOUND 404', async () => {
      const fetcher = (async () => jsonResponse({ statusCode: 404, message: 'Doc "a/b" has no section "z".', code: DOCS_SECTION_NOT_FOUND_ERROR_CODE }, 404)) as typeof fetch;
      const error = await captureError(readDocOverHttp({ ...clientInput(fetcher), id: 'a/b', section: 'z' }));

      expect(error.serverCode).toBe(DOCS_SECTION_NOT_FOUND_ERROR_CODE);
      expect(error.suggestion).toContain('demo-cli docs read a/b');
    });

    it('maps a 404 without a docs code to DOCS_API_NOT_AVAILABLE', async () => {
      const fetcher = (async () => jsonResponse({ statusCode: 404, message: 'Cannot GET /api/docs' }, 404)) as typeof fetch;
      const error = await captureError(listDocsOverHttp(clientInput(fetcher)));

      expect(error.code).toBe(DOCS_API_NOT_AVAILABLE_ERROR_CODE);
      expect(error.serverCode).toBeUndefined();
      expect(error.suggestion).toContain('has not mounted the docs API');
      expect(error.suggestion).toContain('http://localhost/api/');
    });

    it('suggests logging in again on a 401', async () => {
      const fetcher = (async () => jsonResponse({ message: 'Unauthorized' }, 401)) as typeof fetch;
      const error = await captureError(listDocsOverHttp(clientInput(fetcher)));

      expect(error.code).toBe('AUTH_UNAUTHORIZED');
      expect(error.suggestion).toContain('demo-cli auth login --env local');
    });
  });
});

describe('describeDocsApiFailureSuggestion()', () => {
  const base = { cliName: 'demo-cli', envName: 'local' };

  it.each([
    [{ status: 401 }, 'auth login --env local'],
    [{ status: 403, serverCode: MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE }, 'docs API requires an OIDC scope this login lacks'],
    [{ status: 403, serverCode: 'SOMETHING_ELSE' }, 'lacks the role or permission'],
    [{ status: 404, serverCode: DOCS_NOT_FOUND_ERROR_CODE }, 'demo-cli docs list'],
    [{ status: 404, serverCode: DOCS_SECTION_NOT_FOUND_ERROR_CODE, docId: 'a/b' }, 'demo-cli docs read a/b'],
    [{ status: 404 }, 'has not mounted the docs API'],
    [{ status: 404, serverCode: DOCS_NOT_FOUND_ERROR_CODE, commandName: 'app-docs' }, 'demo-cli app-docs list']
  ])('for %o suggests %s', (input, expected) => {
    expect(describeDocsApiFailureSuggestion({ ...base, ...input })).toContain(expected);
  });

  it('returns undefined for a status it has no remediation for', () => {
    expect(describeDocsApiFailureSuggestion({ ...base, status: 500 })).toBeUndefined();
  });
});
