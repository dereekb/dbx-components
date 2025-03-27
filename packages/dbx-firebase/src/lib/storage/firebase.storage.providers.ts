import { EnvironmentProviders, Injector, makeEnvironmentProviders, Provider } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { FirebaseStorageContextFactoryConfig, clientFirebaseStorageContextFactory } from '@dereekb/firebase';
import { DBX_FIREBASE_STORAGE_CONTEXT_CONFIG_TOKEN, DBX_FIREBASE_STORAGE_CONTEXT_TOKEN } from './firebase.storage';
import { DbxFirebaseStorageService } from './firebase.storage.service';

export type DbxFirebaseStorageContextConfigFactory = (app: FirebaseApp, injector: Injector) => FirebaseStorageContextFactoryConfig;

/**
 * The default factory function for the DbxFirebaseStorageContext.
 *
 * @param base Optional base configuration to use.
 * @returns Factory function for the DbxFirebaseStorageContext.
 */
export function dbxFirebaseStorageProvidersContextConfigFactory(base?: FirebaseStorageContextFactoryConfig): DbxFirebaseStorageContextConfigFactory {
  return (app: FirebaseApp) => {
    return {
      defaultBucketId: base?.defaultBucketId || app.options.storageBucket,
      forceBucket: base?.forceBucket ?? false
    };
  };
}

/**
 * Configuration for provideDbxFirebaseStorage().
 */
export interface ProvideDbxFirebaseStorageConfig {
  /**
   * Optional context config to provide.
   */
  readonly contextConfig?: FirebaseStorageContextFactoryConfig;
  /**
   * Optional factory function to provide the context config.
   */
  readonly contextConfigFactory?: DbxFirebaseStorageContextConfigFactory;
}

/**
 * Creates EnvironmentProviders for the DbxFirebaseStorageService.
 *
 * @param config
 * @returns
 */
export function providedDbxFirebaseStorage(config?: ProvideDbxFirebaseStorageConfig): EnvironmentProviders {
  const configFactory = config?.contextConfigFactory ?? dbxFirebaseStorageProvidersContextConfigFactory(config?.contextConfig);

  const providers: Provider[] = [
    {
      provide: DBX_FIREBASE_STORAGE_CONTEXT_CONFIG_TOKEN,
      useFactory: configFactory,
      deps: [FirebaseApp, Injector]
    },
    {
      provide: DBX_FIREBASE_STORAGE_CONTEXT_TOKEN,
      useFactory: clientFirebaseStorageContextFactory,
      deps: [Storage, DBX_FIREBASE_STORAGE_CONTEXT_CONFIG_TOKEN]
    },
    DbxFirebaseStorageService
  ];

  return makeEnvironmentProviders(providers);
}
