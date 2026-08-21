import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

// Shared spies, hoisted so the vi.mock factories can reference them.
const h = vi.hoisted(() => ({
  getMock: vi.fn(),
  setMock: vi.fn(),
  removeMock: vi.fn(),
  refreshMock: vi.fn(),
  resolveEnvMock: vi.fn()
}));

vi.mock('../config/token.cache', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, createCliTokenCacheStore: () => ({ get: h.getMock, set: h.setMock, remove: h.removeMock }) };
});

vi.mock('../auth/oidc.client', () => ({
  discoverOidcMetadata: vi.fn(async () => ({ issuer: 'http://x/oidc', authorization_endpoint: 'http://x/oidc/auth', token_endpoint: 'http://x/oidc/token' })),
  refreshAccessToken: h.refreshMock
}));

vi.mock('../config/env.resolve', () => ({
  resolveCliEnvOrThrow: h.resolveEnvMock
}));

// NOT mocked: `../context/cli.context` is read back through its real module-level slot below.
// `createCliContext` is synchronous and opens nothing (its Firestore thunks are lazy), and a mock
// here would replace the module for every OTHER spec that shares the registry.
import { getCliContext, setCliContext } from '../context/cli.context';
import { createAuthMiddleware } from './auth.middleware';

const COMPLETE_ENV = { apiBaseUrl: 'http://x/api', oidcIssuer: 'http://x/oidc', clientId: 'id', clientSecret: 'secret', redirectUri: 'urn:cb' };
const REFRESH_TOKEN_ENV_KEY = 'DEMO_CLI_REFRESH_TOKEN';

function runMiddleware(): Promise<void> {
  const middleware = createAuthMiddleware({ cliName: 'demo-cli', skipCommands: new Set<string>() });
  return (middleware as (argv: unknown) => Promise<void>)({ _: ['callmodel'], env: 'dev', verbose: false });
}

describe('createAuthMiddleware token resolution', () => {
  beforeEach(() => {
    h.getMock.mockReset();
    h.setMock.mockReset();
    h.removeMock.mockReset();
    h.refreshMock.mockReset();
    h.resolveEnvMock.mockReset();
    h.resolveEnvMock.mockResolvedValue({ envName: 'dev', env: COMPLETE_ENV });
    // cleared so "the middleware attached a context" is distinguishable from a leftover one
    setCliContext(undefined);
    delete process.env[REFRESH_TOKEN_ENV_KEY];
  });

  afterEach(() => {
    setCliContext(undefined);
    delete process.env[REFRESH_TOKEN_ENV_KEY];
  });

  it('cache wins: a valid cached entry is used and env tokens are ignored', async () => {
    process.env[REFRESH_TOKEN_ENV_KEY] = 'env-refresh-token'; // present, but must be ignored
    h.getMock.mockResolvedValue({ accessToken: 'cached-access', refreshToken: 'cached-refresh', expiresAt: Date.now() + 3_600_000 });

    await runMiddleware();

    expect(h.refreshMock).not.toHaveBeenCalled();
    expect(h.setMock).not.toHaveBeenCalled();
    expect(getCliContext()?.accessToken).toBe('cached-access');
  });

  it('env fallback: with no cache, mints an access token from the env refresh token and does NOT write it back', async () => {
    process.env[REFRESH_TOKEN_ENV_KEY] = 'env-refresh-token';
    h.getMock.mockResolvedValue(undefined);
    h.refreshMock.mockResolvedValue({ access_token: 'minted-access', expires_in: 900, refresh_token: 'env-refresh-token' });

    await runMiddleware();

    expect(h.refreshMock).toHaveBeenCalledTimes(1);
    expect(h.refreshMock.mock.calls[0][0].refreshToken).toBe('env-refresh-token');
    // fromEnv entries are never persisted.
    expect(h.setMock).not.toHaveBeenCalled();
    expect(getCliContext()?.accessToken).toBe('minted-access');
  });

  it('cache expired: refreshes and writes the refreshed entry back to the cache', async () => {
    h.getMock.mockResolvedValue({ accessToken: 'old-access', refreshToken: 'cached-refresh', expiresAt: Date.now() - 10_000 });
    h.refreshMock.mockResolvedValue({ access_token: 'new-access', expires_in: 900 });

    await runMiddleware();

    expect(h.refreshMock).toHaveBeenCalledTimes(1);
    expect(h.setMock).toHaveBeenCalledTimes(1);
    expect(getCliContext()?.accessToken).toBe('new-access');
  });

  // yargs re-runs a global middleware once per COMMAND LEVEL, so `action worker export` enters this
  // middleware three times. Replacing the context each time orphaned the earlier one — and the
  // direct-Firestore session opened on its memo with it, since the exit teardown closes the session
  // belonging to whichever context is in the slot LAST. The observable symptom was a command that
  // printed its result and then never exited.
  it('nested commands: re-running the middleware for the same env + token keeps the SAME context', async () => {
    h.getMock.mockResolvedValue({ accessToken: 'cached-access', refreshToken: 'cached-refresh', expiresAt: Date.now() + 3_600_000 });

    await runMiddleware();
    const first = getCliContext();
    await runMiddleware();
    const second = getCliContext();
    await runMiddleware();
    const third = getCliContext();

    expect(first).toBeDefined();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('replaces the context when the resolved access token changed', async () => {
    h.getMock.mockResolvedValueOnce({ accessToken: 'first-access', refreshToken: 'cached-refresh', expiresAt: Date.now() + 3_600_000 });
    await runMiddleware();
    const first = getCliContext();

    h.getMock.mockResolvedValueOnce({ accessToken: 'second-access', refreshToken: 'cached-refresh', expiresAt: Date.now() + 3_600_000 });
    await runMiddleware();
    const second = getCliContext();

    expect(first?.accessToken).toBe('first-access');
    expect(second).not.toBe(first);
    expect(second?.accessToken).toBe('second-access');
  });

  it('replaces the context when the resolved env changed', async () => {
    h.getMock.mockResolvedValue({ accessToken: 'cached-access', refreshToken: 'cached-refresh', expiresAt: Date.now() + 3_600_000 });

    await runMiddleware();
    const first = getCliContext();

    h.resolveEnvMock.mockResolvedValue({ envName: 'prod', env: COMPLETE_ENV });
    await runMiddleware();
    const second = getCliContext();

    expect(first?.envName).toBe('dev');
    expect(second).not.toBe(first);
    expect(second?.envName).toBe('prod');
  });
});
