import { type ComponentRef, Injector, type StaticProvider, runInInjectionContext } from '@angular/core';
import { type ArrayOrValue, flattenArrayOrValueArray, type Maybe } from '@dereekb/util';
import { type DbxInjectionComponentConfig, DBX_INJECTION_COMPONENT_DATA } from './injection';

/**
 * Flattens and merges multiple provider sources into a single `StaticProvider[]` array.
 *
 * Each argument can be a single `StaticProvider`, an array of providers, or `undefined`/`null`.
 * All values are flattened into a single array with nullish entries removed.
 *
 * @param providers - Any number of provider values or arrays to merge.
 * @returns A flat array of all non-nullish static providers.
 *
 * @example
 * ```typescript
 * const providers = mergeStaticProviders(
 *   { provide: TOKEN_A, useValue: 'a' },
 *   undefined,
 *   [{ provide: TOKEN_B, useValue: 'b' }]
 * );
 * // Result: [{ provide: TOKEN_A, useValue: 'a' }, { provide: TOKEN_B, useValue: 'b' }]
 * ```
 */
export function mergeStaticProviders(...providers: Maybe<ArrayOrValue<StaticProvider>>[]): StaticProvider[] {
  return flattenArrayOrValueArray<StaticProvider>(providers);
}

/**
 * Params for {@link createInjectorForInjectionComponentConfig}.
 */
export interface DbxInjectionComponentInjectorParams<T = unknown> {
  readonly config: DbxInjectionComponentConfig<T>;
  readonly parentInjector: Injector;
}

/**
 * Builds an element injector from a {@link DbxInjectionComponentConfig},
 * merging the config's providers and {@link DBX_INJECTION_COMPONENT_DATA} into a child injector.
 *
 * Returns the config's injector (or parent) unchanged if no providers or data are specified.
 *
 * @example
 * ```typescript
 * const injector = createInjectorForInjectionComponentConfig({
 *   config: { componentClass: MyComponent, data: { id: 1 }, providers: [myProvider] },
 *   parentInjector: this._injector
 * });
 * ```
 */
export function createInjectorForInjectionComponentConfig<T>(params: DbxInjectionComponentInjectorParams<T>): Injector {
  const { config, parentInjector } = params;
  const { injector: inputInjector, providers, data } = config;
  const parent = inputInjector ?? parentInjector;

  if (!providers && data == null) {
    return parent;
  }

  return Injector.create({
    parent,
    providers: mergeStaticProviders({ provide: DBX_INJECTION_COMPONENT_DATA, useValue: data }, providers)
  });
}

/**
 * Runs the init callback from a {@link DbxInjectionComponentConfig} on the given component ref,
 * executing within the component's injection context so that `inject()` is available inside the callback.
 *
 * @example
 * ```typescript
 * const ref = viewContainerRef.createComponent(config.componentClass, { injector });
 * initInjectionComponent(ref, config);
 * ```
 */
export function initInjectionComponent<T>(componentRef: ComponentRef<T>, config: DbxInjectionComponentConfig<T>): void {
  if (config.init) {
    runInInjectionContext(componentRef.injector, () => config.init!(componentRef.instance));
  }
}
