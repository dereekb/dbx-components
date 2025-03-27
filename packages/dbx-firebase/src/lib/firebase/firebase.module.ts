import { ModuleWithProviders, NgModule, Injector } from '@angular/core';
import { provideDbxFirebaseApp } from './firebase.providers';
import { DbxFirebaseOptions } from './options';

/**
 * Default provider module.
 *
 * @deprecated use provideDbxFirebaseApp() instead
 */
@NgModule({
  providers: []
})
export class DbxFirebaseDefaultFirebaseProvidersModule {
  static forRoot(dbxFirebaseOptions: DbxFirebaseOptions): ModuleWithProviders<DbxFirebaseDefaultFirebaseProvidersModule> {
    return {
      ngModule: DbxFirebaseDefaultFirebaseProvidersModule,
      providers: [provideDbxFirebaseApp({ dbxFirebaseOptions })]
    };
  }
}
