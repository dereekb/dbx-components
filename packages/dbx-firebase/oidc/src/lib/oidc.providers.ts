import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { OidcModelFirestoreCollections } from '@dereekb/firebase';

/**
 * Provider factory for the {@link OidcModelFirestoreCollections}.
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
}

/**
 * Provides the OIDC-related Angular services and collections for `@dereekb/dbx-firebase/oidc`.
 */
export function provideDbxFirebaseOidc(config: ProvideDbxFirebaseOidcConfig): EnvironmentProviders {
  const providers: Provider[] = [];

  if (config.provideOidcModelFirestoreCollections !== false) {
    providers.push({
      provide: OidcModelFirestoreCollections,
      useFactory: provideOidcModelFirestoreCollections,
      deps: [config.appCollectionClass]
    });
  }

  return makeEnvironmentProviders(providers);
}
