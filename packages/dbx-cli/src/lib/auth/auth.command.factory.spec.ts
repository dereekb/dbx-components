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
  resolveEnvMock: vi.fn()
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

import { createAuthCommand } from './auth.command.factory';

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
