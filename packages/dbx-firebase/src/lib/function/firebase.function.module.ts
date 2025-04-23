import { ModuleWithProviders, NgModule } from '@angular/core';
import { provideDbxFirebaseFunctions, ProvideDbxFirebaseFunctionsConfig } from './firebase.function.providers';
import { FirebaseFunctionsMap } from '@dereekb/firebase';

export type DbxFirebaseFunctionsModuleConfig<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap> = ProvideDbxFirebaseFunctionsConfig<T, M>;
/**
 * Used to initialize the LazyFirebaseFunctions type for a DbxFirebase app.
 *
 * @deprecated use provideDbxFirebaseFunctions() instead.
 */
@NgModule()
export class DbxFirebaseFunctionsModule {
  static forRoot<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap>(config: DbxFirebaseFunctionsModuleConfig<T, M>): ModuleWithProviders<DbxFirebaseFunctionsModule> {
    return {
      ngModule: DbxFirebaseFunctionsModule,
      providers: [provideDbxFirebaseFunctions(config)]
    };
  }
}
