import { ModuleWithProviders, NgModule } from '@angular/core';
import { ProvideDbxFirebaseStorageConfig, providedDbxFirebaseStorage } from './firebase.storage.providers';

export type DbxFirebaseStorageModuleConfig = ProvideDbxFirebaseStorageConfig;

/**
 * @deprecated use providedDbxFirebaseStorage() instead.
 */
@NgModule({})
export class DbxFirebaseStorageModule {
  static forRoot(config?: DbxFirebaseStorageModuleConfig): ModuleWithProviders<DbxFirebaseStorageModule> {
    return {
      ngModule: DbxFirebaseStorageModule,
      providers: [providedDbxFirebaseStorage(config)]
    };
  }
}
