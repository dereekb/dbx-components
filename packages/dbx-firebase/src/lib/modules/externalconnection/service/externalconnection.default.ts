import { type KnownUserExternalConnectionProviderType, CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type DbxActionConfirmConfig } from '@dereekb/dbx-web';
import { type DbxFirebaseExternalConnectionConnectFunction, type DbxFirebaseExternalConnectionProvider, type DbxFirebaseExternalConnectionProviderAssets, type DbxFirebaseExternalConnectionProviderEntry } from './externalconnection';

/**
 * Default presentation for Cal.com.
 *
 * `icon` is a Material Symbols name throughout these defaults: the brand logo set the login registry
 * pulls from covers Firebase's own auth providers only, so a real mark for any of these services
 * would need a new asset. An app that has one passes `assets.logoUrl` instead.
 */
export const DBX_FIREBASE_EXTERNAL_CONNECTION_CALCOM_PROVIDER: DbxFirebaseExternalConnectionProvider = {
  providerType: CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
  assets: {
    providerName: 'Cal.com',
    icon: 'event',
    description: 'Schedule and manage bookings from your Cal.com account.'
  }
};

/**
 * Default presentation for Zoom.
 */
export const DBX_FIREBASE_EXTERNAL_CONNECTION_ZOOM_PROVIDER: DbxFirebaseExternalConnectionProvider = {
  providerType: ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
  assets: {
    providerName: 'Zoom',
    icon: 'videocam',
    description: 'Create and manage Zoom meetings.'
  }
};

/**
 * Default presentation for Discord.
 */
export const DBX_FIREBASE_EXTERNAL_CONNECTION_DISCORD_PROVIDER: DbxFirebaseExternalConnectionProvider = {
  providerType: DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
  assets: {
    providerName: 'Discord',
    icon: 'forum',
    description: 'Link your Discord account.'
  }
};

/**
 * Default presentation for Zoho.
 */
export const DBX_FIREBASE_EXTERNAL_CONNECTION_ZOHO_PROVIDER: DbxFirebaseExternalConnectionProvider = {
  providerType: ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
  assets: {
    providerName: 'Zoho',
    icon: 'work',
    description: 'Connect your Zoho account.'
  }
};

/**
 * The library's provider for each known third-party service, keyed by provider type.
 *
 * Every service the workspace ships a server-side OAuth adapter for appears here, so an app that
 * mounts one of those controllers has nothing to declare on the client beyond naming it.
 */
export const DBX_FIREBASE_KNOWN_EXTERNAL_CONNECTION_PROVIDERS: Record<KnownUserExternalConnectionProviderType, DbxFirebaseExternalConnectionProvider> = {
  calcom: DBX_FIREBASE_EXTERNAL_CONNECTION_CALCOM_PROVIDER,
  zoom: DBX_FIREBASE_EXTERNAL_CONNECTION_ZOOM_PROVIDER,
  discord: DBX_FIREBASE_EXTERNAL_CONNECTION_DISCORD_PROVIDER,
  zoho: DBX_FIREBASE_EXTERNAL_CONNECTION_ZOHO_PROVIDER
};

/**
 * Config for {@link dbxFirebaseKnownExternalConnectionProvider}.
 */
export interface DbxFirebaseKnownExternalConnectionProviderConfig {
  /**
   * The known provider to start from.
   */
  readonly providerType: KnownUserExternalConnectionProviderType;
  /**
   * Asset values to merge over the known provider's, so an app can reword one line without
   * restating the rest.
   */
  readonly assets?: Maybe<Partial<DbxFirebaseExternalConnectionProviderAssets>>;
  /**
   * Overrides the known provider's authorize path.
   */
  readonly authorizePath?: Maybe<string>;
  /**
   * Overrides the default redirect-based connect behavior.
   */
  readonly connect?: Maybe<DbxFirebaseExternalConnectionConnectFunction>;
  /**
   * Confirmation shown before disconnecting.
   */
  readonly disconnectConfirm?: Maybe<DbxActionConfirmConfig>;
}

/**
 * Builds a provider from a known one, with the given overrides applied.
 *
 * @param config - The known provider to start from, plus the values to override.
 * @returns The provider to register.
 * @throws {Error} When there is no known provider for the given type.
 */
export function dbxFirebaseKnownExternalConnectionProvider(config: DbxFirebaseKnownExternalConnectionProviderConfig): DbxFirebaseExternalConnectionProvider {
  const { providerType, assets, authorizePath, connect, disconnectConfirm } = config;
  const known = DBX_FIREBASE_KNOWN_EXTERNAL_CONNECTION_PROVIDERS[providerType];

  if (known == null) {
    throw new Error(`dbxFirebaseKnownExternalConnectionProvider(): there is no known provider for "${providerType}".`);
  }

  return {
    ...known,
    assets: { ...known.assets, ...assets },
    authorizePath: authorizePath ?? known.authorizePath,
    connect: connect ?? known.connect,
    disconnectConfirm: disconnectConfirm ?? known.disconnectConfirm
  };
}

/**
 * Resolves a configured entry to the provider to register.
 *
 * @param entry - A known provider type, or a fully-declared provider.
 * @returns The provider to register.
 * @throws {Error} When the entry names a provider type the library has no defaults for.
 */
export function dbxFirebaseExternalConnectionProviderForEntry(entry: DbxFirebaseExternalConnectionProviderEntry): DbxFirebaseExternalConnectionProvider {
  let result: DbxFirebaseExternalConnectionProvider;

  if (typeof entry === 'string') {
    const known = DBX_FIREBASE_KNOWN_EXTERNAL_CONNECTION_PROVIDERS[entry];

    if (known == null) {
      throw new Error(`dbxFirebaseExternalConnectionProviderForEntry(): there is no known provider for "${entry}". Declare the provider instead of naming it.`);
    }

    result = known;
  } else {
    result = entry;
  }

  return result;
}
