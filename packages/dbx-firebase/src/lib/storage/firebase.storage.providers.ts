import { type EnvironmentProviders, Injector, makeEnvironmentProviders, type Provider } from '@angular/core';
import { type FirebaseApp } from 'firebase/app';
import { type FirebaseStorageContextFactoryConfig, clientFirebaseStorageContextFactory } from '@dereekb/firebase';
import { DBX_FIREBASE_STORAGE_CONTEXT_CONFIG_TOKEN, DBX_FIREBASE_STORAGE_CONTEXT_TOKEN } from './firebase.storage';
import { DbxFirebaseStorageService } from './firebase.storage.service';
import { FIREBASE_APP_TOKEN, FIREBASE_STORAGE_TOKEN } from '../firebase/firebase.tokens';

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
      deps: [FIREBASE_APP_TOKEN, Injector]
    },
    {
      provide: DBX_FIREBASE_STORAGE_CONTEXT_TOKEN,
      useFactory: clientFirebaseStorageContextFactory,
      deps: [FIREBASE_STORAGE_TOKEN, DBX_FIREBASE_STORAGE_CONTEXT_CONFIG_TOKEN]
    },
    DbxFirebaseStorageService
  ];

  return makeEnvironmentProviders(providers);
}
