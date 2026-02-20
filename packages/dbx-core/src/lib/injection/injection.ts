import { InjectionToken, type Injector, type NgModuleRef, type StaticProvider, type TemplateRef, type Type, type ViewRef } from '@angular/core';
import { type Configurable, type FactoryWithRequiredInput, filterMaybeArrayValues, type Maybe, mergeArrays, mergeObjects } from '@dereekb/util';

export const DBX_INJECTION_COMPONENT_DATA = new InjectionToken('DbxInjectionComponentConfigData');

export interface DbxInjectionComponentConfig<T = unknown> {
  /**
   * Type of Component to initialize.
   */
  readonly componentClass: Type<T>;
  /**
   * (Optional) providers to provide to the existing injector.
   */
  readonly providers?: Maybe<StaticProvider[]>;
  /**
   * (Optional) Custom parent injector to use when creating the component.
   */
  readonly injector?: Maybe<Injector>;
  /**
   * (Optional) Module ref to use when creating the component.
   */
  readonly ngModuleRef?: NgModuleRef<unknown>;
  /**
   * (Optional) Custom initialization code when an instance is created.
   *
   * This is called in an Angular injection context of the created component, so that inject() is available and will be destroyed when the created component is destroyed.
   */
  readonly init?: Maybe<(instance: T) => void>;
  /**
   * unknown optional data to inject into the component.
   */
  readonly data?: Maybe<unknown>;
}

/**
 * The injector may be important to where the dbxInjection is getting injected at. Some types may disallow setting a custom parent injector.
 */
export type DbxInjectionComponentConfigWithoutInjector<T = unknown> = Omit<DbxInjectionComponentConfig<T>, 'injector'>;

export type DbxInjectionComponentConfigFactory<I, T = unknown> = FactoryWithRequiredInput<DbxInjectionComponentConfig<T>, I>;

export interface DbxInjectionTemplateConfig<T = unknown> {
  /**
   * Template ref to display.
   */
  readonly templateRef?: Maybe<TemplateRef<T>>;
  /**
   * View ref to inject.
   */
  readonly viewRef?: Maybe<ViewRef>;
}

/**
 * Merges multiple configurations into a single configuration.
 *
 * @param configs
 * @returns
 */
export function mergeDbxInjectionComponentConfigs<T = unknown>(configs: Maybe<Partial<DbxInjectionComponentConfig<T>>>[]): Partial<DbxInjectionComponentConfig<T>> {
  const providers = mergeArrays(filterMaybeArrayValues(configs).map((x) => x.providers));
  const result = mergeObjects(configs) as Configurable<DbxInjectionComponentConfig<T>>;
  result.providers = providers;
  return result;
}
