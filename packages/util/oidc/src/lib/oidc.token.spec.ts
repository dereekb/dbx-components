import { describe, it, expect, vi } from 'vitest';
import { OidcRelyingPartyError, type OidcTokenResponse, inMemoryAsyncValueCache } from '@dereekb/util';
import { type OidcTokenState, type OidcTokenStorage, accessTokenNeedsRefresh, decodeJwtClaims, isAccessTokenExpired, nextRefreshDelay, oidcTokenManager, oidcTokenStateFromResponse } from './oidc.token';

function makeJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
}

function validResponse(overrides?: Partial<OidcTokenResponse>): OidcTokenResponse {
  return { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, ...overrides };
}

describe('oidcTokenStateFromResponse()', () => {
  it('converts expires_in seconds into an absolute expiresAt anchored at now', () => {
    const now = 1_000_000;
    const state = oidcTokenStateFromResponse({ access_token: 'at', expires_in: 3600 }, { now });
    expect(state.accessToken).toBe('at');
    expect(state.expiresAt).toBe(now + 3600 * 1000);
  });

  it('leaves expiresAt undefined when expires_in is absent', () => {
    const state = oidcTokenStateFromResponse({ access_token: 'at' }, { now: 0 });
    expect(state.expiresAt).toBeUndefined();
  });

  it('decodes claims from the id_token when not provided', () => {
    const idToken = makeJwt({ sub: 'user-1', email: 'a@b.co' });
    const state = oidcTokenStateFromResponse({ access_token: 'at', id_token: idToken }, { now: 0 });
    expect(state.claims).toEqual({ sub: 'user-1', email: 'a@b.co' });
  });

  it('prefers explicitly provided claims over the id_token', () => {
    const idToken = makeJwt({ sub: 'from-token' });
    const state = oidcTokenStateFromResponse({ access_token: 'at', id_token: idToken }, { now: 0, claims: { sub: 'explicit' } });
    expect(state.claims).toEqual({ sub: 'explicit' });
  });
});

describe('decodeJwtClaims()', () => {
  it('decodes a JWT payload', () => {
    expect(decodeJwtClaims(makeJwt({ sub: 'x', n: 1 }))).toEqual({ sub: 'x', n: 1 });
  });

  it('returns undefined for a non-JWT or missing input', () => {
    expect(decodeJwtClaims(undefined)).toBeUndefined();
    expect(decodeJwtClaims('not-a-jwt')).toBeUndefined();
  });
});

describe('expiry helpers', () => {
  const now = 1_000_000;

  it('isAccessTokenExpired uses the real expiry with no buffer', () => {
    expect(isAccessTokenExpired({ accessToken: 'a', expiresAt: now - 1 }, now)).toBe(true);
    expect(isAccessTokenExpired({ accessToken: 'a', expiresAt: now + 1 }, now)).toBe(false);
  });

  it('isAccessTokenExpired treats a missing expiresAt as expired', () => {
    expect(isAccessTokenExpired({ accessToken: 'a' }, now)).toBe(true);
    expect(isAccessTokenExpired(undefined, now)).toBe(true);
  });

  it('accessTokenNeedsRefresh applies the pre-emptive buffer', () => {
    // Token expires 30s out, buffer 60s ⇒ within buffer ⇒ needs refresh.
    expect(accessTokenNeedsRefresh({ accessToken: 'a', expiresAt: now + 30_000 }, now, 60_000)).toBe(true);
    // Token expires 90s out, buffer 60s ⇒ outside buffer ⇒ no refresh.
    expect(accessTokenNeedsRefresh({ accessToken: 'a', expiresAt: now + 90_000 }, now, 60_000)).toBe(false);
  });

  it('nextRefreshDelay returns ms until the buffered refresh time, clamped at 0', () => {
    expect(nextRefreshDelay({ accessToken: 'a', expiresAt: now + 90_000 }, now, 60_000)).toBe(30_000);
    expect(nextRefreshDelay({ accessToken: 'a', expiresAt: now + 10_000 }, now, 60_000)).toBe(0);
    expect(nextRefreshDelay({ accessToken: 'a' }, now, 60_000)).toBe(0);
  });
});

