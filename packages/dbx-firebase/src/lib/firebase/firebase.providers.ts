import { ModuleWithProviders, NgModule, Injector, EnvironmentProviders, Provider, makeEnvironmentProviders } from '@angular/core';
import { FirebaseOptions, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { FirebaseApp, provideFirebaseApp } from '@angular/fire/app';
import { provideStorage, getStorage, connectStorageEmulator } from '@angular/fire/storage';
import { provideFunctions, getFunctions, connectFunctionsEmulator } from '@angular/fire/functions';
import { provideFirestore, connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, FirestoreSettings, persistentSingleTabManager } from '@angular/fire/firestore';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { AppCheck, provideAppCheck } from '@angular/fire/app-check';
import { DbxFirebaseParsedEmulatorsConfig } from './emulators';
import { DbxFirebaseOptions, DBX_FIREBASE_OPTIONS_TOKEN } from './options';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { enableAppCheckDebugTokenGeneration } from '../auth/appcheck';
import { DbxFirebaseAppCheckHttpInterceptor } from '../auth/appcheck/appcheck.interceptor';
import { Maybe, pushArrayItemsIntoArray } from 'packages/util/src/lib';

/**
 * Configuration for provideDbxFirebaseApp().
 */
export interface ProvideDbxFirebaseAppConfig {
  /**
   * DbxFirebaseOptions for the app.
   *
   * Is automatically configured as a provider for the DBX_FIREBASE_OPTIONS_TOKEN.
   */
  readonly dbxFirebaseOptions: DbxFirebaseOptions;
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
  const { dbxFirebaseOptions } = config;

  const providers: (Provider | EnvironmentProviders)[] = [
    // options
    makeEnvironmentProviders([
      {
        provide: DBX_FIREBASE_OPTIONS_TOKEN,
        useValue: dbxFirebaseOptions
      }
    ]),

    // app
    provideFirebaseApp((injector: Injector) => {
      const firebaseOptions = injector.get<DbxFirebaseOptions>(DBX_FIREBASE_OPTIONS_TOKEN);
      return initializeApp(firebaseOptions);
    })
  ];

  // firestore
  if (config.provideFirestore !== false) {
    const firestoreProvider = provideFirestore((injector: Injector) => {
      const firebaseApp = injector.get(FirebaseApp);
      const firebaseOptions = injector.get<DbxFirebaseOptions>(DBX_FIREBASE_OPTIONS_TOKEN);

      const firestoreSettings: FirestoreSettings = {};

      const { enableMultiTabIndexedDbPersistence, enableIndexedDbPersistence } = firebaseOptions;
      const { persistentCacheSettings } = firebaseOptions;

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

      const firestore = initializeFirestore(firebaseApp, firestoreSettings);
      const emulators = injector.get<DbxFirebaseParsedEmulatorsConfig>(DbxFirebaseParsedEmulatorsConfig, undefined);

      if (emulators?.useEmulators && emulators?.firestore) {
        connectFirestoreEmulator(firestore, emulators.firestore.host, emulators.firestore.port, {});
      }

      return firestore;
    });

    providers.push(firestoreProvider);
  }

  // app check
  if (config.provideAppCheck !== false) {
    const appCheckProviders = [
      provideAppCheck((injector: Injector) => {
        const firebaseApp = injector.get(FirebaseApp);
        const firebaseOptions = injector.get<DbxFirebaseOptions>(DBX_FIREBASE_OPTIONS_TOKEN);
        const appCheckOptions = firebaseOptions.appCheck;
        const appCheckKnowinglyDisabled = appCheckOptions?.disabled === true || firebaseOptions.emulators?.useEmulators === true;
        let appCheck: AppCheck;

        if (appCheckOptions && !appCheckKnowinglyDisabled) {
          // enable the debug tokens if not using emulators and allowDebugTokens is set true
          if (firebaseOptions.emulators?.useEmulators !== true && appCheckOptions.allowDebugTokens) {
            enableAppCheckDebugTokenGeneration(true);
          }

          // Only enabled outside of app-check environments. The emulators will not use appcheck.
          appCheck = initializeAppCheck(firebaseApp, {
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
      }),
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
    const authProvider = provideAuth((injector: Injector) => {
      const firebaseApp = injector.get(FirebaseApp);
      const auth = getAuth(firebaseApp);
      const emulators = injector.get<DbxFirebaseParsedEmulatorsConfig>(DbxFirebaseParsedEmulatorsConfig, undefined);

      if (emulators?.useEmulators && emulators?.auth) {
        connectAuthEmulator(auth, `http://${emulators.auth.host}:${emulators.auth.port}`);
      }

      return auth;
    });

    providers.push(authProvider);
  }

  // storage
  if (config.provideStorage !== false) {
    const storageProvider = provideStorage((injector: Injector) => {
      const firebaseApp = injector.get(FirebaseApp);
      const storage = getStorage(firebaseApp);
      const emulators = injector.get<DbxFirebaseParsedEmulatorsConfig>(DbxFirebaseParsedEmulatorsConfig, undefined);

      if (emulators?.useEmulators && emulators?.storage) {
        connectStorageEmulator(storage, emulators.storage.host, emulators.storage.port, {});
      }

      return storage;
    });

    providers.push(storageProvider);
  }

  // functions
  if (config.provideFunctions !== false) {
    const functionsProvider = provideFunctions((injector: Injector) => {
      const firebaseApp = injector.get(FirebaseApp);
      const firebaseOptions = injector.get<DbxFirebaseOptions>(DBX_FIREBASE_OPTIONS_TOKEN);
      const { functionsRegionOrCustomDomain } = firebaseOptions;

      const functions = getFunctions(firebaseApp, functionsRegionOrCustomDomain);
      const emulators = injector.get<DbxFirebaseParsedEmulatorsConfig>(DbxFirebaseParsedEmulatorsConfig, undefined);

      if (emulators?.useEmulators && emulators?.functions) {
        connectFunctionsEmulator(functions, emulators.functions.host, emulators.functions.port);
      }

      return functions;
    });

    providers.push(functionsProvider);
  }

  return makeEnvironmentProviders(providers);
}

// TODO: Providers now need to be initialized/registered in the bootstrap section as additional providers/config and not imported as modules this way
