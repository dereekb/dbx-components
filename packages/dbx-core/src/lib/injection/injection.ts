import { InjectionToken, type Injector, type NgModuleRef, type StaticProvider, type TemplateRef, type Type, type ViewRef } from '@angular/core';
import { type Configurable, type EqualityComparatorFunction, type FactoryWithRequiredInput, filterMaybeArrayValues, type Maybe, mergeArrays, mergeObjects, safeEqualityComparatorFunction } from '@dereekb/util';

/**
 * Injection token used to provide arbitrary data to dynamically created components.
 *
 * Components created via {@link DbxInjectionComponentConfig} can inject this token
 * to access the `data` property from their configuration.
 *
 * @example
 * ```typescript
 * // In a dynamically injected component:
 * readonly data = inject(DBX_INJECTION_COMPONENT_DATA);
 * ```
 */
export const DBX_INJECTION_COMPONENT_DATA = new InjectionToken('DbxInjectionComponentConfigData');

/**
 * Configuration for dynamically creating and injecting an Angular component into a view container.
 *
 * This is the primary configuration interface for the dbx-injection system. It describes which component
 * to create, how to configure its dependency injection context, and how to initialize it after creation.
 *
 * @typeParam T - The type of the component being created.
 *
 * @see {@link DbxInjectionInstance} - The runtime engine that processes this configuration.
 * @see {@link DbxInjectionComponent} - The component that accepts this configuration as an input.
 *
 * @example
 * ```typescript
 * const config: DbxInjectionComponentConfig<MyComponent> = {
 *   componentClass: MyComponent,
 *   data: { id: 123 },
 *   init: (instance) => { instance.title = 'Hello'; }
 * };
 * ```
 */
export interface DbxInjectionComponentConfig<T = unknown> {
  /**
   * The Angular component class to dynamically instantiate.
   */
  readonly componentClass: Type<T>;
  /**
   * Optional static providers to add to the injector used when creating the component.
   *
   * These providers are merged with any data provider and made available to the created component.
   */
  readonly providers?: Maybe<StaticProvider[]>;
  /**
   * Optional custom parent injector to use when creating the component.
   *
   * When not provided, the injector from the host {@link DbxInjectionInstance} is used.
   */
  readonly injector?: Maybe<Injector>;
  /**
   * Optional NgModule reference to associate with the created component.
   *
   * Useful when the component belongs to a lazily loaded module.
   */
  readonly ngModuleRef?: NgModuleRef<unknown>;
  /**
   * Optional initialization callback invoked after the component is created.
   *
   * This is called within the Angular injection context of the created component,
   * so `inject()` is available and any `DestroyRef` callbacks registered inside
   * will be cleaned up when the created component is destroyed.
   */
  readonly init?: Maybe<(instance: T) => void>;
  /**
   * Optional arbitrary data to inject into the component via the {@link DBX_INJECTION_COMPONENT_DATA} token.
   */
  readonly data?: Maybe<unknown>;
}

/**
 * A variant of {@link DbxInjectionComponentConfig} that omits the `injector` property.
 *
 * Used in scenarios where the injection site controls the parent injector and does not
 * allow the configuration to override it (e.g., when the host component must be the injection root).
 *
 * @typeParam T - The type of the component being created.
 */
export type DbxInjectionComponentConfigWithoutInjector<T = unknown> = Omit<DbxInjectionComponentConfig<T>, 'injector'>;

/**
 * A factory function that produces a {@link DbxInjectionComponentConfig} from a required input value.
 *
 * @typeParam I - The input type required by the factory.
 * @typeParam T - The type of the component the produced config will create.
 */
export type DbxInjectionComponentConfigFactory<I, T = unknown> = FactoryWithRequiredInput<DbxInjectionComponentConfig<T>, I>;

/**
 * Configuration for injecting a template or view reference into a view container.
 *
 * This is an alternative to {@link DbxInjectionComponentConfig} for cases where you want to
 * display a pre-existing template or view rather than dynamically creating a component.
 *
 * @typeParam T - The context type of the template reference.
 *
 * @example
 * ```typescript
 * const config: DbxInjectionTemplateConfig = {
 *   templateRef: myTemplateRef
 * };
 * ```
 */
export interface DbxInjectionTemplateConfig<T = unknown> {
  /**
   * An Angular `TemplateRef` to render as an embedded view.
   */
  readonly templateRef?: Maybe<TemplateRef<T>>;
  /**
   * A pre-existing `ViewRef` to insert into the container.
   */
  readonly viewRef?: Maybe<ViewRef>;
}

/**
 * Compares two {@link DbxInjectionComponentConfig} values for structural equality, safely handling nullish values.
 *
 * Compares `componentClass`, `data`, `init`, and `injector` by reference. Does NOT compare
 * `providers` or `ngModuleRef`, as provider arrays typically change on every list data update
 * (e.g., with new `DBX_VALUE_LIST_VIEW_ITEM` values) without requiring component recreation.
 *
 * When both values are nullish, uses strict equality (`null === null` is `true`,
 * `null === undefined` is `false`). The comparator is only invoked when both are non-nullish.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const dbxInjectionComponentConfigIsEqual: EqualityComparatorFunction<Maybe<DbxInjectionComponentConfig<any>>> = safeEqualityComparatorFunction((a, b) => a.componentClass === b.componentClass && a.data === b.data && a.init === b.init && a.injector === b.injector);

/**
 * Merges multiple partial {@link DbxInjectionComponentConfig} objects into a single configuration.
 *
 * Provider arrays are concatenated so that all providers from all configs are preserved.
 * All other properties are merged with later values taking precedence.
 *
 * @param configs - An array of partial configs to merge. May contain `undefined`/`null` entries which are filtered out.
 * @returns A single merged partial configuration.
 */
export function mergeDbxInjectionComponentConfigs<T = unknown>(configs: Maybe<Partial<DbxInjectionComponentConfig<T>>>[]): Partial<DbxInjectionComponentConfig<T>> {
  const providers = mergeArrays(filterMaybeArrayValues(configs).map((x) => x.providers));
  const result = mergeObjects(configs) as Configurable<DbxInjectionComponentConfig<T>>;
  result.providers = providers;
  return result;
}
