import { ModuleWithProviders, NgModule } from '@angular/core';
import { ProvideDbxFirebaseStorageConfig } from './firebase.storage.providers';
import { providedDbxFirebaseStorage } from './firebase.storage.providers';

export type DbxFirebaseStorageModuleConfig = ProvideDbxFirebaseStorageConfig;

/**
 * @deprecated use providedDbxFirebaseStorageContext() instead.
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
