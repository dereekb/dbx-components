import { asGetter, type GetterOrValue, type Maybe } from '@dereekb/util';
import { switchMapObject } from '@dereekb/rxjs';
import { type DbxInjectionComponentConfig } from './injection';
import { type Type } from '@angular/core';

/**
 * Creates an RxJS operator that switches between injection component configs, falling back to a
 * default config when the source emits `null`, `undefined`, or `true`.
 *
 * If the `defaultConfig` resolves to a class (function), it is automatically wrapped into a
 * `{ componentClass }` config object.
 *
 * This is useful for reactive streams where an upstream value may indicate "use the default component"
 * rather than providing an explicit configuration.
 *
 * @typeParam T - The specific {@link DbxInjectionComponentConfig} subtype.
 * @typeParam X - The component type.
 * @param defaultConfig - A static value, getter, or component class to use as the fallback config.
 * @returns An RxJS operator compatible with `pipe()`.
 *
 * @see {@link DbxInjectionComponentConfig}
 *
 * @example
 * ```typescript
 * config$.pipe(
 *   switchMapDbxInjectionComponentConfig(MyDefaultComponent)
 * ).subscribe(config => {
 *   // config is always a DbxInjectionComponentConfig or undefined
 * });
 * ```
 */
export function switchMapDbxInjectionComponentConfig<T extends DbxInjectionComponentConfig<X>, X = any>(defaultConfig?: GetterOrValue<Maybe<T | Type<X>>>) {
  const defaultAsGetter = asGetter(defaultConfig);

  return switchMapObject<T>({
    defaultGetter: () => {
      const value = defaultAsGetter();

      if (typeof value === 'function') {
        // is a component class
        return { componentClass: value } as T;
      } else {
        return value;
      }
    }
  });
}
