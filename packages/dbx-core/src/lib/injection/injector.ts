import { type AbstractType, Injector, type Provider, type Type } from '@angular/core';

/**
 * A type that is both an Angular injectable class (concrete or abstract) and a `Provider`,
 * making it suitable for use with `Injector.create()`.
 *
 * @typeParam T - The instance type produced by the injectable.
 */
export type InjectableType<T> = (Type<T> | AbstractType<T>) & Provider;

/**
 * Creates a child injector with the given `type` as its sole provider and immediately
 * resolves an instance of that type.
 *
 * This is a convenience for one-off instantiation of an injectable class using a specific
 * parent injector, without needing to manually configure `Injector.create()`.
 *
 * @typeParam T - The type to instantiate.
 * @param type - The injectable class to provide and resolve.
 * @param parent - The parent injector that supplies the type's dependencies.
 * @returns A new instance of `T`.
 *
 * @example
 * ```typescript
 * const service = newWithInjector(MyService, parentInjector);
 * ```
 */
export function newWithInjector<T>(type: InjectableType<T>, parent: Injector): T {
  const injector = Injector.create({ providers: [type], parent });
  return injector.get(type);
}
