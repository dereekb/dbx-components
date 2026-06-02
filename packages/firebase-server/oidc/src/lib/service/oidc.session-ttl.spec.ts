import { describe, it, expect } from 'vitest';
import type { KoaContextWithOIDC } from 'oidc-provider';
import { DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM, REFRESH_TOKEN_ROTATION_MAX_LIFETIME_SECONDS, readRemainingGrantSeconds, readRequestedSessionTtlSeconds, resolveLoginDurationSeconds, resolveTieredServerMaxSeconds, shouldRotateRefreshToken } from './oidc.session-ttl';

const SERVER_MAX = 90 * 24 * 60 * 60; // 90 days
const SERVER_MIN = 60 * 60; // 1 hour
const DEFAULT = 30 * 24 * 60 * 60; // 30 days

const NONADMIN_MAX = 45 * 24 * 60 * 60; // 45 days
const ADMIN_MAX = 90 * 24 * 60 * 60; // 90 days
const SERVICE_TOKEN_MAX = 365 * 24 * 60 * 60; // 1 year

describe('resolveLoginDurationSeconds()', () => {
  it('falls back to the default when no value is requested', () => {
    expect(
      resolveLoginDurationSeconds({
        requestedSeconds: undefined,
        clientMaxSeconds: undefined,
        serverMaxSeconds: SERVER_MAX,
        serverMinSeconds: SERVER_MIN,
        defaultSeconds: DEFAULT
      })
    ).toBe(DEFAULT);
  });

  it('honors a requested value within the bounds', () => {
    expect(
      resolveLoginDurationSeconds({
        requestedSeconds: 7 * 24 * 60 * 60,
        clientMaxSeconds: undefined,
        serverMaxSeconds: SERVER_MAX,
        serverMinSeconds: SERVER_MIN,
        defaultSeconds: DEFAULT
      })
    ).toBe(7 * 24 * 60 * 60);
  });

  it('clamps a value below the floor up to the floor', () => {
    expect(
      resolveLoginDurationSeconds({
        requestedSeconds: 60,
        clientMaxSeconds: undefined,
        serverMaxSeconds: SERVER_MAX,
        serverMinSeconds: SERVER_MIN,
        defaultSeconds: DEFAULT
      })
    ).toBe(SERVER_MIN);
  });

  it('clamps a value above the server cap down to the cap', () => {
    expect(
      resolveLoginDurationSeconds({
        requestedSeconds: 365 * 24 * 60 * 60,
        clientMaxSeconds: undefined,
        serverMaxSeconds: SERVER_MAX,
        serverMinSeconds: SERVER_MIN,
        defaultSeconds: DEFAULT
      })
    ).toBe(SERVER_MAX);
  });

  it('clamps a value above the per-client cap down to the client cap', () => {
    const clientCap = 14 * 24 * 60 * 60;
    expect(
      resolveLoginDurationSeconds({
        requestedSeconds: 60 * 24 * 60 * 60,
        clientMaxSeconds: clientCap,
        serverMaxSeconds: SERVER_MAX,
        serverMinSeconds: SERVER_MIN,
        defaultSeconds: DEFAULT
      })
    ).toBe(clientCap);
  });

  it('treats the per-client cap as the binding ceiling when smaller than the server cap', () => {
    const clientCap = 14 * 24 * 60 * 60;
    expect(
      resolveLoginDurationSeconds({
        requestedSeconds: undefined,
        clientMaxSeconds: clientCap,
        serverMaxSeconds: SERVER_MAX,
        serverMinSeconds: SERVER_MIN,
        defaultSeconds: 60 * 24 * 60 * 60 // default exceeds client cap
      })
    ).toBe(clientCap);
  });
});

