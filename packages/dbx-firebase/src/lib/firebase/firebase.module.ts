import { ModuleWithProviders, NgModule } from '@angular/core';
import { provideDbxFirebaseApp } from './firebase.providers';
import { DbxFirebaseAppOptions } from './firebase.options';

/**
 * Default provider module.
 *
 * @deprecated use provideDbxFirebaseApp() instead
 */
@NgModule({
  providers: []
})
export class DbxFirebaseDefaultFirebaseProvidersModule {
  static forRoot(dbxFirebaseOptions: DbxFirebaseAppOptions): ModuleWithProviders<DbxFirebaseDefaultFirebaseProvidersModule> {
    return {
      ngModule: DbxFirebaseDefaultFirebaseProvidersModule,
      providers: [provideDbxFirebaseApp({ dbxFirebaseAppOptions: dbxFirebaseOptions })]
    };
  }
}
