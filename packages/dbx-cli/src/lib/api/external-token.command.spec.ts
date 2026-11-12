import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { type UserExternalConnectionAccessToken } from '@dereekb/firebase';
import { type CliContext, setCliContext } from '../context/cli.context';
import { DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR } from '../util/credential-process';
import { configureOutputOptions } from '../util/output';
import { buildExternalTokenCommand } from './external-token.command';

const RAW_ACCESS_TOKEN = '1000.raw-zoho-access-token-value';

const MINTED_TOKEN: UserExternalConnectionAccessToken = {
  uid: 'user-1',
  providerType: 'zoho_admin',
  accessToken: RAW_ACCESS_TOKEN,
  tokenType: 'Bearer',
  scopes: ['ZohoCRM.modules.ALL'],
  expiresAt: '2026-10-08T12:00:00.000Z',
  extra: { apiDomain: 'https://www.zohoapis.com' }
};

const HINTS = { recruitOrgId: '12345' };

function buildStubContext(): CliContext {
  return {
    cliName: 'demo-cli',
    envName: 'local',
    env: { apiBaseUrl: 'http://localhost/api/', oidcIssuer: 'http://localhost/oidc', externalConnectionHints: { zoho_admin: HINTS, zoho: { other: 'x' } } },
    accessToken: 'cli-access-token',
    callModel: (async () => undefined) as never,
    getModel: (async () => ({ key: '', data: null })) as never,
    getMultipleModels: (async () => ({ results: [], errors: [] })) as never
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('buildExternalTokenCommand()', () => {
  let stdout: string[] = [];
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let savedCredentialProcessEnv: string | undefined;

  async function runExternalToken(fetcher: typeof fetch, providerType = 'zoho_admin', extraArgs: string[] = []): Promise<void> {
    await yargs(['external-token', providerType, ...extraArgs])
      .command(buildExternalTokenCommand({ cliName: 'demo-cli', fetcher }))
      .exitProcess(false)
      .fail((msg: string, err: Error | undefined) => {
        throw err ?? new Error(msg);
      })
      .parseAsync();
  }

  beforeEach(() => {
    stdout = [];
    savedCredentialProcessEnv = process.env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR];
    delete process.env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR];
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      stdout.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((arg: any) => {
      stdout.push(`${String(arg)}\n`);
    });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null): never => {
      throw new Error(`process.exit:${code ?? 0}`);
    });
    setCliContext(buildStubContext());
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    setCliContext(undefined);
    configureOutputOptions({});

    if (savedCredentialProcessEnv == null) {
      delete process.env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR];
    } else {
      process.env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR] = savedCredentialProcessEnv;
    }
  });

  it('GETs the token endpoint for the provider with the Bearer access token', async () => {
    const fetcher = vi.fn(async () => jsonResponse(MINTED_TOKEN));
    await runExternalToken(fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost/api/session/external/zoho_admin');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer cli-access-token');
  });

  it('redacts the token when not run as a credential process', async () => {
    await runExternalToken((async () => jsonResponse(MINTED_TOKEN)) as unknown as typeof fetch);

    const output = stdout.join('');
    expect(output).not.toContain(RAW_ACCESS_TOKEN);

    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.meta.redacted).toBe(true);
    expect(parsed.data).toEqual({
      uid: 'user-1',
      providerType: 'zoho_admin',
      accessToken: '1000***',
      tokenType: 'Bearer',
      scopes: ['ZohoCRM.modules.ALL'],
      expiresAt: '2026-10-08T12:00:00.000Z',
      extra: { apiDomain: 'https://www.zohoapis.com' },
      hints: HINTS
    });
  });

  it('writes exactly one raw JSON line with the provider hints under a credential process', async () => {
    process.env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR] = '1';
    await runExternalToken((async () => jsonResponse(MINTED_TOKEN)) as unknown as typeof fetch);

    const output = stdout.join('');
    const lines = output.split('\n').filter((line) => line.length > 0);
    expect(lines).toHaveLength(1);
    expect(output.endsWith('\n')).toBe(true);
    expect(JSON.parse(lines[0])).toEqual({ ...MINTED_TOKEN, hints: HINTS });
  });

  it('omits hints when the env declares none for the provider', async () => {
    process.env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR] = '1';
    await runExternalToken((async () => jsonResponse({ ...MINTED_TOKEN, providerType: 'calcom' })) as unknown as typeof fetch, 'calcom');

    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.accessToken).toBe(RAW_ACCESS_TOKEN);
    expect(parsed.hints).toBeUndefined();
  });

  it('never dumps the raw token to --dump-dir under a credential process', async () => {
    const dumpDir = mkdtempSync(join(tmpdir(), 'dbx-cli-external-token-'));

    try {
      configureOutputOptions({ dumpDir, commandPath: ['external-token'] });
      process.env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR] = '1';
      await runExternalToken((async () => jsonResponse(MINTED_TOKEN)) as unknown as typeof fetch);

      expect(readdirSync(dumpDir)).toEqual([]);
    } finally {
      rmSync(dumpDir, { recursive: true, force: true });
    }
  });

  it('maps a refusal to an error envelope with the server message and a status-derived code', async () => {
    const fetcher = async () => jsonResponse({ statusCode: 403, message: '"zoho" access tokens may not be minted.', code: 'USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR' }, 403);

    await expect(runExternalToken(fetcher as unknown as typeof fetch, 'zoho')).rejects.toThrow('process.exit:1');

    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('AUTH_FORBIDDEN');
    expect(parsed.error).toContain('"zoho" access tokens may not be minted.');
    expect(parsed.error).toContain('USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR');
  });

  describe('--scopes', () => {
    it('sends the scopes space-delimited as the scopes query parameter', async () => {
      const fetcher = vi.fn(async () => jsonResponse(MINTED_TOKEN));
      await runExternalToken(fetcher as unknown as typeof fetch, 'microsoft', ['--scopes', 'User.Read,Mail.Read']);

      const [url] = fetcher.mock.calls[0] as unknown as [string];
      const parsed = new URL(url);
      expect(parsed.pathname).toBe('/api/session/external/microsoft');
      expect(parsed.searchParams.get('scopes')).toBe('User.Read Mail.Read');
    });

    it('sends no query when --scopes is blank', async () => {
      const fetcher = vi.fn(async () => jsonResponse(MINTED_TOKEN));
      await runExternalToken(fetcher as unknown as typeof fetch, 'zoho_admin', ['--scopes', ' ']);

      const [url] = fetcher.mock.calls[0] as unknown as [string];
      expect(url).toBe('http://localhost/api/session/external/zoho_admin');
    });

    it('suggests reconnecting with the preset named by a SCOPE_NOT_GRANTED refusal', async () => {
      const fetcher = async () =>
        jsonResponse({ statusCode: 403, message: 'The "microsoft" connection was not granted: Mail.ReadWrite.', code: 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_NOT_GRANTED_ERROR', data: { missingScopes: ['Mail.ReadWrite'], reconnectScopePreset: { key: 'readwrite', label: 'Read + Write' } } }, 403);

      await expect(runExternalToken(fetcher as unknown as typeof fetch, 'microsoft', ['--scopes', 'Mail.ReadWrite'])).rejects.toThrow('process.exit:1');

      const parsed = JSON.parse(stdout.join(''));
      expect(parsed.code).toBe('AUTH_FORBIDDEN');
      expect(parsed.suggestion).toContain('"Read + Write"');
    });

    it('suggests a narrower request or another login on a SCOPE_FORBIDDEN refusal', async () => {
      const fetcher = async () => jsonResponse({ statusCode: 403, message: 'Above the ceiling.', code: 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR' }, 403);

      await expect(runExternalToken(fetcher as unknown as typeof fetch, 'microsoft', ['--scopes', 'Mail.ReadWrite'])).rejects.toThrow('process.exit:1');

      const parsed = JSON.parse(stdout.join(''));
      expect(parsed.suggestion).toContain('--scopes');
      expect(parsed.suggestion).toContain('demo-cli auth login');
    });

    it('suggests fixing --scopes on an invalid or unsupported narrowing request', async () => {
      const fetcher = async () => jsonResponse({ statusCode: 400, message: 'Narrowing is not supported.', code: 'USER_EXTERNAL_CONNECTION_TOKEN_NARROWING_UNSUPPORTED_ERROR' }, 400);

      await expect(runExternalToken(fetcher as unknown as typeof fetch, 'zoho_admin', ['--scopes', 'ZohoCRM.modules.ALL'])).rejects.toThrow('process.exit:1');

      const parsed = JSON.parse(stdout.join(''));
      expect(parsed.suggestion).toContain('Drop `--scopes`');
    });
  });

  it('refuses a 2xx body without an access token, without echoing the body', async () => {
    const fetcher = async () => jsonResponse({ unexpected: 'secret-looking-value' });

    await expect(runExternalToken(fetcher as unknown as typeof fetch)).rejects.toThrow('process.exit:1');

    const output = stdout.join('');
    expect(output).not.toContain('secret-looking-value');
    expect(JSON.parse(output).code).toBe('API_ERROR');
  });
});
