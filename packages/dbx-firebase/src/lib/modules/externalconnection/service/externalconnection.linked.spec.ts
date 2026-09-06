import { describe, expect, it } from 'vitest';
import { DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as DISCORD, CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as CALCOM, type UserExternalConnectionLoginMap } from '@dereekb/firebase';
import { type DbxFirebaseExternalConnectionProvider } from './externalconnection';
import { type DbxFirebaseExternalConnectionService } from './externalconnection.service';
import { dbxFirebaseExternalConnectionLinkedLoginMethodTypes } from './externalconnection.linked';

const now = new Date();

function loginMap(...providerTypes: string[]): UserExternalConnectionLoginMap {
  return Object.fromEntries(providerTypes.map((x) => [x, { ea: `${x}-account`, lat: now, uat: now }]));
}

/**
 * The narrowest stand-in for the registry: only `getProvider` is read.
 *
 * @param providers - The registered providers, keyed by provider type.
 * @returns Something usable as the registry service.
 */
function stubService(providers: Record<string, DbxFirebaseExternalConnectionProvider>): DbxFirebaseExternalConnectionService {
  return { getProvider: (providerType: string) => providers[providerType] } as unknown as DbxFirebaseExternalConnectionService;
}

const SIGN_IN_CAPABLE: DbxFirebaseExternalConnectionProvider = { providerType: DISCORD, assets: { providerName: 'Discord' }, signIn: {} };
const CONNECT_ONLY: DbxFirebaseExternalConnectionProvider = { providerType: CALCOM, assets: { providerName: 'Cal.com' } };

describe('dbxFirebaseExternalConnectionLinkedLoginMethodTypes()', () => {
  it('should report a linked provider under its provider type', () => {
    expect(dbxFirebaseExternalConnectionLinkedLoginMethodTypes(loginMap(DISCORD), stubService({ [DISCORD]: SIGN_IN_CAPABLE }))).toEqual([DISCORD]);
  });

  it('should report it under an explicit login method type', () => {
    const provider = { ...SIGN_IN_CAPABLE, signIn: { loginMethodType: 'discordsso' } };
    expect(dbxFirebaseExternalConnectionLinkedLoginMethodTypes(loginMap(DISCORD), stubService({ [DISCORD]: provider }))).toEqual(['discordsso']);
  });

  it('should omit a provider that is not registered for sign-in', () => {
    // a link recorded for a provider the app no longer offers as a login method would otherwise put an
    // unrenderable row in the unlink list
    expect(dbxFirebaseExternalConnectionLinkedLoginMethodTypes(loginMap(CALCOM), stubService({ [CALCOM]: CONNECT_ONLY }))).toEqual([]);
  });

  it('should omit a provider that is not registered at all', () => {
    expect(dbxFirebaseExternalConnectionLinkedLoginMethodTypes(loginMap('zoho'), stubService({}))).toEqual([]);
  });

  it('should be empty for a user with no login links', () => {
    expect(dbxFirebaseExternalConnectionLinkedLoginMethodTypes(null, stubService({ [DISCORD]: SIGN_IN_CAPABLE }))).toEqual([]);
  });
});
