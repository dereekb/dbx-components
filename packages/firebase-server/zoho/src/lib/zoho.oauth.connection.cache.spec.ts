import { describe, expect, it } from 'vitest';
import { ZOHO_ACCOUNTS_US_API_URL, type ZohoAccessToken } from '@dereekb/zoho';
import { ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE } from '@dereekb/firebase';
import { type UserExternalConnectionAccessor, type UserExternalConnectionCredentials, type UserExternalConnectionCredentialsWriter } from '@dereekb/firebase-server/model';
import { MS_IN_MINUTE, type Maybe } from '@dereekb/util';
import { userExternalConnectionZohoAccessTokenCache, zohoAccessTokenFromUserExternalConnectionCredentials } from './zoho.oauth.connection.cache';

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
    scopes: ['AaaServer.profile.READ', 'ZohoCRM.modules.READ'],
    externalAccountId: '12345',
    label: 'user@example.com',
    extra: { apiDomain: 'https://www.zohoapis.com', accountsServer: ZOHO_ACCOUNTS_US_API_URL, location: 'us' },
    ...overrides
  };
}

function makeCache(stored: Maybe<UserExternalConnectionCredentials>) {
  const writes: CapturedWrite[] = [];

  const accessor: UserExternalConnectionAccessor = {
    accessorForUser:
      ({ uid }) =>
      (providerType) => ({
        uid,
        providerType,
        readUserExternalConnectionCredentials: async () => stored,
        readUserExternalConnectionForProvider: async () => ({ uid, providerType, entry: undefined, credentials: stored })
      })
  };

  const actions: UserExternalConnectionCredentialsWriter = {
    refreshUserExternalConnectionCredentials: async (params) => {
      writes.push(params);
    }
  };

  return { cache: userExternalConnectionZohoAccessTokenCache({ accessor, actions, uid: TEST_UID }), writes };
}

describe('zohoAccessTokenFromUserExternalConnectionCredentials()', () => {
  it('should map stored credentials to a Zoho access token', () => {
    const result = zohoAccessTokenFromUserExternalConnectionCredentials(makeStoredCredentials());

    expect(result?.accessToken).toBe('stored-access-token');
    expect(result?.apiDomain).toBe('https://www.zohoapis.com');
    // joined on the comma delimiter Zoho splits a granted scope string with
    expect(result?.scope).toBe('AaaServer.profile.READ,ZohoCRM.modules.READ');
    expect(result?.expiresIn).toBe(3600);
  });

  it('should return null without an api domain', () => {
    // a Zoho access token is only usable against the domain it was issued for, so a token synthesized
    // without one would be sent to the wrong host
    expect(zohoAccessTokenFromUserExternalConnectionCredentials(makeStoredCredentials({ extra: { accountsServer: ZOHO_ACCOUNTS_US_API_URL } }))).not.toBeDefined();
  });

  it('should return null without an expiration', () => {
    expect(zohoAccessTokenFromUserExternalConnectionCredentials(makeStoredCredentials({ expiresAt: undefined }))).not.toBeDefined();
  });

  it('should return null for absent credentials', () => {
    expect(zohoAccessTokenFromUserExternalConnectionCredentials(null)).not.toBeDefined();
  });
});

describe('userExternalConnectionZohoAccessTokenCache()', () => {
  const renewed: ZohoAccessToken = {
    accessToken: 'renewed-access-token',
    scope: 'AaaServer.profile.READ,ZohoCRM.modules.READ',
    apiDomain: 'https://www.zohoapis.eu',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + MS_IN_MINUTE * 60)
  };

  describe('loadCachedToken()', () => {
    it('should return the stored credentials as a Zoho token', async () => {
      const { cache } = makeCache(makeStoredCredentials());
      expect((await cache.loadCachedToken())?.accessToken).toBe('stored-access-token');
    });

    it('should return an EXPIRED stored token rather than renewing it', async () => {
      // Zoho's factory consults the cache before deciding to refresh, and the contract is that the
      // returned token may be expired
      const { cache, writes } = makeCache(makeStoredCredentials({ expiresAt: new Date(Date.now() - MS_IN_MINUTE).toISOString() }));

      expect((await cache.loadCachedToken())?.accessToken).toBe('stored-access-token');
      expect(writes).toHaveLength(0);
    });

    it('should return nothing when the user has no stored credentials', async () => {
      const { cache } = makeCache(null);
      expect(await cache.loadCachedToken()).not.toBeDefined();
    });
  });

  describe('updateCachedToken()', () => {
    it('should persist the renewed access token and its api domain', async () => {
      const { cache, writes } = makeCache(makeStoredCredentials());

      await cache.updateCachedToken(renewed);

      expect(writes).toHaveLength(1);
      expect(writes[0].providerType).toBe(ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
      expect(writes[0].credentials.accessToken).toBe('renewed-access-token');
      expect(writes[0].credentials.extra?.apiDomain).toBe('https://www.zohoapis.eu');
    });

    it('should retain the refresh token and the accounts server', async () => {
      // a Zoho access token carries neither, and dropping accountsServer breaks the NEXT refresh
      const { cache, writes } = makeCache(makeStoredCredentials());

      await cache.updateCachedToken(renewed);

      expect(writes[0].credentials.refreshToken).toBe('stored-refresh-token');
      expect(writes[0].credentials.extra?.accountsServer).toBe(ZOHO_ACCOUNTS_US_API_URL);
      expect(writes[0].credentials.extra?.location).toBe('us');
    });

    it('should not write when nothing is stored to merge onto', async () => {
      // a Zoho access token carries no refresh token, so writing it alone would store credentials that
      // can never be renewed
      const { cache, writes } = makeCache(null);

      await cache.updateCachedToken(renewed);

      expect(writes).toHaveLength(0);
    });
  });

  describe('clearCachedToken()', () => {
    it('should expire the access token WITHOUT dropping the refresh token', async () => {
      // Zoho's factory clears the cache to force its next call to refresh — that is a statement about
      // the access token only, and dropping the refresh token would turn a routine cache invalidation
      // into a connection the user has to re-authorize
      const { cache, writes } = makeCache(makeStoredCredentials());

      await cache.clearCachedToken();

      expect(writes).toHaveLength(1);
      expect(writes[0].credentials.refreshToken).toBe('stored-refresh-token');
      expect(writes[0].credentials.accessToken).toBe('');
      expect(new Date(writes[0].credentials.expiresAt as string).getTime()).toBe(0);
    });

    it('should not write when nothing is stored', async () => {
      const { cache, writes } = makeCache(null);

      await cache.clearCachedToken();

      expect(writes).toHaveLength(0);
    });
  });
});