describe('oidcTokenManager()', () => {
  const now = 2_000_000;

  function expiredState(refreshToken = 'rt-0'): OidcTokenState {
    return { accessToken: 'at-0', refreshToken, expiresAt: now - 10_000 };
  }

  it('returns the stored token without refreshing when it is still valid', async () => {
    const storage = inMemoryAsyncValueCache<OidcTokenState>({ accessToken: 'at-valid', refreshToken: 'rt', expiresAt: now + 600_000 });
    const refresh = vi.fn(async () => validResponse());
    const manager = oidcTokenManager({ storage, refresh, now: () => now });

    expect(await manager.getValidAccessToken()).toBe('at-valid');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('returns undefined when there is no stored token', async () => {
    const refresh = vi.fn(async () => validResponse());
    const manager = oidcTokenManager({ refresh, now: () => now });
    expect(await manager.getValidAccessToken()).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes a single time across N concurrent getValidAccessToken() calls (single-flight)', async () => {
    const storage: OidcTokenStorage = inMemoryAsyncValueCache<OidcTokenState>(expiredState());
    const refresh = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return validResponse();
    });
    const manager = oidcTokenManager({ storage, refresh, now: () => now });

    const results = await Promise.all(Array.from({ length: 5 }, () => manager.getValidAccessToken()));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['at-1', 'at-1', 'at-1', 'at-1', 'at-1']);
  });

  it('rotates the refresh token (new replaces old) and persists the new state', async () => {
    const storage = inMemoryAsyncValueCache<OidcTokenState>(expiredState('rt-old'));
    const refresh = vi.fn(async () => validResponse({ refresh_token: 'rt-new' }));
    const manager = oidcTokenManager({ storage, refresh, now: () => now });

    await manager.getValidAccessToken();

    const state = await manager.getState();
    expect(state?.accessToken).toBe('at-1');
    expect(state?.refreshToken).toBe('rt-new');
    expect(refresh).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'rt-old' }));
  });

  it('keeps the prior refresh token when the response omits one', async () => {
    const storage = inMemoryAsyncValueCache<OidcTokenState>(expiredState('rt-keep'));
    const refresh = vi.fn(async () => validResponse({ refresh_token: undefined }));
    const manager = oidcTokenManager({ storage, refresh, now: () => now });

    await manager.getValidAccessToken();

    expect((await manager.getState())?.refreshToken).toBe('rt-keep');
  });

  it('clears the store and reports no token when refresh fails with invalid_grant', async () => {
    const storage = inMemoryAsyncValueCache<OidcTokenState>(expiredState());
    const refresh = vi.fn(async () => {
      throw new OidcRelyingPartyError({ message: 'invalid_grant', code: 'TOKEN_INVALID_GRANT' });
    });
    const manager = oidcTokenManager({ storage, refresh, now: () => now });

    expect(await manager.getValidAccessToken()).toBeUndefined();
    expect(await manager.getState()).toBeUndefined();
  });

  it('propagates non-invalid_grant refresh errors', async () => {
    const storage = inMemoryAsyncValueCache<OidcTokenState>(expiredState());
    const refresh = vi.fn(async () => {
      throw new OidcRelyingPartyError({ message: 'boom', code: 'TOKEN_EXCHANGE_FAILED' });
    });
    const manager = oidcTokenManager({ storage, refresh, now: () => now });

    await expect(manager.getValidAccessToken()).rejects.toThrow('boom');
  });

  it('returns undefined when the expired token has no refresh token', async () => {
    const storage = inMemoryAsyncValueCache<OidcTokenState>({ accessToken: 'at-0', expiresAt: now - 1 });
    const refresh = vi.fn(async () => validResponse());
    const manager = oidcTokenManager({ storage, refresh, now: () => now });

    expect(await manager.getValidAccessToken()).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
  });
});
