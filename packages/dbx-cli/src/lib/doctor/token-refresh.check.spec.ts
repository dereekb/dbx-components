import { describe, it, expect } from 'vitest';
import { type CliTokenCacheStore, type CliTokenEntry } from '../config/token.cache';
import { type CliEnvConfig } from '../config/env';
import { createTokenRefreshDoctorCheck, TOKEN_REFRESH_DOCTOR_CHECK_NAME } from './token-refresh.check';

const ENV = { clientId: 'client-1', oidcIssuer: 'https://issuer.example/oidc', apiBaseUrl: 'https://api.example/api' } as CliEnvConfig;

const CACHED_ENTRY: CliTokenEntry = { accessToken: 'old-access', refreshToken: 'old-refresh', expiresAt: 1000, sessionExpiresAt: 2000 };

/**
 * An in-memory stand-in for the on-disk token cache, so the check's write-back is observable.
 */
function fakeTokenStore(initial?: CliTokenEntry) {
  const store = new Map<string, CliTokenEntry>();

  if (initial) {
    store.set('prod-mcp', initial);
  }

  const cache = {
    get: async (key: string) => store.get(key),
    set: async (key: string, value: CliTokenEntry) => {
      store.set(key, value);
    },
    remove: async (key: string) => {
      store.delete(key);
    }
  } as unknown as CliTokenCacheStore;

  return { cache, read: () => store.get('prod-mcp') };
}

function buildCheck(input: { readonly store: ReturnType<typeof fakeTokenStore>; readonly refreshed?: Record<string, unknown>; readonly refreshError?: Error }) {
  return createTokenRefreshDoctorCheck({
    tokenStoreForCli: () => input.store.cache,
    discoverOidcMetadata: (async () => ({ token_endpoint: 'https://issuer.example/oidc/token' })) as never,
    refreshAccessToken: (async () => {
      if (input.refreshError) {
        throw input.refreshError;
      }
      return input.refreshed ?? { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 60 };
    }) as never
  });
}

const CHECK_INPUT = { cliName: 'demo-cli', envName: 'prod-mcp', env: ENV, config: undefined };

describe('createTokenRefreshDoctorCheck()', () => {
  it('persists the rotated refresh token so the round-trip does not strand the session', async () => {
    const store = fakeTokenStore(CACHED_ENTRY);
    const result = await buildCheck({ store })(CHECK_INPUT);

    expect(result.ok).toBe(true);
    // The regression: the check used to discard the refresh response, leaving `old-refresh` — a
    // spent token — cached, so the NEXT refresh failed invalid_grant and killed the session.
    expect(store.read()?.refreshToken).toBe('new-refresh');
    expect(store.read()?.accessToken).toBe('new-access');
  });

  it('reports whether the grant rotated', async () => {
    const rotating = await buildCheck({ store: fakeTokenStore(CACHED_ENTRY) })(CHECK_INPUT);
    expect((rotating.detail as { rotated: boolean }).rotated).toBe(true);

    const nonRotating = await buildCheck({ store: fakeTokenStore(CACHED_ENTRY), refreshed: { access_token: 'new-access', refresh_token: 'old-refresh', expires_in: 60 } })(CHECK_INPUT);
    expect((nonRotating.detail as { rotated: boolean }).rotated).toBe(false);
  });

  it('preserves session metadata the refresh response does not carry', async () => {
    const store = fakeTokenStore(CACHED_ENTRY);
    await buildCheck({ store })(CHECK_INPUT);

    expect(store.read()?.sessionExpiresAt).toBe(2000);
  });

  it('leaves the cache untouched when the refresh fails', async () => {
    const store = fakeTokenStore(CACHED_ENTRY);
    const result = await buildCheck({ store, refreshError: new Error('grant request is invalid') })(CHECK_INPUT);

    expect(result.ok).toBe(false);
    expect(store.read()).toEqual(CACHED_ENTRY);
  });

  it('fails with no-refresh-token when nothing is cached', async () => {
    const result = await buildCheck({ store: fakeTokenStore() })(CHECK_INPUT);

    expect(result.ok).toBe(false);
    expect(result.detail).toEqual({ reason: 'no-refresh-token' });
  });

  it('reports incomplete credentials when the env has no clientId', async () => {
    const result = await buildCheck({ store: fakeTokenStore(CACHED_ENTRY) })({ ...CHECK_INPUT, env: {} as CliEnvConfig });

    expect(result.name).toBe(TOKEN_REFRESH_DOCTOR_CHECK_NAME);
    expect(result.ok).toBe(false);
  });
});
