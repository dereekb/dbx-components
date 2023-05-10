import { asGetter, ClassType, GetterOrValue, Maybe, ObjectWithConstructor } from '@dereekb/util';
import { ObservableOrValueGetter, switchMapObject } from '@dereekb/rxjs';
import { Observable, OperatorFunction } from 'rxjs';
import { DbxInjectionComponentConfig } from './injection';
import { InjectionToken, Injector, NgModuleRef, StaticProvider, TemplateRef, Type, ViewRef } from '@angular/core';

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
