import { inject, provideAppInitializer, type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { type ClassLikeType, type Maybe } from '@dereekb/util';
import { type UserExternalConnectionFirestoreCollections } from '@dereekb/firebase';
import { DbxFirebaseAuthLoginService } from '../../auth/login/login.service';
import { DBX_FIREBASE_LINKED_LOGIN_METHODS_SOURCES_TOKEN } from '../../auth/login/login.linked';
import { DbxFirebaseExternalConnectionLinkedLoginMethodsSource } from './service/externalconnection.linked';
import { DbxFirebaseExternalConnectionsConfig } from './service/externalconnection';
import { dbxFirebaseExternalConnectionLoginProviders } from './service/externalconnection.login';
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
  /**
   * Whether to complete an in-flight sign-in on app start, when the landing url carries a ticket.
   * Defaults to true.
   *
   * The other half of `signInWithProvider()`: without it the browser returns from the provider with a
   * ticket nothing ever redeems. Turn it off only for an app that calls
   * `handleSignInRedirectResult()` itself, e.g. from a dedicated callback route.
   */
  readonly handleSignInRedirectResult?: Maybe<boolean>;
  /**
   * Whether to record a refused connect on app start, when the landing url carries one. Defaults to true.
   *
   * Reads the `connectError` / `connectErrorProvider` parameters the server's connect failure redirect
   * carries into the service's `connectFailure` signal, which `dbx-firebase-external-connections` renders
   * as a banner. Synchronous and network-free. Turn it off only for an app that calls
   * `handleConnectRedirectResult()` itself.
   */
  readonly handleConnectRedirectResult?: Maybe<boolean>;
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
    },
    {
      // contributed rather than read directly by `auth/login`, which must not depend on this module —
      // it is the half that already depends on `auth/login`
      provide: DBX_FIREBASE_LINKED_LOGIN_METHODS_SOURCES_TOKEN,
      useClass: DbxFirebaseExternalConnectionLinkedLoginMethodsSource,
      multi: true
    },
    provideAppInitializer(() => {
      // registered here rather than through `provideDbxFirebaseLogin`'s `additionalProviders` so the
      // two declarations cannot drift: an app names Discord once, and both the settings row and the
      // login button follow from it. `override: false` leaves an app's explicit login registration
      // for the same method type in charge.
      const loginService = inject(DbxFirebaseAuthLoginService, { optional: true });

      if (loginService) {
        dbxFirebaseExternalConnectionLoginProviders(config.providers).forEach((x) => loginService.register(x, false));
      }

      const handleSignInRedirectResult = config.handleSignInRedirectResult ?? true;
      const handleConnectRedirectResult = config.handleConnectRedirectResult ?? true;

      if (handleSignInRedirectResult || handleConnectRedirectResult) {
        const externalConnectionService = inject(DbxFirebaseExternalConnectionService);

        if (handleSignInRedirectResult) {
          // deliberately not awaited: a failed redemption must not block the app from booting, and the
          // user is already looking at a page that renders fine signed out
          externalConnectionService.handleSignInRedirectResult().catch((e: unknown) => console.error('DbxFirebaseExternalConnectionService: failed completing a sign-in redirect: ', e));
        }

        if (handleConnectRedirectResult) {
          externalConnectionService.handleConnectRedirectResult();
        }
      }
    })
  ];

  return makeEnvironmentProviders(providers);
}
