import { ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { Functions } from '@angular/fire/functions';
import { FirebaseFunctionsConfigMap, FirebaseFunctionsMap, LazyFirebaseFunctions } from '@dereekb/firebase';
import { ClassLikeType, forEachKeyValue } from '@dereekb/util';

export interface DbxFirebaseFunctionsModuleConfig<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap> {
  functionsGetterToken: ClassLikeType<T>;
  functionsGetterFactory: (functions: Functions) => T;
  /**
   * Optional functions config map to provide.
   *
   * If provided, will inject all the types with factory functions so they can be injected into the app.
   */
  functionsConfigMap?: FirebaseFunctionsConfigMap<M>;
}

/**
 * Used to initialize the LazyFirebaseFunctions type for a DbxFirebase app.
 */
@NgModule()
export class DbxFirebaseFunctionsModule {
  static forRoot<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap>(config: DbxFirebaseFunctionsModuleConfig<T, M>): ModuleWithProviders<DbxFirebaseFunctionsModule> {
    const providers: Provider[] = [
      {
        provide: config.functionsGetterToken,
        useFactory: config.functionsGetterFactory,
        deps: [Functions]
      }
    ];

    if (config.functionsConfigMap) {
      forEachKeyValue(config.functionsConfigMap, {
        forEach: ([key, entry]) => {
          const provide = entry[0];

          providers.push({
            provide,
            useFactory: (lazyFunctions: LazyFirebaseFunctions<M>) => {
              const getter = lazyFunctions[key as string];

              if (!getter) {
                throw new Error(`Could not create provider for firebase function getter "${provide}" as the getter was unavailable.`);
              } else {
                return getter();
              }
            },
            deps: [config.functionsGetterToken]
          });
        }
      });
    }

    return {
      ngModule: DbxFirebaseFunctionsModule,
      providers
    };
  }
}
