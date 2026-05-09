import { describe, it, expect } from 'vitest';
import type { KoaContextWithOIDC } from 'oidc-provider';
import { DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM, readRemainingGrantSeconds, readRequestedSessionTtlSeconds, resolveLoginDurationSeconds } from './oidc.session-ttl';

const SERVER_MAX = 90 * 24 * 60 * 60; // 90 days
const SERVER_MIN = 60 * 60; // 1 hour
const DEFAULT = 30 * 24 * 60 * 60; // 30 days

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
