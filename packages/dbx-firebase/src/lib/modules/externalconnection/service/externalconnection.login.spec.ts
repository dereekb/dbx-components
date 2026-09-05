import { describe, expect, it } from 'vitest';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as CALCOM, DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as DISCORD } from '@dereekb/firebase';
import { type DbxFirebaseExternalConnectionProvider } from './externalconnection';
import { dbxFirebaseExternalConnectionLoginProvider, dbxFirebaseExternalConnectionLoginProviders } from './externalconnection.login';
import { DbxFirebaseLoginExternalConnectionComponent } from './externalconnection.login.component';

const CONNECT_ONLY: DbxFirebaseExternalConnectionProvider = {
  providerType: CALCOM,
  assets: { providerName: 'Cal.com', icon: 'event' }
};

const SIGN_IN_CAPABLE: DbxFirebaseExternalConnectionProvider = {
  providerType: DISCORD,
  assets: { providerName: 'Discord', icon: 'forum', logoUrl: 'discord.svg', logoFilter: 'invert(1)' },
  signIn: { backgroundColor: '#5865F2', textColor: '#FFFFFF' }
};

describe('dbxFirebaseExternalConnectionLoginProvider()', () => {
  it('should derive nothing for a connect-only provider', () => {
    // registering a connect provider must not silently produce a login button for it
    expect(dbxFirebaseExternalConnectionLoginProvider(CONNECT_ONLY)).toBeUndefined();
  });

  it('should register under the provider type by default', () => {
    // legal with no type changes: FirebaseLoginMethodType is a bare string
    expect(dbxFirebaseExternalConnectionLoginProvider(SIGN_IN_CAPABLE)?.loginMethodType).toBe(DISCORD);
  });

  it('should honor an explicit login method type', () => {
    expect(dbxFirebaseExternalConnectionLoginProvider({ ...SIGN_IN_CAPABLE, signIn: { loginMethodType: 'discordsso' } })?.loginMethodType).toBe('discordsso');
  });

  it('should carry the provider type in componentData', () => {
    // the ONE thing a shared button component cannot read from the login registry
    expect(dbxFirebaseExternalConnectionLoginProvider(SIGN_IN_CAPABLE)?.componentData).toEqual({ providerType: DISCORD });
  });

  it('should use the one shared component for both login and registration', () => {
    // "Sign up with Discord" and "Log in with Discord" are one button in two situations
    const derived = dbxFirebaseExternalConnectionLoginProvider(SIGN_IN_CAPABLE);

    expect(derived?.componentClass).toBe(DbxFirebaseLoginExternalConnectionComponent);
    expect(derived?.registrationComponentClass).toBe(DbxFirebaseLoginExternalConnectionComponent);
  });

  it('should disallow linking', () => {
    // a custom-token user has NO providerData entry, so there is nothing to link or unlink —
    // managing the identity is the connect flow's job
    expect(dbxFirebaseExternalConnectionLoginProvider(SIGN_IN_CAPABLE)?.allowLinking).toBe(false);
  });

  it('should default the login text from the provider name', () => {
    expect(dbxFirebaseExternalConnectionLoginProvider(SIGN_IN_CAPABLE)?.assets.loginText).toBe('Log in with Discord');
  });

  it('should carry the brand colors the connection assets deliberately drop', () => {
    // a settings row uses a themed button; a sign-in button is a brand affordance
    const assets = dbxFirebaseExternalConnectionLoginProvider(SIGN_IN_CAPABLE)?.assets;

    expect(assets?.backgroundColor).toBe('#5865F2');
    expect(assets?.textColor).toBe('#FFFFFF');
  });

  it('should carry the logo and its filter over from the connection assets', () => {
    const assets = dbxFirebaseExternalConnectionLoginProvider(SIGN_IN_CAPABLE)?.assets;

    expect(assets?.logoUrl).toBe('discord.svg');
    expect(assets?.logoFilter).toBe('invert(1)');
  });
});

describe('dbxFirebaseExternalConnectionLoginProviders()', () => {
  it('should derive only the entries declaring a sign-in config', () => {
    expect(dbxFirebaseExternalConnectionLoginProviders([CONNECT_ONLY, SIGN_IN_CAPABLE]).map((x) => x.loginMethodType)).toEqual([DISCORD]);
  });

  it('should accept a known provider type entry', () => {
    // the library's known providers are connect-only, so naming one yields no login button
    expect(dbxFirebaseExternalConnectionLoginProviders([DISCORD])).toEqual([]);
  });
});
