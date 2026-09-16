import type { Argv, CommandModule } from 'yargs';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

// Shared spies, hoisted so the vi.mock factories can reference them.
const h = vi.hoisted(() => ({
  getMock: vi.fn(),
  setMock: vi.fn(),
  removeMock: vi.fn(),
  userInfoMock: vi.fn(),
  sessionInfoMock: vi.fn(),
  outputResultMock: vi.fn(),
  outputErrorMock: vi.fn(),
  resolveEnvMock: vi.fn(),
  loadConfigMock: vi.fn(),
  mergeConfigMock: vi.fn(),
  promptLineMock: vi.fn(),
  claimHandoffMock: vi.fn()
}));

vi.mock('../config/token.cache', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, createCliTokenCacheStore: () => ({ get: h.getMock, set: h.setMock, remove: h.removeMock }) };
});

vi.mock('./oidc.client', () => ({
  discoverOidcMetadata: vi.fn(async () => ({ issuer: 'http://x/oidc', userinfo_endpoint: 'http://x/oidc/me' })),
  fetchUserInfo: h.userInfoMock,
  fetchSessionInfo: h.sessionInfoMock,
  exchangeAuthorizationCode: vi.fn(),
  refreshAccessToken: vi.fn(),
  revokeToken: vi.fn()
}));

vi.mock('../util/output', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, outputResult: h.outputResultMock, outputError: h.outputErrorMock };
});

vi.mock('../config/env.resolve', () => ({
  resolveCliEnvOrThrow: h.resolveEnvMock
}));

vi.mock('../config/cli.config', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, loadCliConfig: h.loadConfigMock, mergeCliConfig: h.mergeConfigMock };
});

vi.mock('../util/interactive', () => ({ promptLine: h.promptLineMock }));

vi.mock('./cli-handoff.client', () => ({ claimCliHandoff: h.claimHandoffMock }));

import { cliIssuersMatch, createAuthCommand, DEFAULT_HANDOFF_ENV_NAME } from './auth.command.factory';

const COMPLETE_ENV = { apiBaseUrl: 'http://x/api', oidcIssuer: 'http://x/oidc', clientId: 'id', clientSecret: 'secret', redirectUri: 'urn:cb' };
const SESSION_EXPIRES_AT_SECONDS = 4102444800; // 2100-01-01, far enough out that the grant is unambiguously alive.

/**
 * Collects the subcommands the `auth` builder registers so a single subcommand can be driven directly.
 */
function readAuthSubcommand(name: string): CommandModule {
  const registered: CommandModule[] = [];
  const fakeYargs = {
    command: (module: CommandModule) => {
      registered.push(module);
      return fakeYargs;
    },
    option: () => fakeYargs,
    demandCommand: () => fakeYargs
  };

  const authCommand = createAuthCommand({ cliName: 'demo-cli', envVarName: 'DEMO_CLI_ENV' });
  (authCommand.builder as (yargs: Argv) => Argv)(fakeYargs as unknown as Argv);

  const result = registered.find((x) => x.command === name);

  if (!result) {
    throw new Error(`No "${name}" subcommand was registered.`);
  }

  return result;
}

function runStatus(): Promise<void> {
  const statusCommand = readAuthSubcommand('status');
  return (statusCommand.handler as (argv: unknown) => Promise<void>)({ _: ['auth', 'status'], env: 'prod' });
}

function runSetup(argv: Record<string, unknown>): Promise<void> {
  const setupCommand = readAuthSubcommand('setup');
  return (setupCommand.handler as (argv: unknown) => Promise<void>)({ _: ['auth', 'setup'], env: 'prod', ...argv });
}

/**
 * Reads back the env `setup` persisted, so a test asserts what was written rather than what was printed.
 */
function savedEnv(): Record<string, unknown> {
  return h.mergeConfigMock.mock.calls[0][0].updates.envs['prod'];
}

