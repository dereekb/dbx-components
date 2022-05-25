import { ModuleWithProviders, NgModule, Injector, InjectionToken } from '@angular/core';
import { FirebaseOptions, initializeApp } from 'firebase/app';
import { FirebaseApp, provideFirebaseApp } from '@angular/fire/app';
import { provideStorage, getStorage, connectStorageEmulator } from '@angular/fire/storage';
import { provideFunctions, getFunctions, connectFunctionsEmulator } from '@angular/fire/functions';
import { provideFirestore, getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from '@angular/fire/firestore';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { DbxFirebaseParsedEmulatorsConfig } from './emulators';
import { DbxFirebaseOptions } from './options';

// TODO: remove "as any" typescript casting - https://github.com/angular/angularfire/issues/3086

/**
 * Default firebase firestore provider module.
 */
@NgModule({
  imports: [
    provideFirestore(((injector: Injector) => {
      const firebaseApp = injector.get(FirebaseApp);
      const firestore = getFirestore(firebaseApp);
      const emulators = injector.get<DbxFirebaseParsedEmulatorsConfig>(DbxFirebaseParsedEmulatorsConfig, undefined);

      if (emulators?.useEmulators && emulators?.firestore) {
        connectFirestoreEmulator(firestore, emulators.firestore.host, emulators.firestore.port, {});
      }

      enableIndexedDbPersistence(firestore);

      return firestore;
    }) as any)
  ]
})
export class DbxFirebaseDefaultFirestoreProviderModule { }

/**
 * Default firebase auth provider module.
 */
@NgModule({
  imports: [
    provideAuth(((injector: Injector) => {
      const firebaseApp = injector.get(FirebaseApp);
      const auth = getAuth(firebaseApp);
      const emulators = injector.get<DbxFirebaseParsedEmulatorsConfig>(DbxFirebaseParsedEmulatorsConfig, undefined);

      if (emulators?.useEmulators && emulators?.auth) {
        connectAuthEmulator(auth, `http://${emulators.auth.host}:${emulators.auth.port}`);
      }

      return auth;
    }) as any)
  ]
})
export class DbxFirebaseDefaultAuthProviderModule { }

/**
 * Default firebase storage provider module.
 */
@NgModule({
  imports: [
    provideStorage(((injector: Injector) => {
      const firebaseApp = injector.get(FirebaseApp);
      const storage = getStorage(firebaseApp);
      const emulators = injector.get<DbxFirebaseParsedEmulatorsConfig>(DbxFirebaseParsedEmulatorsConfig, undefined);

      if (emulators?.useEmulators && emulators?.storage) {
        connectStorageEmulator(storage, emulators.storage.host, emulators.storage.port, {});
      }

      return storage;
    }) as any)
  ]
})
export class DbxFirebaseDefaultStorageProviderModule { }

/**
 * Default firebase functions provider module.
 */
@NgModule({
  imports: [
    provideFunctions(((injector: Injector) => {
      const firebaseApp = injector.get(FirebaseApp);
      const firebaseOptions = injector.get<DbxFirebaseOptions>(DBX_FIREBASE_OPTIONS_TOKEN);
      const { functionsRegionOrCustomDomain } = firebaseOptions;

      const functions = getFunctions(firebaseApp, functionsRegionOrCustomDomain);
      const emulators = injector.get<DbxFirebaseParsedEmulatorsConfig>(DbxFirebaseParsedEmulatorsConfig, undefined);

      if (emulators?.useEmulators && emulators?.functions) {
        connectFunctionsEmulator(functions, emulators.functions.host, emulators.functions.port);
      }

      return functions;
    }) as any)
  ]
})
export class DbxFirebaseDefaultFunctionsProviderModule { }

export const DBX_FIREBASE_OPTIONS_TOKEN = new InjectionToken('DbxFirebaseOptions');

/**
 * Default provider module.
 */
@NgModule({
  imports: [
    provideFirebaseApp(((injector: Injector) => {
      const firebaseOptions = injector.get<DbxFirebaseOptions>(DBX_FIREBASE_OPTIONS_TOKEN);
      return initializeApp(firebaseOptions);
    }) as any),
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
      providers: [{
        provide: DBX_FIREBASE_OPTIONS_TOKEN,
        useValue: firebaseOptions
      }]
    };
  }

}