describe('resolveTieredServerMaxSeconds()', () => {
  it('returns the non-admin tier for a non-admin', () => {
    expect(resolveTieredServerMaxSeconds({ isAdmin: false, hasServiceScope: false, nonAdminMax: NONADMIN_MAX, adminMax: ADMIN_MAX, serviceTokenMax: SERVICE_TOKEN_MAX })).toBe(NONADMIN_MAX);
  });

  it('returns the admin tier for an admin without a service-token scope', () => {
    expect(resolveTieredServerMaxSeconds({ isAdmin: true, hasServiceScope: false, nonAdminMax: NONADMIN_MAX, adminMax: ADMIN_MAX, serviceTokenMax: SERVICE_TOKEN_MAX })).toBe(ADMIN_MAX);
  });

  it('returns the service-token tier for an admin with a service-token scope', () => {
    expect(resolveTieredServerMaxSeconds({ isAdmin: true, hasServiceScope: true, nonAdminMax: NONADMIN_MAX, adminMax: ADMIN_MAX, serviceTokenMax: SERVICE_TOKEN_MAX })).toBe(SERVICE_TOKEN_MAX);
  });

  it('never grants the service-token tier to a non-admin even when the service scope is present', () => {
    expect(resolveTieredServerMaxSeconds({ isAdmin: false, hasServiceScope: true, nonAdminMax: NONADMIN_MAX, adminMax: ADMIN_MAX, serviceTokenMax: SERVICE_TOKEN_MAX })).toBe(NONADMIN_MAX);
  });

  it('composes with resolveLoginDurationSeconds: a service-token tier clamps a 2-year request to 1 year', () => {
    const serverMaxSeconds = resolveTieredServerMaxSeconds({ isAdmin: true, hasServiceScope: true, nonAdminMax: NONADMIN_MAX, adminMax: ADMIN_MAX, serviceTokenMax: SERVICE_TOKEN_MAX });
    expect(resolveLoginDurationSeconds({ requestedSeconds: 2 * SERVICE_TOKEN_MAX, clientMaxSeconds: undefined, serverMaxSeconds, serverMinSeconds: SERVER_MIN, defaultSeconds: DEFAULT })).toBe(SERVICE_TOKEN_MAX);
  });

  it('composes with resolveLoginDurationSeconds: a sub-floor request still clamps up to the 1h floor', () => {
    const serverMaxSeconds = resolveTieredServerMaxSeconds({ isAdmin: true, hasServiceScope: true, nonAdminMax: NONADMIN_MAX, adminMax: ADMIN_MAX, serviceTokenMax: SERVICE_TOKEN_MAX });
    expect(resolveLoginDurationSeconds({ requestedSeconds: 60, clientMaxSeconds: undefined, serverMaxSeconds, serverMinSeconds: SERVER_MIN, defaultSeconds: DEFAULT })).toBe(SERVER_MIN);
  });

  it('composes with resolveLoginDurationSeconds: a per-client cap still mins down below the tier', () => {
    const clientCap = 7 * 24 * 60 * 60;
    const serverMaxSeconds = resolveTieredServerMaxSeconds({ isAdmin: true, hasServiceScope: true, nonAdminMax: NONADMIN_MAX, adminMax: ADMIN_MAX, serviceTokenMax: SERVICE_TOKEN_MAX });
    expect(resolveLoginDurationSeconds({ requestedSeconds: SERVICE_TOKEN_MAX, clientMaxSeconds: clientCap, serverMaxSeconds, serverMinSeconds: SERVER_MIN, defaultSeconds: DEFAULT })).toBe(clientCap);
  });
});

