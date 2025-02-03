import { asGetter, GetterOrValue, type Maybe } from '@dereekb/util';
import { switchMapObject } from '@dereekb/rxjs';
import { DbxInjectionComponentConfig } from './injection';
import { Type } from '@angular/core';

/**
 * Provides a switchMap that passes configuration from the observable, unless the value is null/undefined/true in which case it passes the default configuration.
 *
 * @param defaultConfig
 * @returns
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
