import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { Functions } from '@angular/fire/functions';
import { FirebaseDevelopmentFunctions, type FirebaseFunctionsConfigMap, type FirebaseFunctionsMap, FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY, type LazyFirebaseFunctions } from '@dereekb/firebase';
import { type ClassLikeType, forEachKeyValue } from '@dereekb/util';

/**
 * Configuration for provideDbxFirebaseFunctions().
 */
export interface ProvideDbxFirebaseFunctionsConfig<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap> {
  /**
   * The token to use for the functions getter.
   *
   * This is typically your LazyFirebaseFunctions result type.
   */
  functionsGetterToken: ClassLikeType<T>;
  /**
   * Factory function to retrieve the functions getter instance.
   *
   * @param functions The Firebase functions instance.
   * @returns The functions getter instance.
   */
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
 * Creates EnvironmentProviders for the LazyFirebaseFunctions type for a DbxFirebase app.
 *
 * Also provides FirebaseDevelopmentFunctions if developmentFunctionsKey is provided.
 *
 * @param config Configuration for provideDbxFirebaseFunctions().
 * @returns EnvironmentProviders for the LazyFirebaseFunctions type.
 */
export function provideDbxFirebaseFunctions<T, M extends FirebaseFunctionsMap = FirebaseFunctionsMap>(config: ProvideDbxFirebaseFunctionsConfig<T, M>): EnvironmentProviders {
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

  return makeEnvironmentProviders(providers);
}