describe('createAuthCommand setup', () => {
  beforeEach(() => {
    h.loadConfigMock.mockReset();
    h.mergeConfigMock.mockReset();
    h.promptLineMock.mockReset();
    h.outputResultMock.mockReset();
    h.loadConfigMock.mockResolvedValue({ envs: {} });
    h.mergeConfigMock.mockResolvedValue({ envs: {} });
    // Any prompt that fires in these tests is a bug, so make one loud rather than silently empty.
    h.promptLineMock.mockRejectedValue(new Error('unexpected interactive prompt'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const BASE = { apiBaseUrl: 'http://x/api', oidcIssuer: 'http://x/oidc', clientId: 'id', redirectUri: 'urn:cb' };

  it('should save a public client without prompting for a secret when the auth method is none', async () => {
    await runSetup({ ...BASE, tokenEndpointAuthMethod: 'none' });

    expect(h.promptLineMock).not.toHaveBeenCalled();
    const env = savedEnv();
    expect(env['clientSecret']).toBeUndefined();
    expect(env['tokenEndpointAuthMethod']).toBe('none');
  });

  it('should drop a previously-stored secret once the client is declared public', async () => {
    // The conversion a confidential client goes through, which is where a kept secret would start
    // failing client authentication against a provider that now expects none.
    h.loadConfigMock.mockResolvedValue({ envs: { prod: { ...BASE, clientSecret: 'stale' } } });

    await runSetup({ tokenEndpointAuthMethod: 'none' });

    expect(h.promptLineMock).not.toHaveBeenCalled();
    expect(savedEnv()['clientSecret']).toBeUndefined();
  });

  it('should clear a stored secret when an explicitly empty flag is passed', async () => {
    h.loadConfigMock.mockResolvedValue({ envs: { prod: { ...BASE, clientSecret: 'stale' } } });

    await runSetup({ clientSecret: '' });

    expect(savedEnv()['clientSecret']).toBeUndefined();
  });

  it('should keep a stored secret when the flag is absent', async () => {
    h.loadConfigMock.mockResolvedValue({ envs: { prod: { ...BASE, clientSecret: 'kept' } } });

    await runSetup({});

    expect(savedEnv()['clientSecret']).toBe('kept');
  });

  it('should not require a client secret to complete setup', async () => {
    // Previously threw AUTH_SETUP_INCOMPLETE, which made a public client unconfigurable.
    await runSetup({ ...BASE, clientSecret: '' });

    expect(h.outputErrorMock).not.toHaveBeenCalled();
    expect(h.mergeConfigMock).toHaveBeenCalledTimes(1);
  });
});

describe('createAuthCommand status', () => {
  beforeEach(() => {
    h.getMock.mockReset();
    h.userInfoMock.mockReset();
    h.sessionInfoMock.mockReset();
    h.outputResultMock.mockReset();
    h.outputErrorMock.mockReset();
    h.resolveEnvMock.mockReset();
    h.resolveEnvMock.mockResolvedValue({ envName: 'prod', env: COMPLETE_ENV });
    h.sessionInfoMock.mockResolvedValue({ expiresAt: SESSION_EXPIRES_AT_SECONDS, rotationDisabled: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('with an expired access token', () => {
    beforeEach(() => {
      h.getMock.mockResolvedValue({ accessToken: 'dead', refreshToken: 'refresh', expiresAt: Date.now() - 1000, sessionExpiresAt: SESSION_EXPIRES_AT_SECONDS });
    });

    it('should report the still-valid session instead of failing on a predictable 401', async () => {
      await runStatus();

      expect(h.outputErrorMock).not.toHaveBeenCalled();
      expect(h.outputResultMock).toHaveBeenCalledTimes(1);

      const result = h.outputResultMock.mock.calls[0][0];
      expect(result.expired).toBe(true);
      expect(result.authenticated).toBe(false);
      expect(result.sessionExpiresAt).toBe(SESSION_EXPIRES_AT_SECONDS);
      expect(result.session).toContain('valid until');
      expect(result.suggestion).toContain('refreshes automatically');
    });

    it('should not call userinfo, since an expired token is certain to be rejected', async () => {
      await runStatus();
      expect(h.userInfoMock).not.toHaveBeenCalled();
    });
  });

  describe('with a live access token', () => {
    beforeEach(() => {
      // Comfortably beyond `isTokenExpired`'s 60s skew buffer, which would otherwise read as expired.
      h.getMock.mockResolvedValue({ accessToken: 'live', refreshToken: 'refresh', expiresAt: Date.now() + 600000, sessionExpiresAt: SESSION_EXPIRES_AT_SECONDS });
    });

    it('should report the userinfo claims', async () => {
      h.userInfoMock.mockResolvedValue({ sub: 'user-1', email: 'a@b.co' });

      await runStatus();

      const result = h.outputResultMock.mock.calls[0][0];
      expect(h.userInfoMock).toHaveBeenCalledTimes(1);
      expect(result.authenticated).toBe(true);
      expect(result.expired).toBe(false);
      expect(result.sub).toBe('user-1');
      expect(result.suggestion).toBeUndefined();
    });

    it('should still report local state when userinfo rejects the token', async () => {
      h.userInfoMock.mockRejectedValue(new Error('401 Unauthorized'));

      await runStatus();

      expect(h.outputErrorMock).not.toHaveBeenCalled();
      expect(h.outputResultMock).toHaveBeenCalledTimes(1);

      const result = h.outputResultMock.mock.calls[0][0];
      expect(result.claims).toBeUndefined();
      expect(result.sub).toBeUndefined();
      expect(result.session).toContain('valid until');
    });
  });

  describe('with no cached token', () => {
    it('should report a logged-out env with a login suggestion', async () => {
      h.getMock.mockResolvedValue(undefined);

      await runStatus();

      const result = h.outputResultMock.mock.calls[0][0];
      expect(result.authenticated).toBe(false);
      expect(result.suggestion).toContain('auth login');
    });
  });
});

// MARK: handoff
const HANDOFF_EXPIRES_AT = '2100-01-01T00:00:00.000Z';

function runHandoff(argv: Record<string, unknown> = {}): Promise<void> {
  const handoffCommand = readAuthSubcommand('handoff [code]');
  return (handoffCommand.handler as (argv: unknown) => Promise<void>)({ _: ['auth', 'handoff'], env: 'prod', code: 'CLAIM-CODE', ...argv });
}

function handoffBundle(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'uid-1',
    issuer: 'http://x/oidc',
    apiBaseUrl: 'http://x/api',
    clientId: 'cli-client',
    refreshToken: 'refresh-token-value',
    scope: 'openid demo offline_access',
    expiresAt: HANDOFF_EXPIRES_AT,
    ...overrides
  };
}

/**
 * Drives `handoff` expecting it to FAIL, and returns the error `wrapCommandHandler` reported.
 *
 * A thrown `CliError` never escapes the handler — the wrapper converts it into an `outputError`
 * call followed by `process.exit`, so the failure has to be asserted on what was reported rather
 * than on a rejection. `process.exit` is stubbed for the duration or the vitest worker goes down
 * with it (the same guard `cache.command.factory.spec.ts` uses).
 */
async function runHandoffExpectingError(argv: Record<string, unknown> = {}): Promise<any> {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
    throw new Error(`process.exit:${code ?? 0}`);
  }) as never);

  try {
    await expect(runHandoff(argv)).rejects.toThrow('process.exit:1');
  } finally {
    exitSpy.mockRestore();
  }

  return h.outputErrorMock.mock.calls[0]?.[0];
}

describe('createAuthCommand handoff', () => {
  beforeEach(() => {
    h.loadConfigMock.mockReset();
    h.mergeConfigMock.mockReset();
    h.setMock.mockReset();
    h.outputResultMock.mockReset();
    h.outputErrorMock.mockReset();
    h.claimHandoffMock.mockReset();
    h.promptLineMock.mockRejectedValue(new Error('unexpected interactive prompt'));
    h.loadConfigMock.mockResolvedValue({ envs: {} });
    h.mergeConfigMock.mockResolvedValue({ envs: {}, activeEnv: 'prod' });
    h.claimHandoffMock.mockResolvedValue(handoffBundle());
    delete process.env['DEMO_CLI_CLI_HANDOFF'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['DEMO_CLI_CLI_HANDOFF'];
  });

  it('bootstraps an env that does not exist yet from the bundle alone', async () => {
    await runHandoff({ oidcIssuer: 'http://x/oidc' });

    const saved = h.mergeConfigMock.mock.calls[0][0].updates.envs['prod'];
    expect(saved).toMatchObject({ apiBaseUrl: 'http://x/api', oidcIssuer: 'http://x/oidc', clientId: 'cli-client', scopes: 'openid demo offline_access' });
    expect(saved.redirectUri).toBeDefined();
  });

  it('persists a token entry with expiresAt 0 and no fromEnv flag', async () => {
    await runHandoff({ oidcIssuer: 'http://x/oidc' });

    const [envName, entry] = h.setMock.mock.calls[0];
    expect(envName).toBe('prod');
    // expiresAt 0 forces a refresh on first use — the readEnvTokenEntry convention
    expect(entry.expiresAt).toBe(0);
    expect(entry.accessToken).toBe('');
    expect(entry.refreshToken).toBe('refresh-token-value');
    expect(entry.scope).toBe('openid demo offline_access');
    // NOT fromEnv: a public PKCE client rotates its refresh token, and a rotation that is not
    // written back trips oidc-provider's reuse detection and kills the grant
    expect(entry.fromEnv).toBeUndefined();
    expect(entry.sessionExpiresAt).toBe(Math.floor(new Date(HANDOFF_EXPIRES_AT).getTime() / 1000));
  });

  it('uses the stored env\u2019s issuer when no flag is passed', async () => {
    h.loadConfigMock.mockResolvedValue({ envs: { prod: { ...COMPLETE_ENV } } });

    await runHandoff();

    expect(h.claimHandoffMock).toHaveBeenCalledWith({ oidcIssuer: 'http://x/oidc', code: 'CLAIM-CODE' });
  });

  it('reads the code from the env var when no positional is given', async () => {
    process.env['DEMO_CLI_CLI_HANDOFF'] = 'FROM-ENV';

    await runHandoff({ code: undefined, oidcIssuer: 'http://x/oidc' });

    expect(h.claimHandoffMock).toHaveBeenCalledWith({ oidcIssuer: 'http://x/oidc', code: 'FROM-ENV' });
  });

  it('fails when no code is supplied by any route', async () => {
    const error = await runHandoffExpectingError({ code: undefined, oidcIssuer: 'http://x/oidc' });

    expect(error).toMatchObject({ code: 'AUTH_HANDOFF_NO_CODE' });
    expect(h.setMock).not.toHaveBeenCalled();
  });

  it('fails when no issuer can be resolved', async () => {
    const error = await runHandoffExpectingError();

    expect(error).toMatchObject({ code: 'AUTH_HANDOFF_NO_ISSUER' });
    expect(h.claimHandoffMock).not.toHaveBeenCalled();
  });

  it('fails when the bundle carries no apiBaseUrl and the env has none', async () => {
    h.claimHandoffMock.mockResolvedValue(handoffBundle({ apiBaseUrl: undefined }));

    const error = await runHandoffExpectingError({ oidcIssuer: 'http://x/oidc' });

    expect(error).toMatchObject({ code: 'AUTH_HANDOFF_NO_API_BASE_URL' });
    expect(h.setMock).not.toHaveBeenCalled();
  });

  it('never prints the raw refresh token', async () => {
    await runHandoff({ oidcIssuer: 'http://x/oidc' });

    expect(JSON.stringify(h.outputResultMock.mock.calls[0][0])).not.toContain('refresh-token-value');
  });
});

describe('cliIssuersMatch()', () => {
  it('matches identical issuers', () => {
    expect(cliIssuersMatch('https://api.example.com/oidc', 'https://api.example.com/oidc')).toBe(true);
  });

  it('ignores a trailing slash', () => {
    expect(cliIssuersMatch('https://api.example.com/oidc/', 'https://api.example.com/oidc')).toBe(true);
  });

  it('ignores case in the scheme and host', () => {
    expect(cliIssuersMatch('HTTPS://API.Example.com/oidc', 'https://api.example.com/oidc')).toBe(true);
  });

  it('does NOT match a different host — the repoint the guard exists to catch', () => {
    expect(cliIssuersMatch('https://prod.example.com/oidc', 'http://localhost:9010/oidc')).toBe(false);
  });

  it('does NOT match a different port on the same host', () => {
    expect(cliIssuersMatch('http://localhost:9010/oidc', 'http://localhost:9011/oidc')).toBe(false);
  });

  it('does NOT match a different path on the same origin', () => {
    expect(cliIssuersMatch('https://example.com/oidc', 'https://example.com/other')).toBe(false);
  });

  it('falls back to a trimmed string compare when a value is not a URL', () => {
    expect(cliIssuersMatch('not a url', 'not a url')).toBe(true);
    expect(cliIssuersMatch('not a url', 'https://example.com/oidc')).toBe(false);
  });
});

describe('DEFAULT_HANDOFF_ENV_NAME', () => {
  it('is a neutral name, so a bare redeem never has to burn the one-time code for lack of one', () => {
    expect(DEFAULT_HANDOFF_ENV_NAME).toBe('default');
  });
});
