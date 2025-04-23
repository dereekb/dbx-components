import { ModuleWithProviders, NgModule } from '@angular/core';
import { provideDbxFirebaseAuth, ProvideDbxFirebaseAuthConfig } from './firebase.auth.providers';

export type DbxFirebaseAuthModuleConfig = ProvideDbxFirebaseAuthConfig;

/**
 * @deprecated use provideDbxFirebaseAuth() instead
 */
@NgModule({})
export class DbxFirebaseAuthModule {
  static forRoot(config: DbxFirebaseAuthModuleConfig): ModuleWithProviders<DbxFirebaseAuthModule> {
    return {
      ngModule: DbxFirebaseAuthModule,
      providers: [provideDbxFirebaseAuth(config)]
    };
  }
}
