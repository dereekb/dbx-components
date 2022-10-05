import { ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { Functions } from '@angular/fire/functions';
import { FirebaseDevelopmentFunctions, FirebaseFunctionsConfigMap, FirebaseFunctionsMap, FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY, LazyFirebaseFunctions } from '@dereekb/firebase';
import { ClassLikeType, forEachKeyValue } from '@dereekb/util';

export interface DbxFirebaseFunctionsModuleConfig<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap> {
  functionsGetterToken: ClassLikeType<T>;
  functionsGetterFactory: (functions: Functions) => T;
  /**
   * Key of the functions config to use to inject FirebaseDevelopmentFunctions using that same provider.
   *
   * Defaults to "developmentFunctions". If false, will not be injected automatically.
   */
  developmentFunctionsKey?: string | false;
  /**
   * Optional functions config map to provide.
   *
   * If provided, will inject all the types with factory functions so they can be injected into the app.
   */
  functionsConfigMap?: FirebaseFunctionsConfigMap<M>;
}

/**
 * Used to initialize the LazyFirebaseFunctions type for a DbxFirebase app.
 *
 * Handles the  key different, automatically injecting FirebaseDevelopmentFunctions with this existing value.
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

      // Add a provider for FirebaseDevelopmentFunctions if developmentFunctions is provided.
      const developmentFunctionsKey = config.developmentFunctionsKey ?? FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY;

      if (developmentFunctionsKey) {
        const developmentFunctionsConfig = config.functionsConfigMap[developmentFunctionsKey];

        if (developmentFunctionsConfig != null) {
          providers.push({
            provide: FirebaseDevelopmentFunctions,
            useExisting: developmentFunctionsConfig[0]
          });
        }
      }
    }

    return {
      ngModule: DbxFirebaseFunctionsModule,
      providers
    };
  }
}
