import { type EnvironmentProviders, makeEnvironmentProviders, provideAppInitializer, type Provider, inject } from '@angular/core';
import { DbxAppAuthRouterService } from '@dereekb/dbx-core';
import { OidcModelFirestoreCollections } from '@dereekb/firebase';
import { DbxFirebaseOidcConfig, DbxFirebaseOidcConfigService } from './service/oidc.configuration.service';

/**
 * Provider factory for the {@link OidcModelFirestoreCollections}.
 *
 * @param appCollection - The application's Firestore collection that must implement {@link OidcModelFirestoreCollections}.
 * @returns The validated OidcModelFirestoreCollections instance.
 */
export function provideOidcModelFirestoreCollections(appCollection: OidcModelFirestoreCollections): OidcModelFirestoreCollections {
  if (!appCollection.oidcEntryCollection) {
    throw new Error(`OidcModelFirestoreCollections could not be provided using the app's app collection. Set provideOidcModelFirestoreCollections to false in ProvideDbxFirebaseOidcConfig to prevent auto-initialization, or update your app's collection class to implement OidcModelFirestoreCollections.`);
  }

  return appCollection;
}

/**
 * Configuration for {@link provideDbxFirebaseOidc}.
 */
export interface ProvideDbxFirebaseOidcConfig {
  /**
   * The app collection class that implements {@link OidcModelFirestoreCollections}.
   *
   * Used to resolve the {@link OidcModelFirestoreCollections} provider.
   */
  readonly appCollectionClass: abstract new (...args: any[]) => any;
  /**
   * Whether or not to provide the {@link OidcModelFirestoreCollections}.
   *
   * True by default.
   */
  readonly provideOidcModelFirestoreCollections?: boolean;
  /**
   * App-level OIDC configuration (scopes, endpoint paths).
   *
   * Provided as {@link DbxFirebaseOidcConfig} and consumed by {@link DbxFirebaseOidcConfigService}.
   */
  readonly oidcConfig: DbxFirebaseOidcConfig;
}

/**
 * Provides the OIDC-related Angular services and collections for `@dereekb/dbx-firebase/oidc`.
 *
 * When `oauthInteractionRoute` is configured in {@link DbxFirebaseOidcConfig}, an app initializer
 * is registered that adds that route to the {@link DbxAppAuthRouterService} ignored routes set,
 * preventing auth effects from redirecting away during the OIDC interaction flow.
 *
 * @param config - Configuration specifying the app collection class, OIDC settings, and provider options.
 * @returns EnvironmentProviders for the OIDC module.
 */
export function provideDbxFirebaseOidc(config: ProvideDbxFirebaseOidcConfig): EnvironmentProviders {
  const providers: (Provider | EnvironmentProviders)[] = [{ provide: DbxFirebaseOidcConfig, useValue: config.oidcConfig }, DbxFirebaseOidcConfigService];

  if (config.provideOidcModelFirestoreCollections !== false) {
    providers.push({
      provide: OidcModelFirestoreCollections,
      useFactory: provideOidcModelFirestoreCollections,
      deps: [config.appCollectionClass]
    });
  }

  // Register the OAuth interaction route as ignored by auth effects
  if (config.oidcConfig.oauthInteractionRoute) {
    const routeRef = config.oidcConfig.oauthInteractionRoute;
    providers.push(
      provideAppInitializer(() => {
        const authRouterService = inject(DbxAppAuthRouterService);
        authRouterService.addIgnoredRoute(routeRef);
      })
    );
  }

  return makeEnvironmentProviders(providers);
}