describe('shouldRotateRefreshToken()', () => {
  const baseInput = {
    scope: 'openid offline_access',
    nonRotatingScopes: ['token.service'],
    totalLifetimeSeconds: 30 * 24 * 60 * 60,
    clientAuthMethod: 'client_secret_post',
    isSenderConstrained: false,
    ttlPercentagePassed: 10
  };

  it('returns false when the scope set intersects nonRotatingScopes', () => {
    expect(shouldRotateRefreshToken({ ...baseInput, scope: 'openid offline_access token.service', ttlPercentagePassed: 99 })).toBe(false);
  });

  it('returns false when total lifetime has reached the 1-year rotation cap (library default)', () => {
    expect(shouldRotateRefreshToken({ ...baseInput, totalLifetimeSeconds: REFRESH_TOKEN_ROTATION_MAX_LIFETIME_SECONDS })).toBe(false);
  });

  it('returns true for a non sender-constrained public client (library default)', () => {
    expect(shouldRotateRefreshToken({ ...baseInput, clientAuthMethod: 'none', isSenderConstrained: false, ttlPercentagePassed: 0 })).toBe(true);
  });

  it('does not auto-rotate a sender-constrained public client below 70% lifetime (library default)', () => {
    expect(shouldRotateRefreshToken({ ...baseInput, clientAuthMethod: 'none', isSenderConstrained: true, ttlPercentagePassed: 10 })).toBe(false);
  });

  it('rotates a confidential client only once it is beyond 70% of its lifetime (library default)', () => {
    expect(shouldRotateRefreshToken({ ...baseInput, ttlPercentagePassed: 69 })).toBe(false);
    expect(shouldRotateRefreshToken({ ...baseInput, ttlPercentagePassed: 70 })).toBe(true);
  });

  it('treats an empty/undefined scope as no intersection', () => {
    expect(shouldRotateRefreshToken({ ...baseInput, scope: undefined, ttlPercentagePassed: 70 })).toBe(true);
  });
});

describe('readRequestedSessionTtlSeconds()', () => {
  it('returns undefined when ctx is undefined', () => {
    expect(readRequestedSessionTtlSeconds(undefined)).toBeUndefined();
  });

  it('returns undefined when the param is missing', () => {
    const ctx = { oidc: { params: {} } } as unknown as KoaContextWithOIDC;
    expect(readRequestedSessionTtlSeconds(ctx)).toBeUndefined();
  });

  it('parses a string-typed positive integer', () => {
    const ctx = { oidc: { params: { [DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM]: '3600' } } } as unknown as KoaContextWithOIDC;
    expect(readRequestedSessionTtlSeconds(ctx)).toBe(3600);
  });

  it('accepts a number-typed value when oidc-provider already coerced it', () => {
    const ctx = { oidc: { params: { [DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM]: 7200 } } } as unknown as KoaContextWithOIDC;
    expect(readRequestedSessionTtlSeconds(ctx)).toBe(7200);
  });

  it('rejects non-integer values', () => {
    const ctx = { oidc: { params: { [DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM]: '12.5' } } } as unknown as KoaContextWithOIDC;
    expect(readRequestedSessionTtlSeconds(ctx)).toBeUndefined();
  });

  it('rejects negative values', () => {
    const ctx = { oidc: { params: { [DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM]: '-100' } } } as unknown as KoaContextWithOIDC;
    expect(readRequestedSessionTtlSeconds(ctx)).toBeUndefined();
  });

  it('rejects garbage', () => {
    const ctx = { oidc: { params: { [DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM]: 'abc' } } } as unknown as KoaContextWithOIDC;
    expect(readRequestedSessionTtlSeconds(ctx)).toBeUndefined();
  });
});

describe('readRemainingGrantSeconds()', () => {
  it('returns undefined when no Grant is bound', () => {
    const ctx = { oidc: { entities: {} } } as unknown as KoaContextWithOIDC;
    expect(readRemainingGrantSeconds(ctx)).toBeUndefined();
  });

  it('returns the seconds remaining until exp', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const ctx = { oidc: { entities: { Grant: { exp } } } } as unknown as KoaContextWithOIDC;
    const remaining = readRemainingGrantSeconds(ctx);
    expect(remaining).toBeGreaterThan(3590);
    expect(remaining).toBeLessThanOrEqual(3600);
  });

  it('returns undefined when the Grant has already expired', () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    const ctx = { oidc: { entities: { Grant: { exp } } } } as unknown as KoaContextWithOIDC;
    expect(readRemainingGrantSeconds(ctx)).toBeUndefined();
  });
});
