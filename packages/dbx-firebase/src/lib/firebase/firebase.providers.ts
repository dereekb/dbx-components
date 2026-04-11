import { type EnvironmentProviders, type Provider, makeEnvironmentProviders, Optional } from '@angular/core';
import { type FirebaseApp, initializeApp } from 'firebase/app';
import { type AppCheck, initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type FirestoreSettings, persistentSingleTabManager } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { FIREBASE_APP_TOKEN, FIREBASE_AUTH_TOKEN, FIREBASE_FIRESTORE_TOKEN, FIREBASE_STORAGE_TOKEN, FIREBASE_FUNCTIONS_TOKEN, FIREBASE_APP_CHECK_TOKEN } from './firebase.tokens';
import { DbxFirebaseParsedEmulatorsConfig } from './emulators';
import { type DbxFirebaseAppOptions, DBX_FIREBASE_APP_OPTIONS_TOKEN } from './firebase.options';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { enableAppCheckDebugTokenGeneration } from '../auth/appcheck/appcheck';
import { DbxFirebaseAppCheckHttpInterceptor } from '../auth/appcheck/appcheck.interceptor';
import { type Maybe, pushArrayItemsIntoArray } from '@dereekb/util';

/**
 * Configuration for provideDbxFirebaseApp().
 */
export interface ProvideDbxFirebaseAppConfig {
  /**
   * DbxFirebaseAppOptions for the app.
   *
   * Is automatically configured as a provider for the DBX_FIREBASE_APP_OPTIONS_TOKEN.
   */
  readonly dbxFirebaseAppOptions: DbxFirebaseAppOptions;
  /**
   * Whether or not to provide Firestore configuration.
   *
   * True by default.
   */
  readonly provideFirestore?: Maybe<boolean>;
  /**
   * Whether or not to provide App Check configuration.
   *
   * True by default.
   */
  readonly provideAppCheck?: Maybe<boolean>;
  /**
   * Whether or not to provide Auth configuration.
   *
   * True by default.
   */
  readonly provideAuth?: Maybe<boolean>;
  /**
   * Whether or not to provide Storage configuration.
   *
   * True by default.
   */
  readonly provideStorage?: Maybe<boolean>;
  /**
   * Whether or not to provide Functions configuration.
   *
   * True by default.
   */
  readonly provideFunctions?: Maybe<boolean>;
}

/**
 * Provides EnvironmentProviders for all Firebase services.
 *
 * @param config
 * @returns EnvironmentProviders
 */
