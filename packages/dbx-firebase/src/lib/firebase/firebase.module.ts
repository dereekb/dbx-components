import { ModuleWithProviders, NgModule, Injector } from '@angular/core';
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

/**
 * Default firebase firestore provider module.
 */
@NgModule({
  providers: [
    provideFirestore((injector: Injector) => {
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
    })
  ]
})
export class DbxFirebaseDefaultFirestoreProviderModule {}

/**
 * Default firebase app check provider module.
 *
 * Also configures the DbxFirebaseAppCheckHttpInterceptor with HTTP_INTERCEPTORS in order for appCheck to be appended to requests to the api.
 */
@NgModule({
  providers: [
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
  ]
})
export class DbxFirebaseDefaultAppCheckProviderModule {}

/**
 * Default firebase auth provider module.
 */
@NgModule({
  providers: [
    provideAuth((injector: Injector) => {
      const firebaseApp = injector.get(FirebaseApp);
      const auth = getAuth(firebaseApp);
      const emulators = injector.get<DbxFirebaseParsedEmulatorsConfig>(DbxFirebaseParsedEmulatorsConfig, undefined);

      if (emulators?.useEmulators && emulators?.auth) {
        connectAuthEmulator(auth, `http://${emulators.auth.host}:${emulators.auth.port}`);
      }

      return auth;
    })
  ]
})
export class DbxFirebaseDefaultAuthProviderModule {}

/**
 * Default firebase storage provider module.
 */
@NgModule({
  providers: [
    provideStorage((injector: Injector) => {
      const firebaseApp = injector.get(FirebaseApp);
      const storage = getStorage(firebaseApp);
      const emulators = injector.get<DbxFirebaseParsedEmulatorsConfig>(DbxFirebaseParsedEmulatorsConfig, undefined);

      if (emulators?.useEmulators && emulators?.storage) {
        connectStorageEmulator(storage, emulators.storage.host, emulators.storage.port, {});
      }

      return storage;
    })
  ]
})
export class DbxFirebaseDefaultStorageProviderModule {}

/**
 * Default firebase functions provider module.
 */
@NgModule({
  providers: [
    provideFunctions((injector: Injector) => {
      const firebaseApp = injector.get(FirebaseApp);
      const firebaseOptions = injector.get<DbxFirebaseOptions>(DBX_FIREBASE_OPTIONS_TOKEN);
      const { functionsRegionOrCustomDomain } = firebaseOptions;

      const functions = getFunctions(firebaseApp, functionsRegionOrCustomDomain);
      const emulators = injector.get<DbxFirebaseParsedEmulatorsConfig>(DbxFirebaseParsedEmulatorsConfig, undefined);

      if (emulators?.useEmulators && emulators?.functions) {
        connectFunctionsEmulator(functions, emulators.functions.host, emulators.functions.port);
      }

      return functions;
    })
  ]
})
export class DbxFirebaseDefaultFunctionsProviderModule {}

/**
 * Default provider module.
 */
@NgModule({
  providers: [
    provideFirebaseApp((injector: Injector) => {
      const firebaseOptions = injector.get<DbxFirebaseOptions>(DBX_FIREBASE_OPTIONS_TOKEN);
      return initializeApp(firebaseOptions);
    }),
    DbxFirebaseDefaultAppCheckProviderModule,
    DbxFirebaseDefaultFirestoreProviderModule,
    DbxFirebaseDefaultAuthProviderModule,
    DbxFirebaseDefaultStorageProviderModule,
    DbxFirebaseDefaultFunctionsProviderModule
  ]
})
export class DbxFirebaseDefaultFirebaseProvidersModule {
  static forRoot(firebaseOptions: FirebaseOptions): ModuleWithProviders<DbxFirebaseDefaultFirebaseProvidersModule> {
    return {
      ngModule: DbxFirebaseDefaultFirebaseProvidersModule,
      providers: [
        {
          provide: DBX_FIREBASE_OPTIONS_TOKEN,
          useValue: firebaseOptions
        }
      ]
    };
  }
}
