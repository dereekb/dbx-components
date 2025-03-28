import { ArrayOrValue, asArray } from '@dereekb/util';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { FirebaseFunctionsMap } from '@dereekb/firebase';
import { provideDbxFirebaseAuth, ProvideDbxFirebaseAuthConfig } from './auth//firebase.auth.providers';
import { provideDbxFirebaseEmulator, ProvideDbxFirebaseEmulatorsConfig } from './firebase/firebase.emulator.providers';
import { provideDbxFirebaseApp, ProvideDbxFirebaseAppConfig } from './firebase/firebase.providers';
import { ProvideDbxFirebaseFirestoreCollectionConfig, provideDbxFirestoreCollection } from './firestore/firebase.firestore.providers';
import { provideDbxFirebaseFunctions, ProvideDbxFirebaseFunctionsConfig } from './function/firebase.function.providers';
import { ProvideDbxFirebaseStorageConfig, providedDbxFirebaseStorage } from './storage/firebase.storage.providers';
import { provideDbxFirebaseDevelopment, ProvideDbxFirebaseDevelopmentConfig } from './development/development.providers';
import { provideDbxFirebaseNotifications, ProvideDbxFirebaseNotificationsConfig } from './modules/notification/notification.providers';
import { provideDbxFirebaseModelContextService, ProvideDbxFirebaseModelContextServiceConfig } from './model/service/model.context.providers';
import { provideDbxFirebaseModelTypesService, ProvideDbxFirebaseModelTypesServiceConfig } from './model/modules/model/model.types.providers';

export interface ProvideDbxFirebaseConfig<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap> {
  // Required Configurations
  readonly app: ProvideDbxFirebaseAppConfig;
  readonly emulator: ProvideDbxFirebaseEmulatorsConfig;
  readonly storage: ProvideDbxFirebaseStorageConfig;
  readonly auth: ProvideDbxFirebaseAuthConfig;
  readonly functions: ProvideDbxFirebaseFunctionsConfig<T, M>;
  readonly firestores: ArrayOrValue<ProvideDbxFirebaseFirestoreCollectionConfig<any>>;
  /**
   * Configuration for provideDbxFirebaseModelContextService().
   */
  readonly modelContextService: ProvideDbxFirebaseModelContextServiceConfig<any>;
  /**
   * Configuration for provideDbxFirebaseModelTypesService().
   */
  readonly modelTypesService: ProvideDbxFirebaseModelTypesServiceConfig;
  /**
   * Configuration for provideDbxFirebaseDevelopment.
   *
   * If false, provideDbxFirebaseDevelopment() will not be provided/called.
   */
  readonly development?: ProvideDbxFirebaseDevelopmentConfig | false;

  // Optional
  /**
   * Configuration for provideDbxFirebaseNotifications().
   *
   * If not provided, provideDbxFirebaseNotifications() will not be provided/called.
   */
  readonly notifications?: ProvideDbxFirebaseNotificationsConfig;
}

/**
 * All-in-one provider for providing the main configurations for DbxFirebase.
 *
 * @param config Configuration for provideDbxFirebase().
 * @returns EnvironmentProviders for the DbxFirebase configuration.
 */
export function provideDbxFirebase<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap>(config: ProvideDbxFirebaseConfig<T, M>) {
  const { app, emulator, storage, auth, functions, firestores, modelContextService, modelTypesService, development, notifications } = config;

  const providers: EnvironmentProviders[] = [provideDbxFirebaseApp(app), provideDbxFirebaseEmulator(emulator), providedDbxFirebaseStorage(storage), provideDbxFirebaseAuth(auth), provideDbxFirebaseFunctions(functions), provideDbxFirebaseModelContextService(modelContextService), provideDbxFirebaseModelTypesService(modelTypesService)];

  asArray(firestores).forEach((firestore) => {
    providers.push(provideDbxFirestoreCollection(firestore));
  });

  if (development !== false) {
    providers.push(provideDbxFirebaseDevelopment(development ?? {}));
  }

  if (notifications != null) {
    providers.push(provideDbxFirebaseNotifications(notifications));
  }

  return makeEnvironmentProviders(providers);
}
