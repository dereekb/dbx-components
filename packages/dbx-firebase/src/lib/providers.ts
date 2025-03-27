import { ArrayOrValue, asArray } from '@dereekb/util';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { FirebaseFunctionsMap } from '@dereekb/firebase';
import { provideDbxFirebaseAuth, ProvideDbxFirebaseAuthConfig } from './auth';
import { provideDbxFirebaseApp, ProvideDbxFirebaseAppConfig, provideDbxFirebaseEmulator, ProvideDbxFirebaseEmulatorsConfig } from './firebase';
import { ProvideDbxFirebaseFirestoreCollectionConfig, provideDbxFirestoreCollection } from './firestore';
import { provideDbxFirebaseFunctions, ProvideDbxFirebaseFunctionsConfig } from './function';
import { ProvideDbxFirebaseStorageConfig, providedDbxFirebaseStorage } from './storage';

export interface ProvideDbxFirebaseConfig<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap> {
  readonly app: ProvideDbxFirebaseAppConfig;
  readonly emulator: ProvideDbxFirebaseEmulatorsConfig;
  readonly storage: ProvideDbxFirebaseStorageConfig;
  readonly auth: ProvideDbxFirebaseAuthConfig;
  readonly functions: ProvideDbxFirebaseFunctionsConfig<T, M>;
  readonly firestores: ArrayOrValue<ProvideDbxFirebaseFirestoreCollectionConfig<any>>;
}

/**
 * All-in-one provider for providing the main configurations for DbxFirebase.
 *
 * @param config Configuration for provideDbxFirebase().
 * @returns EnvironmentProviders for the DbxFirebase configuration.
 */
export function provideDbxFirebase<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap>(config: ProvideDbxFirebaseConfig<T, M>) {
  const { app, emulator, storage, auth, functions, firestores } = config;

  const providers: EnvironmentProviders[] = [provideDbxFirebaseApp(app), provideDbxFirebaseEmulator(emulator), providedDbxFirebaseStorage(storage), provideDbxFirebaseAuth(auth), provideDbxFirebaseFunctions(functions)];

  asArray(firestores).forEach((firestore) => {
    providers.push(provideDbxFirestoreCollection(firestore));
  });

  return makeEnvironmentProviders(providers);
}
