import { describe, expect, it } from 'vitest';
import { DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type KnownUserExternalConnectionProviderType, ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE } from '@dereekb/firebase';
import { type DbxFirebaseExternalConnectionProvider } from './externalconnection';
import { DBX_FIREBASE_EXTERNAL_CONNECTION_DISCORD_PROVIDER, DBX_FIREBASE_KNOWN_EXTERNAL_CONNECTION_PROVIDERS, dbxFirebaseExternalConnectionProviderForEntry, dbxFirebaseKnownExternalConnectionProvider } from './externalconnection.default';

describe('DBX_FIREBASE_KNOWN_EXTERNAL_CONNECTION_PROVIDERS', () => {
  it('should key each provider by its own provider type', () => {
    Object.entries(DBX_FIREBASE_KNOWN_EXTERNAL_CONNECTION_PROVIDERS).forEach(([providerType, provider]) => {
      expect(provider.providerType).toBe(providerType);
    });
  });

  it('should name every provider, since an unnamed row is not renderable', () => {
    Object.values(DBX_FIREBASE_KNOWN_EXTERNAL_CONNECTION_PROVIDERS).forEach((provider) => {
      expect(provider.assets.providerName.length).toBeGreaterThan(0);
    });
  });
});

describe('dbxFirebaseExternalConnectionProviderForEntry()', () => {
  it('should resolve a known provider type to the library provider', () => {
    expect(dbxFirebaseExternalConnectionProviderForEntry(DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE)).toBe(DBX_FIREBASE_EXTERNAL_CONNECTION_DISCORD_PROVIDER);
  });

  it('should pass a declared provider through untouched', () => {
    const provider: DbxFirebaseExternalConnectionProvider = { providerType: 'internal', assets: { providerName: 'Internal' } };

    expect(dbxFirebaseExternalConnectionProviderForEntry(provider)).toBe(provider);
  });

  it('should throw for a type it has no provider for', () => {
    expect(() => dbxFirebaseExternalConnectionProviderForEntry('nope' as KnownUserExternalConnectionProviderType)).toThrow('no known provider');
  });
});

describe('dbxFirebaseKnownExternalConnectionProvider()', () => {
  it('should merge the given assets over the known ones', () => {
    const result = dbxFirebaseKnownExternalConnectionProvider({
      providerType: ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
      assets: { description: 'Connect Zoho to sync your contacts.' }
    });

    expect(result.providerType).toBe(ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
    expect(result.assets.description).toBe('Connect Zoho to sync your contacts.');
    // the values not overridden survive
    expect(result.assets.providerName).toBe('Zoho');
    expect(result.assets.icon).toBe('work');
  });

  it('should keep the known provider as-is when nothing is overridden', () => {
    const result = dbxFirebaseKnownExternalConnectionProvider({ providerType: DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE });

    expect(result).toEqual(expect.objectContaining({ providerType: DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, assets: DBX_FIREBASE_EXTERNAL_CONNECTION_DISCORD_PROVIDER.assets }));
  });

  it('should apply an authorize path override', () => {
    const result = dbxFirebaseKnownExternalConnectionProvider({ providerType: DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, authorizePath: '/connect/discord' });

    expect(result.authorizePath).toBe('/connect/discord');
  });
});
