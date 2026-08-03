import { describe, expect, it } from 'vitest';
import { type CalcomAccessToken } from '@dereekb/calcom';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE } from '@dereekb/firebase';
import { type UserExternalConnectionCredentials, type UserExternalConnectionReader, type UserExternalConnectionServerActions } from '@dereekb/firebase-server/model';
import { MS_IN_MINUTE, type Maybe } from '@dereekb/util';
import { calcomAccessTokenFromUserExternalConnectionCredentials, userExternalConnectionCalcomAccessTokenCache } from './calcom.oauth.connection.cache';

const TEST_UID = 'test-uid';

interface CapturedWrite {
  readonly uid: string;
  readonly providerType: string;
  readonly credentials: UserExternalConnectionCredentials;
}

function makeStoredCredentials(overrides?: Partial<UserExternalConnectionCredentials>): UserExternalConnectionCredentials {
  return {
    accessToken: 'stored-access-token',
    refreshToken: 'stored-refresh-token',
    tokenType: 'Bearer',
    issuedAt: '2026-03-01T00:00:00.000Z',
    expiresAt: '2026-03-01T01:00:00.000Z',
    scopes: ['booking:read', 'booking:write'],
    externalAccountId: 'cal-123',
    label: 'user@example.com',
    ...overrides
  };
}

function makeCache(stored: Maybe<UserExternalConnectionCredentials>) {
  const writes: CapturedWrite[] = [];

  const reader = {
    readUserExternalConnectionCredentials: async () => stored
  } as unknown as UserExternalConnectionReader;

  const actions = {
    refreshUserExternalConnectionCredentials: async (params: CapturedWrite) => {
      writes.push(params);
    }
  } as unknown as UserExternalConnectionServerActions;

  return { cache: userExternalConnectionCalcomAccessTokenCache({ reader, actions, uid: TEST_UID }), writes };
}

describe('calcomAccessTokenFromUserExternalConnectionCredentials()', () => {
  it('should map stored credentials to a Cal.com access token', () => {
    const result = calcomAccessTokenFromUserExternalConnectionCredentials(makeStoredCredentials());

    expect(result?.accessToken).toBe('stored-access-token');
    expect(result?.refreshToken).toBe('stored-refresh-token');
    // re-joined on the delimiter the authorize request splits on
    expect(result?.scope).toBe('booking:read booking:write');
    expect(result?.expiresAt?.toISOString()).toBe('2026-03-01T01:00:00.000Z');
    expect(result?.expiresIn).toBe(3600);
  });

  it('should return null when there is no refresh token', () => {
    // Cal.com's factory cannot renew from a token without one, so a synthesized entry would be a trap
    expect(calcomAccessTokenFromUserExternalConnectionCredentials(makeStoredCredentials({ refreshToken: undefined }))).not.toBeDefined();
  });

  it('should return null when there is no expiration', () => {
    // the factory reads expiresAt to decide whether to refresh; without one it would never refresh
    expect(calcomAccessTokenFromUserExternalConnectionCredentials(makeStoredCredentials({ expiresAt: undefined }))).not.toBeDefined();
  });

  it('should return null for absent credentials', () => {
    expect(calcomAccessTokenFromUserExternalConnectionCredentials(null)).not.toBeDefined();
  });
});

describe('userExternalConnectionCalcomAccessTokenCache()', () => {
  const rotated: CalcomAccessToken = {
    accessToken: 'rotated-access-token',
    refreshToken: 'rotated-refresh-token',
    scope: 'booking:read booking:write',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + MS_IN_MINUTE * 60)
  };

  describe('loadCachedToken()', () => {
    it('should return the stored credentials as a Cal.com token', async () => {
      const { cache } = makeCache(makeStoredCredentials());
      const result = await cache.loadCachedToken();

      expect(result?.accessToken).toBe('stored-access-token');
      expect(result?.refreshToken).toBe('stored-refresh-token');
    });

    it('should return an EXPIRED stored token rather than renewing it', async () => {
      // the cache's contract is explicitly that the token may be expired — Cal.com's factory consults
      // this before deciding to refresh, so renewing here would pre-empt (and could recurse into) it
      const { cache, writes } = makeCache(makeStoredCredentials({ expiresAt: new Date(Date.now() - MS_IN_MINUTE).toISOString() }));

      const result = await cache.loadCachedToken();

      expect(result?.accessToken).toBe('stored-access-token');
      expect(writes).toHaveLength(0);
    });

    it('should return nothing when the user has no stored credentials', async () => {
      const { cache } = makeCache(null);
      expect(await cache.loadCachedToken()).not.toBeDefined();
    });
  });

  describe('updateCachedToken()', () => {
    it('should persist a ROTATED refresh token back onto the connection pair', async () => {
      // the whole reason this cache exists: Cal.com invalidates the refresh token on every use and
      // hands the replacement to its cache, so without this the stored token is spent after one use
      const { cache, writes } = makeCache(makeStoredCredentials());

      await cache.updateCachedToken(rotated);

      expect(writes).toHaveLength(1);
      expect(writes[0].uid).toBe(TEST_UID);
      expect(writes[0].providerType).toBe(CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
      expect(writes[0].credentials.refreshToken).toBe('rotated-refresh-token');
      expect(writes[0].credentials.accessToken).toBe('rotated-access-token');
    });

    it('should retain the account id and label a Cal.com token does not carry', async () => {
      const { cache, writes } = makeCache(makeStoredCredentials());

      await cache.updateCachedToken(rotated);

      expect(writes[0].credentials.externalAccountId).toBe('cal-123');
      expect(writes[0].credentials.label).toBe('user@example.com');
    });

    it('should write the token as-is when nothing is stored yet', async () => {
      const { cache, writes } = makeCache(null);

      await cache.updateCachedToken(rotated);

      expect(writes).toHaveLength(1);
      expect(writes[0].credentials.refreshToken).toBe('rotated-refresh-token');
      expect(writes[0].credentials.externalAccountId).not.toBeDefined();
    });
  });
});
