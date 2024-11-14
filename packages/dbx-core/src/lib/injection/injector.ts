import { AbstractType, Inject, Injector, Provider, Type } from '@angular/core';
import { ClassType } from '@dereekb/util';

export type InjectableType<T> = (Type<T> | AbstractType<T>) & Provider;

/**
 * Creates a new instance of the injectable type with the input injector.
 *
 * @param type
 * @param parent
 * @returns
 */
export function newWithInjector<T>(type: InjectableType<T>, parent: Injector): T {
  const injector = Injector.create({ providers: [type], parent });
  return injector.get(type);
}
