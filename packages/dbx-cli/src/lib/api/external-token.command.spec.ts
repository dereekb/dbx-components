import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { type UserExternalConnectionAccessToken } from '@dereekb/firebase';
import { type CliContext, setCliContext } from '../context/cli.context';
import { DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR } from '../util/credential-process';
import { configureOutputOptions } from '../util/output';
import { type CliExternalConnectionDataAdapters, passthroughCliExternalConnectionDataAdapter } from './external-connection-data';
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

function buildStubContext(overrides?: Pick<CliContext, 'credential' | 'scope'>): CliContext {
  return {
    cliName: 'demo-cli',
    envName: 'local',
    env: { apiBaseUrl: 'http://localhost/api/', oidcIssuer: 'http://localhost/oidc', externalConnectionHints: { zoho_admin: HINTS, zoho: { other: 'x' } } },
    accessToken: 'cli-access-token',
    ...overrides,
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

  async function runExternalToken(fetcher: typeof fetch, providerType = 'zoho_admin', dataAdapters?: CliExternalConnectionDataAdapters): Promise<void> {
    await yargs(['external-token', providerType])
      .command(buildExternalTokenCommand({ cliName: 'demo-cli', fetcher, dataAdapters }))
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
    expect(parsed.serverCode).toBe('USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR');
  });

  it('suggests another login or a smaller connection on a SCOPE_FORBIDDEN refusal', async () => {
    const fetcher = async () => jsonResponse({ statusCode: 403, message: 'The "microsoft" connection was granted scopes this client may not mint: Mail.ReadWrite.', code: 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR', data: { providerType: 'microsoft', excessScopes: ['Mail.ReadWrite'] } }, 403);

    await expect(runExternalToken(fetcher as unknown as typeof fetch, 'microsoft')).rejects.toThrow('process.exit:1');

    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.code).toBe('AUTH_FORBIDDEN');
    expect(parsed.suggestion).toContain('demo-cli auth login');
    expect(parsed.suggestion).toContain('narrower access level');
    expect(parsed.suggestion).not.toContain('--scopes');
  });

  it('tells a handoff credential to re-mint, never to log in, on a SCOPE_FORBIDDEN refusal', async () => {
    setCliContext(buildStubContext({ credential: { handoff: true, refreshable: false, expiresAt: Date.now() + 60 * 60 * 1000 }, scope: 'openid token.external token.external.microsoft_read' }));
    const fetcher = async () => jsonResponse({ statusCode: 403, message: 'The "microsoft" connection was granted scopes this client may not mint: Mail.ReadWrite.', code: 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR', data: { providerType: 'microsoft', excessScopes: ['Mail.ReadWrite'] } }, 403);

    await expect(runExternalToken(fetcher as unknown as typeof fetch, 'microsoft')).rejects.toThrow('process.exit:1');

    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.code).toBe('AUTH_FORBIDDEN');
    expect(parsed.serverCode).toBe('USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR');
    expect(parsed.suggestion).toContain('_cli_token');
    expect(parsed.suggestion).toContain('demo-cli auth handoff <code> --env local');
    expect(parsed.suggestion).not.toContain('auth login');
  });

  it('tells a login credential to log in again on a 401', async () => {
    const fetcher = async () => jsonResponse({ statusCode: 401, message: 'Unauthorized' }, 401);

    await expect(runExternalToken(fetcher as unknown as typeof fetch, 'microsoft')).rejects.toThrow('process.exit:1');

    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.code).toBe('AUTH_UNAUTHORIZED');
    expect(parsed.suggestion).toContain('demo-cli auth login --env local');
  });

  it('refuses a 2xx body without an access token, without echoing the body', async () => {
    const fetcher = async () => jsonResponse({ unexpected: 'secret-looking-value' });

    await expect(runExternalToken(fetcher as unknown as typeof fetch)).rejects.toThrow('process.exit:1');

    const output = stdout.join('');
    expect(output).not.toContain('secret-looking-value');
    expect(JSON.parse(output).code).toBe('API_ERROR');
  });

  describe('connection data', () => {
    const SIGNATURE_SENTINEL = 'sentinel-signature-value-1234';
    const STORED_DATA = { mail_signature: { me: { html: `<p>${SIGNATURE_SENTINEL}</p>` }, 'support@example.com': { text: SIGNATURE_SENTINEL } }, other_type: { x: { y: 1 } } };
    const MICROSOFT_TOKEN = { ...MINTED_TOKEN, providerType: 'microsoft' };
    const ADAPTERS: CliExternalConnectionDataAdapters = { microsoft: passthroughCliExternalConnectionDataAdapter({ dataTypes: ['mail_signature'] }) };
    let stderr: string[] = [];
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stderr = [];
      stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
        stderr.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      });
    });

    afterEach(() => {
      stderrSpy.mockRestore();
    });

    it('asks for ?include=data only for a provider with an adapter', async () => {
      const fetcher = vi.fn(async () => jsonResponse(MICROSOFT_TOKEN));
      await runExternalToken(fetcher as unknown as typeof fetch, 'microsoft', ADAPTERS);
      await runExternalToken(fetcher as unknown as typeof fetch, 'zoho_admin', ADAPTERS);
      await runExternalToken(fetcher as unknown as typeof fetch, 'microsoft');

      const urls = fetcher.mock.calls.map((call) => (call as unknown as [string])[0]);
      expect(urls).toEqual(['http://localhost/api/session/external/microsoft?include=data', 'http://localhost/api/session/external/zoho_admin', 'http://localhost/api/session/external/microsoft']);
    });

    it('never asks for data for a provider named like an Object prototype key', async () => {
      const fetcher = vi.fn(async () => jsonResponse({ ...MINTED_TOKEN, providerType: 'constructor' }));
      await runExternalToken(fetcher as unknown as typeof fetch, 'constructor', ADAPTERS);

      expect((fetcher.mock.calls[0] as unknown as [string])[0]).toBe('http://localhost/api/session/external/constructor');
    });

    it('writes the adapter settings, never the raw data, on the credential-process line', async () => {
      process.env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR] = '1';
      await runExternalToken((async () => jsonResponse({ ...MICROSOFT_TOKEN, data: STORED_DATA })) as unknown as typeof fetch, 'microsoft', ADAPTERS);

      const lines = stdout
        .join('')
        .split('\n')
        .filter((line) => line.length > 0);
      expect(lines).toHaveLength(1);
      const bundle = JSON.parse(lines[0]);
      expect(bundle.data).toBeUndefined();
      expect(bundle.settings).toEqual({ mail_signature: STORED_DATA.mail_signature });
      expect(lines[0]).not.toContain('other_type');
    });

    it('omits settings when the token carries no data', async () => {
      process.env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR] = '1';
      await runExternalToken((async () => jsonResponse(MICROSOFT_TOKEN)) as unknown as typeof fetch, 'microsoft', ADAPTERS);

      const bundle = JSON.parse(stdout.join(''));
      expect(bundle.settings).toBeUndefined();
      expect(bundle.accessToken).toBe(RAW_ACCESS_TOKEN);
    });

    it('drops raw data even for a provider without an adapter', async () => {
      process.env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR] = '1';
      await runExternalToken((async () => jsonResponse({ ...MICROSOFT_TOKEN, data: STORED_DATA })) as unknown as typeof fetch, 'microsoft');

      const output = stdout.join('');
      expect(output).not.toContain(SIGNATURE_SENTINEL);
      expect(JSON.parse(output).settings).toBeUndefined();
    });

    it('warns once on stderr and still mints when the adapter throws', async () => {
      process.env[DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR] = '1';
      const throwing: CliExternalConnectionDataAdapters = {
        microsoft: {
          unpack: () => {
            throw new Error(SIGNATURE_SENTINEL);
          }
        }
      };

      await runExternalToken((async () => jsonResponse({ ...MICROSOFT_TOKEN, data: STORED_DATA })) as unknown as typeof fetch, 'microsoft', throwing);

      const bundle = JSON.parse(stdout.join(''));
      expect(bundle.accessToken).toBe(RAW_ACCESS_TOKEN);
      expect(bundle.settings).toBeUndefined();
      expect(stderr).toEqual(['external-token: could not apply connection defaults for "microsoft".\n']);
    });

    it('prints only the settings keys when redacted', async () => {
      await runExternalToken((async () => jsonResponse({ ...MICROSOFT_TOKEN, data: STORED_DATA })) as unknown as typeof fetch, 'microsoft', ADAPTERS);

      const output = stdout.join('');
      expect(output).not.toContain(SIGNATURE_SENTINEL);
      expect(output).not.toContain(RAW_ACCESS_TOKEN);
      expect(JSON.parse(output).data.settings).toEqual({ mail_signature: ['me', 'support@example.com'] });
    });
  });
});
