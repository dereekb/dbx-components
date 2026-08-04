import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { type ClassLikeType } from '@dereekb/util';
import { type UserExternalConnectionFirestoreCollections } from '@dereekb/firebase';
import { DbxFirebaseExternalConnectionsConfig } from './service/externalconnection';
import { DbxFirebaseExternalConnectionService } from './service/externalconnection.service';
import { DbxFirebaseUserExternalConnectionCollections } from './store/userexternalconnection.document.store';

/**
 * Configuration for provideDbxFirebaseExternalConnections().
 */
export interface ProvideDbxFirebaseExternalConnectionsConfig extends DbxFirebaseExternalConnectionsConfig {
  /**
   * The app's Firestore collections class, which must implement `UserExternalConnectionFirestoreCollections`.
   *
   * Passed explicitly rather than derived, for the same reason `provideDbxFirestoreCollection()`
   * takes it: the library never names an app's collections class.
   */
  readonly appCollectionClass: ClassLikeType<UserExternalConnectionFirestoreCollections>;
}

/**
 * Registers the third-party connection providers an app offers, plus the registry service and the
 * collection token the connection stores read from.
 *
 * A SIBLING of `provideDbxFirebase()` (like `provideDbxFirebaseLogin()` / `provideDbxFirebaseOidc()`)
 * rather than part of it: it requires an app-supplied provider catalog and depends on
 * `provideDbxFirestoreCollection()` having run.
 *
 * Naming a known provider type is all an app needs to offer that service: the library carries the
 * presentation, and the connect flow — minting the signed `state`, then redirecting to the authorize
 * url carrying it — is the library's default. Nothing about it belongs in an app's config.
 *
 * @param config - The provider catalog and authorize configuration.
 * @returns EnvironmentProviders.
 *
 * @example
 * ```ts
 * provideDbxFirebaseExternalConnections({
 *   appCollectionClass: DemoFirestoreCollections,
 *   authorizeOrigin: environment.externalConnectionAuthorizeOrigin,
 *   providers: [
 *     CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
 *     // start from a known provider and reword one line
 *     dbxFirebaseKnownExternalConnectionProvider({ providerType: DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, assets: { description: 'Link Discord to get notified in your server.' } }),
 *     // or declare a service the library has no defaults for
 *     APP_INTERNAL_EXTERNAL_CONNECTION_PROVIDER
 *   ]
 * })
 * ```
 */
export function provideDbxFirebaseExternalConnections(config: ProvideDbxFirebaseExternalConnectionsConfig): EnvironmentProviders {
  const { appCollectionClass } = config;

  const providers: (EnvironmentProviders | Provider)[] = [
    {
      provide: DbxFirebaseExternalConnectionsConfig,
      useValue: config
    },
    {
      provide: DbxFirebaseUserExternalConnectionCollections,
      useExisting: appCollectionClass
    },
    {
      provide: DbxFirebaseExternalConnectionService,
      useClass: DbxFirebaseExternalConnectionService
    }
  ];

  return makeEnvironmentProviders(providers);
}