export function provideDbxFirebaseApp(config: ProvideDbxFirebaseAppConfig): EnvironmentProviders {
  const { dbxFirebaseAppOptions: dbxFirebaseOptions } = config;

  const providers: (Provider | EnvironmentProviders)[] = [
    // options
    {
      provide: DBX_FIREBASE_APP_OPTIONS_TOKEN,
      useValue: dbxFirebaseOptions
    },

    // app
    {
      provide: FIREBASE_APP_TOKEN,
      useFactory: (options: DbxFirebaseAppOptions) => initializeApp(options),
      deps: [DBX_FIREBASE_APP_OPTIONS_TOKEN]
    }
  ];

  // firestore
  if (config.provideFirestore !== false) {
    providers.push({
      provide: FIREBASE_FIRESTORE_TOKEN,
      useFactory: (app: FirebaseApp, options: DbxFirebaseAppOptions, emulators?: DbxFirebaseParsedEmulatorsConfig) => {
        const firestoreSettings: FirestoreSettings = {};

        const { enableMultiTabIndexedDbPersistence, enableIndexedDbPersistence } = options;
        const { persistentCacheSettings } = options;

        if (enableIndexedDbPersistence !== false) {
          let tabManager;

          if (enableMultiTabIndexedDbPersistence !== false) {
            tabManager = persistentMultipleTabManager();
          } else {
            tabManager = persistentSingleTabManager(undefined);
          }

          firestoreSettings.localCache = persistentLocalCache({
            tabManager,
            ...persistentCacheSettings
          });
        }

        const firestore = initializeFirestore(app, firestoreSettings);

        if (emulators?.useEmulators && emulators?.firestore) {
          connectFirestoreEmulator(firestore, emulators.firestore.host, emulators.firestore.port, {});
        }

        return firestore;
      },
      deps: [FIREBASE_APP_TOKEN, DBX_FIREBASE_APP_OPTIONS_TOKEN, [new Optional(), DbxFirebaseParsedEmulatorsConfig]]
    });
  }

  // app check
  if (config.provideAppCheck !== false) {
    const appCheckProviders: Provider[] = [
      {
        provide: FIREBASE_APP_CHECK_TOKEN,
        useFactory: (app: FirebaseApp, options: DbxFirebaseAppOptions) => {
          const appCheckOptions = options.appCheck;
          const appCheckKnowinglyDisabled = appCheckOptions?.disabled === true || options.emulators?.useEmulators === true;

          let appCheck: AppCheck;

          if (appCheckOptions && !appCheckKnowinglyDisabled) {
            // enable the debug tokens if not using emulators and allowDebugTokens is set true
            if (!options.emulators?.useEmulators && appCheckOptions.allowDebugTokens) {
              enableAppCheckDebugTokenGeneration(true);
            }

            // Only enabled outside of app-check environments. The emulators will not use appcheck.
            appCheck = initializeAppCheck(app, {
              provider: new ReCaptchaV3Provider(appCheckOptions.reCaptchaV3),
              isTokenAutoRefreshEnabled: appCheckOptions.isTokenAutoRefreshEnabled ?? true
            });

            console.log('Enabled AppCheck.');
          } else {
            appCheck = undefined as unknown as AppCheck;

            if (!appCheckKnowinglyDisabled) {
              console.error('dbx-firebase: No appcheck configuration for the app, and not specifically disabled in config either.');
            }
          }

          return appCheck;
        },
        deps: [FIREBASE_APP_TOKEN, DBX_FIREBASE_APP_OPTIONS_TOKEN]
      },
      {
        provide: HTTP_INTERCEPTORS,
        useClass: DbxFirebaseAppCheckHttpInterceptor,
        multi: true
      }
    ];

    pushArrayItemsIntoArray(providers, appCheckProviders);
  }

  // auth
  if (config.provideAuth !== false) {
    providers.push({
      provide: FIREBASE_AUTH_TOKEN,
      useFactory: (app: FirebaseApp, emulators?: DbxFirebaseParsedEmulatorsConfig) => {
        const auth = getAuth(app);

        if (emulators?.useEmulators && emulators?.auth) {
          connectAuthEmulator(auth, `http://${emulators.auth.host}:${emulators.auth.port}`);
        }

        return auth;
      },
      deps: [FIREBASE_APP_TOKEN, [new Optional(), DbxFirebaseParsedEmulatorsConfig]]
    });
  }

  // storage
  if (config.provideStorage !== false) {
    providers.push({
      provide: FIREBASE_STORAGE_TOKEN,
      useFactory: (app: FirebaseApp, emulators?: DbxFirebaseParsedEmulatorsConfig) => {
        const storage = getStorage(app);

        if (emulators?.useEmulators && emulators?.storage) {
          connectStorageEmulator(storage, emulators.storage.host, emulators.storage.port, {});
        }

        return storage;
      },
      deps: [FIREBASE_APP_TOKEN, [new Optional(), DbxFirebaseParsedEmulatorsConfig]]
    });
  }

  // functions
  if (config.provideFunctions !== false) {
    providers.push({
      provide: FIREBASE_FUNCTIONS_TOKEN,
      useFactory: (app: FirebaseApp, options: DbxFirebaseAppOptions, emulators?: DbxFirebaseParsedEmulatorsConfig) => {
        const { functionsRegionOrCustomDomain } = options;
        const functions = getFunctions(app, functionsRegionOrCustomDomain);

        if (emulators?.useEmulators && emulators?.functions) {
          connectFunctionsEmulator(functions, emulators.functions.host, emulators.functions.port);
        }

        return functions;
      },
      deps: [FIREBASE_APP_TOKEN, DBX_FIREBASE_APP_OPTIONS_TOKEN, [new Optional(), DbxFirebaseParsedEmulatorsConfig]]
    });
  }

  return makeEnvironmentProviders(providers);
}
