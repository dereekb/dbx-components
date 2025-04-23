import { ModuleWithProviders, NgModule } from '@angular/core';
import { ProvideDbxFirebaseFirestoreCollectionConfig, provideDbxFirestoreCollection } from './firebase.firestore.providers';

export type DbxFirebaseFirestoreCollectionModuleConfig<T> = ProvideDbxFirebaseFirestoreCollectionConfig<T>;

/**
 * Used to initialize the FirestoreCollection for a DbxFirebase app.
 *
 * @deprecated use provideDbxFirestoreCollection() instead.
 */
@NgModule()
export class DbxFirebaseFirestoreCollectionModule {
  static forRoot<T>(config: DbxFirebaseFirestoreCollectionModuleConfig<T>): ModuleWithProviders<DbxFirebaseFirestoreCollectionModule> {
    return {
      ngModule: DbxFirebaseFirestoreCollectionModule,
      providers: [provideDbxFirestoreCollection(config)]
    };
  }
}
