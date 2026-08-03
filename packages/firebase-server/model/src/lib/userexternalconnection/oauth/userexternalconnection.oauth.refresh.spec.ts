import { describe, expect, it } from 'vitest';
import { type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { type AbstractUserExternalConnectionOAuthService } from './userexternalconnection.oauth.service';
import { userExternalConnectionOAuthProviderRegistry } from './userexternalconnection.oauth.registry';
import { userExternalConnectionOAuthRegistryCredentialsRefresher } from './userexternalconnection.oauth.refresh';

const TEST_UID = 'test-uid';

const STORED: UserExternalConnectionCredentials = {
  accessToken: 'stored-access-token',
  refreshToken: 'stored-refresh-token',
  issuedAt: new Date().toISOString()
};

interface SeenRefresh {
  readonly uid: string;
  readonly credentials: UserExternalConnectionCredentials;
}

/**
 * A service that implements the optional refresh hook.
 *
 * @param providerType - The provider the service claims.
 * @param seen - Collects what the hook was called with.
 * @returns The stub service.
 */
function makeRefreshingService(providerType: UserExternalConnectionProviderType, seen: SeenRefresh[]): AbstractUserExternalConnectionOAuthService {
  return {
    providerType,
    refreshCredentials: async (input: SeenRefresh) => {
      seen.push(input);
      return { accessToken: `${providerType}-refreshed`, issuedAt: new Date().toISOString() };
    }
  } as unknown as AbstractUserExternalConnectionOAuthService;
}

/**
 * A service that does NOT implement the optional refresh hook.
 *
 * @param providerType - The provider the service claims.
 * @returns The stub service.
 */
function makeNonRefreshingService(providerType: UserExternalConnectionProviderType): AbstractUserExternalConnectionOAuthService {
  return { providerType } as unknown as AbstractUserExternalConnectionOAuthService;
}

describe('userExternalConnectionOAuthRegistryCredentialsRefresher()', () => {
  it('should dispatch to the service registered for the provider', async () => {
    const seen: SeenRefresh[] = [];
    const registry = userExternalConnectionOAuthProviderRegistry([makeRefreshingService('calcom', seen), makeRefreshingService('zoho', seen)]);
    const refresher = userExternalConnectionOAuthRegistryCredentialsRefresher({ registry });

    const result = await refresher.refreshUserExternalConnectionCredentials({ uid: TEST_UID, providerType: 'zoho', credentials: STORED });

    expect(result?.accessToken).toBe('zoho-refreshed');
    expect(seen).toHaveLength(1);
    expect(seen[0].uid).toBe(TEST_UID);
    expect(seen[0].credentials.refreshToken).toBe('stored-refresh-token');
  });

  it('should return null for a provider that has no registered service', async () => {
    // an app that never imported a provider's module cannot refresh for it, and that is a
    // configuration fact rather than a provider failure
    const registry = userExternalConnectionOAuthProviderRegistry([makeRefreshingService('calcom', [])]);
    const refresher = userExternalConnectionOAuthRegistryCredentialsRefresher({ registry });

    const result = await refresher.refreshUserExternalConnectionCredentials({ uid: TEST_UID, providerType: 'discord', credentials: STORED });

    expect(result).toBeNull();
  });

  it('should return null for a registered service that implements no refresh hook', async () => {
    // the hook is optional, so a provider without one must resolve rather than throw a TypeError
    const registry = userExternalConnectionOAuthProviderRegistry([makeNonRefreshingService('calcom')]);
    const refresher = userExternalConnectionOAuthRegistryCredentialsRefresher({ registry });

    const result = await refresher.refreshUserExternalConnectionCredentials({ uid: TEST_UID, providerType: 'calcom', credentials: STORED });

    expect(result).toBeNull();
  });
});
