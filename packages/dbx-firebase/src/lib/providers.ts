import { type ArrayOrValue, asArray, type Maybe } from '@dereekb/util';
import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { type FirebaseFunctionsMap } from '@dereekb/firebase';
import { provideDbxFirebaseAuth, type ProvideDbxFirebaseAuthConfig } from './auth//firebase.auth.providers';
import { provideDbxFirebaseEmulator, type ProvideDbxFirebaseEmulatorsConfig } from './firebase/firebase.emulator.providers';
import { provideDbxFirebaseApp, type ProvideDbxFirebaseAppConfig } from './firebase/firebase.providers';
import { type ProvideDbxFirebaseFirestoreCollectionConfig, provideDbxFirestoreCollection } from './firestore/firebase.firestore.providers';
import { provideDbxFirebaseFunctions, type ProvideDbxFirebaseFunctionsConfig } from './function/firebase.function.providers';
import { type ProvideDbxFirebaseStorageConfig, providedDbxFirebaseStorage } from './storage/firebase.storage.providers';
import { provideDbxFirebaseDevelopment, type ProvideDbxFirebaseDevelopmentConfig } from './development/development.providers';
import { provideDbxFirebaseNotifications, type ProvideDbxFirebaseNotificationsConfig } from './modules/notification/notification.providers';
import { provideDbxFirebaseModelContextService, type ProvideDbxFirebaseModelContextServiceConfig } from './model/service/model.context.providers';
import { provideDbxFirebaseModelTypesService, type ProvideDbxFirebaseModelTypesServiceConfig } from './model/modules/model/model.types.providers';
import { provideDbxFirebaseAnalyticsUserEventsListenerService } from './analytics';

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

  /**
   * If true, provideDbxFirebaseAnalyticsUserEventsListenerService() will be provided/called.
   */
  readonly provideAnalyticsUserEventsListener?: Maybe<boolean>;
}

/**
 * All-in-one provider for providing the main configurations for DbxFirebase.
 *
 * Requires the following already be provided/called:
 * - provideDbxModelService()
 *
 * @param config Configuration for provideDbxFirebase().
 * @returns EnvironmentProviders for the DbxFirebase configuration.
 */
export function provideDbxFirebase<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap>(config: ProvideDbxFirebaseConfig<T, M>) {
  const { app, emulator, storage, auth, functions, firestores, modelContextService, modelTypesService, development, notifications, provideAnalyticsUserEventsListener } = config;

  const providers: EnvironmentProviders[] = [provideDbxFirebaseApp(app), provideDbxFirebaseEmulator(emulator), providedDbxFirebaseStorage(storage), provideDbxFirebaseAuth(auth), provideDbxFirebaseFunctions(functions), provideDbxFirebaseModelContextService(modelContextService), provideDbxFirebaseModelTypesService(modelTypesService)];

  asArray(firestores).forEach((firestore) => {
    providers.push(provideDbxFirestoreCollection(firestore));
  });

  if (provideAnalyticsUserEventsListener) {
    providers.push(provideDbxFirebaseAnalyticsUserEventsListenerService());
  }

  if (development !== false) {
    providers.push(provideDbxFirebaseDevelopment(development ?? {}));
  }

  if (notifications != null) {
    providers.push(provideDbxFirebaseNotifications(notifications));
  }

  return makeEnvironmentProviders(providers);
}
